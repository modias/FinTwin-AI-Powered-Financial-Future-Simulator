"""Async client for the Capital One Nessie sandbox.

Documented customer endpoints (key is a query parameter, never a header we log):

    GET /customers
    GET /customers/{id}
    GET /customers/{id}/accounts
    GET /accounts/{id}
    GET /accounts/{id}/purchases
    GET /accounts/{id}/deposits
    GET /accounts/{id}/withdrawals

Errors raised here carry a fixed public message. They do not include the
request URL, because that URL contains the API key.
"""

import json
import re
from collections.abc import Callable
from decimal import Decimal
from typing import Any, TypeVar

import httpx

from app.config import Settings
from app.models.nessie import (
    NessieAccount,
    NessieCustomer,
    NessieDataError,
    NessieTransaction,
    SourceType,
    merge_transactions,
    normalize_account,
    normalize_customer,
    normalize_transaction,
)

_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
T = TypeVar("T")


class NessieError(Exception):
    """A failure the API layer can show to a caller without leaking secrets."""

    def __init__(
        self,
        public_message: str,
        *,
        http_status: int,
        upstream_status: int | None = None,
    ) -> None:
        super().__init__(public_message)
        self.public_message = public_message
        self.http_status = http_status
        self.upstream_status = upstream_status


class NessieNotConfigured(NessieError):
    def __init__(self) -> None:
        super().__init__(
            "NESSIE_API_KEY is not configured on the server.",
            http_status=503,
        )


class NessieAuthError(NessieError):
    def __init__(self, upstream_status: int) -> None:
        super().__init__(
            "Nessie rejected the credentials.",
            http_status=502,
            upstream_status=upstream_status,
        )


class NessieNotFound(NessieError):
    def __init__(self) -> None:
        super().__init__(
            "Nessie could not find that record.",
            http_status=404,
            upstream_status=404,
        )


class NessieTimeout(NessieError):
    def __init__(self) -> None:
        super().__init__(
            "Nessie did not respond in time.",
            http_status=504,
        )


class NessieUnreachable(NessieError):
    def __init__(self) -> None:
        super().__init__(
            "Could not reach Nessie.",
            http_status=502,
        )


class NessieUpstreamError(NessieError):
    def __init__(self, upstream_status: int) -> None:
        super().__init__(
            f"Nessie returned an error (HTTP {upstream_status}).",
            http_status=502,
            upstream_status=upstream_status,
        )


class NessieResponseError(NessieError):
    def __init__(self, public_message: str) -> None:
        super().__init__(public_message, http_status=502)


def validate_nessie_id(value: str) -> str:
    """Reject path characters so an id cannot change which Nessie URL we call."""

    if not _ID_PATTERN.fullmatch(value):
        raise NessieError("That id is not valid.", http_status=400)

    return value


class NessieClient:
    def __init__(self, settings: Settings, http: httpx.AsyncClient | None = None) -> None:
        self._settings = settings
        self._owns_http = http is None
        self._http = http or httpx.AsyncClient(
            base_url=settings.base_url,
            timeout=settings.timeout_seconds,
        )

    async def aclose(self) -> None:
        if self._owns_http:
            await self._http.aclose()

    async def get_customers(self) -> list[NessieCustomer]:
        payload = await self._get_json("/customers")
        return [
            _normalize(lambda item=item: normalize_customer(item, secret=self._settings.api_key))
            for item in _as_list(payload)
        ]

    async def get_customer(self, customer_id: str) -> NessieCustomer:
        validate_nessie_id(customer_id)
        payload = await self._get_json(f"/customers/{customer_id}")
        return _normalize(lambda: normalize_customer(_as_object(payload), secret=self._settings.api_key))

    async def get_customer_accounts(self, customer_id: str) -> list[NessieAccount]:
        validate_nessie_id(customer_id)
        payload = await self._get_json(f"/customers/{customer_id}/accounts")
        return [
            _normalize(lambda item=item: normalize_account(item, secret=self._settings.api_key))
            for item in _as_list(payload)
        ]

    async def get_account(self, account_id: str) -> NessieAccount:
        validate_nessie_id(account_id)
        payload = await self._get_json(f"/accounts/{account_id}")
        return _normalize(lambda: normalize_account(_as_object(payload), secret=self._settings.api_key))

    async def get_account_purchases(self, account_id: str) -> list[NessieTransaction]:
        return await self._transactions(account_id, "purchases", "purchase")

    async def get_account_deposits(self, account_id: str) -> list[NessieTransaction]:
        return await self._transactions(account_id, "deposits", "deposit")

    async def get_account_withdrawals(self, account_id: str) -> list[NessieTransaction]:
        return await self._transactions(account_id, "withdrawals", "withdrawal")

    async def get_account_transactions(self, account_id: str) -> list[NessieTransaction]:
        """Purchases, deposits, and withdrawals, deduped. The balance is not changed."""

        validate_nessie_id(account_id)
        purchases = await self.get_account_purchases(account_id)
        deposits = await self.get_account_deposits(account_id)
        withdrawals = await self.get_account_withdrawals(account_id)
        return merge_transactions([*purchases, *deposits, *withdrawals])

    async def _transactions(
        self,
        account_id: str,
        collection: str,
        source_type: SourceType,
    ) -> list[NessieTransaction]:
        validate_nessie_id(account_id)
        payload = await self._get_json(f"/accounts/{account_id}/{collection}")
        return [
            _normalize(
                lambda item=item: normalize_transaction(
                    item,
                    account_id=account_id,
                    source_type=source_type,
                    secret=self._settings.api_key,
                )
            )
            for item in _as_list(payload)
        ]

    async def _get_json(self, path: str) -> Any:
        if not self._settings.api_key:
            raise NessieNotConfigured()

        try:
            response = await self._http.get(path, params={"key": self._settings.api_key})
        except httpx.TimeoutException:
            raise NessieTimeout() from None
        except httpx.RequestError:
            raise NessieUnreachable() from None

        if response.status_code in (401, 403):
            raise NessieAuthError(response.status_code)

        if response.status_code == 404:
            raise NessieNotFound()

        if response.status_code != 200:
            raise NessieUpstreamError(response.status_code)

        try:
            # parse_float keeps 0.29 exact. The default json loader would use float.
            return json.loads(response.text, parse_float=Decimal)
        except json.JSONDecodeError:
            raise NessieResponseError("Nessie returned a response that was not JSON.") from None


def _as_list(payload: Any) -> list[dict[str, Any]]:
    if not isinstance(payload, list):
        raise NessieResponseError("Nessie returned an unexpected list.")

    records: list[dict[str, Any]] = []

    for item in payload:
        if not isinstance(item, dict):
            raise NessieResponseError("Nessie returned an unexpected list.")

        records.append(item)

    return records


def _as_object(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise NessieResponseError("Nessie returned an unexpected record.")

    return payload


def _normalize(build: Callable[[], T]) -> T:
    try:
        return build()
    except NessieDataError as exc:
        raise NessieResponseError(str(exc)) from None
