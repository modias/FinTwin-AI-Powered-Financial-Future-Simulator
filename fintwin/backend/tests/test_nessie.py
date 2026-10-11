"""Nessie client, normalization, and HTTP routes. No live API key is required."""

import asyncio
import json
from decimal import Decimal

import httpx
import pytest
from fastapi.testclient import TestClient

from app.api.nessie import get_nessie_client
from app.config import Settings
from app.connection import MISSING_KEY_MESSAGE, format_success, run_check
from app.main import app
from app.models.nessie import (
    NessieCustomer,
    NessieDataError,
    NessieTransaction,
    dollars_to_cents,
    merge_transactions,
    normalize_account,
    normalize_transaction,
)
from app.services.nessie_client import (
    NessieAuthError,
    NessieClient,
    NessieNotConfigured,
    NessieNotFound,
    NessieTimeout,
)

SECRET = "unit-test-key-do-not-leak"


def _settings(api_key: str = SECRET) -> Settings:
    return Settings(api_key=api_key, base_url="https://api.nessieisreal.com", timeout_seconds=2)


def _client(handler: httpx.MockTransport | None = None, *, api_key: str = SECRET) -> NessieClient:
    transport = handler if isinstance(handler, httpx.MockTransport) else httpx.MockTransport(handler)
    http = httpx.AsyncClient(base_url="https://api.nessieisreal.com", transport=transport)
    return NessieClient(_settings(api_key), http=http)


def _run(awaitable):
    return asyncio.run(awaitable)


def test_missing_api_key_does_not_call_nessie():
    called = False

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal called
        called = True
        return httpx.Response(200, json=[])

    client = _client(handler, api_key="")

    with pytest.raises(NessieNotConfigured) as caught:
        _run(client.get_customers())

    assert called is False
    assert SECRET not in caught.value.public_message
    assert "key=" not in caught.value.public_message


def test_successful_customer_retrieval_sends_the_key_only_as_a_query_param():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["key"] == SECRET
        assert request.url.path == "/customers"
        return httpx.Response(
            200,
            json=[
                {"_id": "cust_1", "first_name": "Ada", "last_name": "Lovelace"},
                {"_id": "cust_2", "first_name": "Alan", "last_name": "Turing"},
            ],
        )

    customers = _run(_client(handler).get_customers())

    assert [customer.id for customer in customers] == ["cust_1", "cust_2"]
    assert customers[0].first_name == "Ada"
    assert SECRET not in customers[0].model_dump_json()


def test_empty_customer_list():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[])

    assert _run(_client(handler).get_customers()) == []


def test_invalid_customer_id_is_a_not_found_without_the_upstream_body():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"message": f"missing {SECRET}", "url": str(request.url)})

    with pytest.raises(NessieNotFound) as caught:
        _run(_client(handler).get_customer("missingcust"))

    assert SECRET not in caught.value.public_message
    assert "api.nessieisreal.com" not in caught.value.public_message
    assert "key=" not in caught.value.public_message


def test_authentication_failure_is_sanitized():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, text=f"invalid key {SECRET} at {request.url}")

    with pytest.raises(NessieAuthError) as caught:
        _run(_client(handler).get_customers())

    assert caught.value.public_message == "Nessie rejected the credentials."
    assert SECRET not in caught.value.public_message
    assert "key=" not in str(caught.value)


def test_upstream_timeout():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out waiting for Nessie", request=request)

    with pytest.raises(NessieTimeout) as caught:
        _run(_client(handler).get_customers())

    assert caught.value.public_message == "Nessie did not respond in time."
    assert SECRET not in caught.value.public_message


def test_dollars_to_cents_is_exact():
    assert dollars_to_cents(18000) == 1_800_000
    assert dollars_to_cents(Decimal("0.29")) == 29
    assert dollars_to_cents(Decimal("10.1")) == 1_010
    assert dollars_to_cents("12.345") == 1_235

    with pytest.raises(NessieDataError):
        dollars_to_cents(0.29)


