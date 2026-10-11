"""Normalize Capital One Nessie payloads into FinTwin's shapes.

Nessie account balances and transaction amounts are dollars. FinTwin stores
integer cents. Account numbers are never copied onto the normalized models.
Historical transactions are not added back into the account balance: the
balance and the transaction list are independent fields.

Nessie purchases do not include a spending category or a merchant name. Those
live on a separate merchant record, which this phase does not fetch. Missing
text is `null` rather than a guessed label. A missing or unparseable date is
`null` rather than today's date.

Cash-flow sign, applied after taking the absolute value so a source amount
that is already negative is not flipped twice:

- deposits are positive
- purchases are negative
- withdrawals are negative
"""

from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

AccountType = Literal["checking", "savings", "credit_card"]
SourceType = Literal["purchase", "deposit", "withdrawal"]

_ACCOUNT_TYPES: dict[str, AccountType] = {
    "checking": "checking",
    "savings": "savings",
    "credit card": "credit_card",
}

_DATE_FIELDS: dict[SourceType, str] = {
    "purchase": "purchase_date",
    "deposit": "transaction_date",
    "withdrawal": "transaction_date",
}


class NessieDataError(ValueError):
    """A Nessie payload is missing a field FinTwin cannot safely invent."""


class NessieCustomer(BaseModel):
    id: str
    first_name: str | None = Field(default=None, serialization_alias="firstName")
    last_name: str | None = Field(default=None, serialization_alias="lastName")

    model_config = ConfigDict(populate_by_name=True)


class NessieAccount(BaseModel):
    """One Nessie account. Balances of different types are never summed."""

    id: str
    type: AccountType
    nickname: str | None
    balance_cents: int = Field(serialization_alias="balanceCents")
    customer_id: str | None = Field(default=None, serialization_alias="customerId")
    source: Literal["nessie"] = "nessie"

    model_config = ConfigDict(populate_by_name=True)


class NessieTransaction(BaseModel):
    """One purchase, deposit, or withdrawal. `amountCents` is signed cash flow."""

    id: str
    account_id: str = Field(serialization_alias="accountId")
    date: str | None
    amount_cents: int = Field(serialization_alias="amountCents")
    # Nessie does not put a category on the transaction. Left null on purpose.
    category: str | None = None
    source_type: SourceType = Field(serialization_alias="sourceType")
    description: str | None
    status: str | None = None
    source: Literal["nessie"] = "nessie"

    model_config = ConfigDict(populate_by_name=True)


def dollars_to_cents(amount: Decimal | int | str) -> int:
    """Convert a dollar amount to integer cents without binary float error.

    `amount` must already be an exact decimal (Nessie JSON is parsed with
    `Decimal`). Floats are rejected so `0.29` cannot become 28 cents.
    """

    if isinstance(amount, float):
        raise NessieDataError("Dollar amounts must be parsed as decimals, not floats.")

    value = amount if isinstance(amount, Decimal) else Decimal(str(amount))
    cents = (value * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return int(cents)


def redact_text(value: str | None, secret: str = "") -> str | None:
    """Trim text. Drop blanks. Strip the API key if a payload ever echoes it."""

    if value is None:
        return None

    text = str(value).strip()

    if not text:
        return None

    if secret:
        text = text.replace(secret, "[redacted]")

    return text or None


def _as_decimal(value: Any, *, field: str) -> Decimal:
    if isinstance(value, float):
        raise NessieDataError(f"Nessie {field} was not a decimal amount.")

    if isinstance(value, Decimal):
        return value

    if isinstance(value, int) and not isinstance(value, bool):
        return Decimal(value)

    if isinstance(value, str):
        try:
            return Decimal(value)
        except Exception as exc:
            raise NessieDataError(f"Nessie {field} was not a number.") from exc

    raise NessieDataError(f"Nessie {field} was not a number.")


def _optional_text(record: dict[str, Any], field: str, secret: str) -> str | None:
    value = record.get(field)

    if value is None:
        return None

    if not isinstance(value, str):
        return None

    return redact_text(value, secret)


def _calendar_date(value: Any) -> str | None:
    if not isinstance(value, str):
        return None

    try:
        return date.fromisoformat(value).isoformat()
    except ValueError:
        return None


def customer_display_name(customer: NessieCustomer) -> str:
    parts = [part for part in (customer.first_name, customer.last_name) if part]
    return " ".join(parts) if parts else "(no name on file)"


def normalize_customer(record: dict[str, Any], *, secret: str = "") -> NessieCustomer:
    customer_id = record.get("_id")

    if not isinstance(customer_id, str) or not customer_id.strip():
        raise NessieDataError("Nessie returned a customer without an id.")

    return NessieCustomer(
        id=customer_id.strip(),
        first_name=_optional_text(record, "first_name", secret),
        last_name=_optional_text(record, "last_name", secret),
    )


def normalize_account(record: dict[str, Any], *, secret: str = "") -> NessieAccount:
    """Map one Nessie account. The account number is ignored if Nessie sent one."""

    account_id = record.get("_id")

    if not isinstance(account_id, str) or not account_id.strip():
        raise NessieDataError("Nessie returned an account without an id.")

    if "balance" not in record or record.get("balance") is None:
        raise NessieDataError("Nessie returned an account without a balance.")

    raw_type = record.get("type")
    mapped = _ACCOUNT_TYPES.get(raw_type.strip().lower()) if isinstance(raw_type, str) else None

    if mapped is None:
        raise NessieDataError("Nessie returned an account type FinTwin does not recognize.")

    customer_id = record.get("customer_id")

    return NessieAccount(
        id=account_id.strip(),
        type=mapped,
        nickname=_optional_text(record, "nickname", secret),
        balance_cents=dollars_to_cents(_as_decimal(record["balance"], field="balance")),
        customer_id=customer_id.strip() if isinstance(customer_id, str) and customer_id.strip() else None,
    )


def normalize_transaction(
    record: dict[str, Any],
    *,
    account_id: str,
    source_type: SourceType,
    secret: str = "",
) -> NessieTransaction:
    transaction_id = record.get("_id")

    if not isinstance(transaction_id, str) or not transaction_id.strip():
        raise NessieDataError("Nessie returned a transaction without an id.")

    if "amount" not in record or record.get("amount") is None:
        raise NessieDataError("Nessie returned a transaction without an amount.")

    cents = abs(dollars_to_cents(_as_decimal(record["amount"], field="amount")))

    if source_type != "deposit":
        cents = -cents

    status = record.get("status")

    return NessieTransaction(
        id=transaction_id.strip(),
        account_id=account_id,
        date=_calendar_date(record.get(_DATE_FIELDS[source_type])),
        amount_cents=cents,
        category=None,
        source_type=source_type,
        description=_optional_text(record, "description", secret),
        status=status.strip() if isinstance(status, str) and status.strip() else None,
    )


def merge_transactions(transactions: list[NessieTransaction]) -> list[NessieTransaction]:
    """Drop duplicates and return a stable chronological list.

    Identity is `(sourceType, id)`. A purchase and a deposit that happened to
    share an id are different events. Repeating the same purchase keeps the
    first copy. The account balance is not modified.
    """

    seen: set[tuple[str, str]] = set()
    unique: list[NessieTransaction] = []

    for transaction in transactions:
        key = (transaction.source_type, transaction.id)

        if key in seen:
            continue

        seen.add(key)
        unique.append(transaction)

    unique.sort(key=lambda item: (item.date is None, item.date or "", item.source_type, item.id))
    return unique