def test_account_normalization_drops_the_account_number_and_keeps_types_apart():
    checking = normalize_account(
        {
            "_id": "acc_checking",
            "type": "Checking",
            "nickname": "My Checking",
            "balance": 18000,
            "rewards": 100,
            "customer_id": "cust_1",
            "account_number": "1234567890123456",
        }
    )
    savings = normalize_account(
        {
            "_id": "acc_savings",
            "type": "Savings",
            "nickname": "Rainy day",
            "balance": Decimal("50.25"),
            "customer_id": "cust_1",
        }
    )
    credit = normalize_account(
        {
            "_id": "acc_credit",
            "type": "Credit Card",
            "nickname": "Card",
            "balance": 200,
            "customer_id": "cust_1",
            "account_number": "9999000011112222",
        }
    )

    assert checking.balance_cents == 1_800_000
    assert checking.type == "checking"
    assert savings.balance_cents == 5_025
    assert savings.type == "savings"
    assert credit.type == "credit_card"
    assert credit.balance_cents == 20_000
    # Balances are not combined into cash.
    assert checking.balance_cents != checking.balance_cents + savings.balance_cents

    rendered = json.dumps(
        [
            checking.model_dump(by_alias=True),
            savings.model_dump(by_alias=True),
            credit.model_dump(by_alias=True),
        ]
    )
    assert "1234567890123456" not in rendered
    assert "9999000011112222" not in rendered
    assert "account_number" not in rendered
    assert "balanceCents" in rendered


def test_transaction_signs_and_missing_fields():
    purchase = normalize_transaction(
        {
            "_id": "pur_1",
            "amount": Decimal("20.5"),
            "purchase_date": "2026-10-01",
            "merchant_id": "mer_1",
            "status": "completed",
        },
        account_id="acc_checking",
        source_type="purchase",
    )
    deposit = normalize_transaction(
        {"_id": "dep_1", "amount": 1500, "transaction_date": "2026-10-02", "description": "Pay"},
        account_id="acc_checking",
        source_type="deposit",
    )
    withdrawal = normalize_transaction(
        {"_id": "wd_1", "amount": -40, "transaction_date": "not-a-date", "description": "   "},
        account_id="acc_checking",
        source_type="withdrawal",
    )

    assert purchase.amount_cents == -2_050
    assert purchase.category is None
    assert purchase.description is None
    assert purchase.date == "2026-10-01"
    assert "mer_1" not in purchase.model_dump_json()
    assert deposit.amount_cents == 150_000
    assert withdrawal.amount_cents == -4_000
    assert withdrawal.date is None
    assert withdrawal.description is None


def test_duplicate_transactions_are_dropped_without_touching_the_balance():
    first = normalize_transaction(
        {"_id": "pur_1", "amount": 10, "purchase_date": "2026-10-01", "description": "first"},
        account_id="acc_checking",
        source_type="purchase",
    )
    duplicate = normalize_transaction(
        {"_id": "pur_1", "amount": 99, "purchase_date": "2026-10-03", "description": "second"},
        account_id="acc_checking",
        source_type="purchase",
    )
    deposit = normalize_transaction(
        {"_id": "pur_1", "amount": 10, "transaction_date": "2026-10-02"},
        account_id="acc_checking",
        source_type="deposit",
    )
    balance = normalize_account(
        {"_id": "acc_checking", "type": "Checking", "balance": 18000, "nickname": "My Checking"}
    )

    merged = merge_transactions([first, duplicate, deposit])

    assert [(item.source_type, item.amount_cents) for item in merged] == [
        ("purchase", -1_000),
        ("deposit", 1_000),
    ]
    assert balance.balance_cents == 1_800_000


def test_description_cannot_carry_the_api_key():
    purchase = normalize_transaction(
        {
            "_id": "pur_1",
            "amount": 5,
            "purchase_date": "2026-10-01",
            "description": f"receipt {SECRET}",
        },
        account_id="acc_checking",
        source_type="purchase",
        secret=SECRET,
    )

    assert purchase.description == "receipt [redacted]"
    assert SECRET not in purchase.model_dump_json()


def test_transactions_endpoint_merges_the_three_nessie_collections():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["key"] == SECRET

        if request.url.path.endswith("/purchases"):
            return httpx.Response(
                200,
                json=[{"_id": "pur_1", "amount": 12, "purchase_date": "2026-10-04", "description": "Groceries"}],
            )

        if request.url.path.endswith("/deposits"):
            return httpx.Response(
                200,
                json=[{"_id": "dep_1", "amount": 100, "transaction_date": "2026-10-01"}],
            )

        if request.url.path.endswith("/withdrawals"):
            return httpx.Response(200, json=[])

        raise AssertionError(request.url.path)

    transactions = _run(_client(handler).get_account_transactions("acc_checking"))

    assert [item.source_type for item in transactions] == ["deposit", "purchase"]
    assert transactions[0].amount_cents == 10_000
    assert transactions[1].amount_cents == -1_200


def test_api_hides_upstream_failures_and_account_numbers():
    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path

        if path == "/customers":
            return httpx.Response(200, json=[{"_id": "cust_1", "first_name": "Ada", "last_name": "Lovelace"}])

        if path == "/customers/missingcust":
            return httpx.Response(404, text=f"nope {SECRET} {request.url}")

        if path == "/customers/cust_1/accounts":
            return httpx.Response(
                200,
                json=[
                    {
                        "_id": "acc_checking",
                        "type": "Checking",
                        "nickname": "My Checking",
                        "balance": 18000,
                        "account_number": "1234567890123456",
                        "customer_id": "cust_1",
                    }
                ],
            )

        if path == "/accounts/acc_checking/purchases":
            return httpx.Response(200, json=[])

        if path.endswith("/deposits") or path.endswith("/withdrawals"):
            return httpx.Response(200, json=[])

        return httpx.Response(500, text=SECRET)

    nessie = _client(handler)
    app.dependency_overrides[get_nessie_client] = lambda: nessie

    try:
        with TestClient(app) as client:
            health = client.get("/api/health")
            assert health.status_code == 200
            assert health.json() == {"status": "ok"}
            assert SECRET not in health.text

            customers = client.get("/api/nessie/customers")
            assert customers.status_code == 200
            assert customers.json() == [
                {"id": "cust_1", "firstName": "Ada", "lastName": "Lovelace"}
            ]

            missing = client.get("/api/nessie/customers/missingcust")
            assert missing.status_code == 404
            assert missing.json()["detail"] == "Nessie could not find that record."
            assert SECRET not in missing.text
            assert "key=" not in missing.text

            accounts = client.get("/api/nessie/customers/cust_1/accounts")
            assert accounts.status_code == 200
            body = accounts.json()
            assert body[0]["balanceCents"] == 1_800_000
            assert body[0]["type"] == "checking"
            assert body[0]["source"] == "nessie"
            assert "1234567890123456" not in accounts.text

            invalid = client.get("/api/nessie/accounts/bad!id")
            assert invalid.status_code == 400
            assert SECRET not in invalid.text

            empty = client.get("/api/nessie/accounts/acc_checking/transactions")
            assert empty.status_code == 200
            assert empty.json() == []

            docs = client.get("/docs")
            assert docs.status_code == 200
    finally:
        app.dependency_overrides.clear()
        _run(nessie.aclose())


def test_api_missing_key_and_timeout_do_not_echo_secrets():
    def refuse(request: httpx.Request) -> httpx.Response:
        raise AssertionError("Nessie was called without a key")

    unconfigured = _client(refuse, api_key="")
    app.dependency_overrides[get_nessie_client] = lambda: unconfigured

    try:
        with TestClient(app) as client:
            response = client.get("/api/nessie/customers")
            assert response.status_code == 503
            assert response.json()["detail"] == "NESSIE_API_KEY is not configured on the server."
            assert "key=" not in response.text
    finally:
        app.dependency_overrides.clear()

    def time_out(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout(f"timeout {SECRET} {request.url}", request=request)

    slow = _client(time_out)
    app.dependency_overrides[get_nessie_client] = lambda: slow

    try:
        with TestClient(app) as client:
            response = client.get("/api/nessie/customers")
            assert response.status_code == 504
            assert response.json()["detail"] == "Nessie did not respond in time."
            assert SECRET not in response.text
    finally:
        app.dependency_overrides.clear()
        _run(slow.aclose())


def test_connection_check_missing_key_and_success_report():
    report, code = _run(run_check(_settings("")))

    assert code == 1
    assert report == MISSING_KEY_MESSAGE
    assert SECRET not in report

    preview = format_success(
        [
            NessieCustomer(id="cust_1", first_name="Ada", last_name="Lovelace"),
            NessieCustomer(id="cust_2", first_name="Alan", last_name="Turing"),
            NessieCustomer(id="cust_3", first_name="Grace", last_name="Hopper"),
            NessieCustomer(id="cust_4", first_name="Katherine", last_name="Johnson"),
        ]
    )

    assert "API Status: 200" in preview
    assert "Customers found: 4" in preview
    assert "Customer 1: Ada Lovelace — cust_1" in preview
    assert "Customer 3: Grace Hopper — cust_3" in preview
    assert "cust_4" not in preview
    assert SECRET not in preview


def test_connection_check_empty_list_is_still_success():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[])

    # run_check builds its own client, so exercise the formatter and the client separately.
    customers = _run(_client(handler).get_customers())
    report = format_success(customers)

    assert customers == []
    assert "Customers found: 0" in report
    assert "Connection: Successful" in report


def test_merge_sort_is_stable_for_the_same_day():
    deposit = NessieTransaction(
        id="b",
        account_id="acc",
        date="2026-10-01",
        amount_cents=100,
        category=None,
        source_type="deposit",
        description=None,
        status=None,
    )
    purchase = deposit.model_copy(update={"id": "a", "source_type": "purchase", "amount_cents": -100})
    merged = merge_transactions([deposit, purchase])

    assert [item.source_type for item in merged] == ["deposit", "purchase"]
