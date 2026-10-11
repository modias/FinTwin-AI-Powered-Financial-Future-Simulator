"""HTTP routes for the local Nessie sandbox.

These customer-listing routes are for hackathon development on localhost.
Do not expose them on a public deployment without authentication, authorization,
and a scope that limits each caller to their own customer.
"""

from fastapi import APIRouter, Depends, HTTPException, Request

from app.models.nessie import NessieAccount, NessieCustomer, NessieTransaction
from app.services.nessie_client import NessieClient, NessieError, validate_nessie_id

router = APIRouter(prefix="/api/nessie", tags=["nessie"])


def get_nessie_client(request: Request) -> NessieClient:
    """The process-wide client created in the application lifespan. Tests override this."""

    client = getattr(request.app.state, "nessie", None)

    if not isinstance(client, NessieClient):
        raise HTTPException(status_code=503, detail="Nessie client is not configured.")

    return client


def _run(error: NessieError) -> HTTPException:
    # `from None` at the call site drops the traceback. The detail is a fixed sentence.
    return HTTPException(status_code=error.http_status, detail=error.public_message)


@router.get("/customers", response_model=list[NessieCustomer])
async def list_customers(client: NessieClient = Depends(get_nessie_client)) -> list[NessieCustomer]:
    try:
        return await client.get_customers()
    except NessieError as exc:
        raise _run(exc) from None


@router.get("/customers/{customer_id}", response_model=NessieCustomer)
async def get_customer(
    customer_id: str,
    client: NessieClient = Depends(get_nessie_client),
) -> NessieCustomer:
    try:
        validate_nessie_id(customer_id)
        return await client.get_customer(customer_id)
    except NessieError as exc:
        raise _run(exc) from None


@router.get("/customers/{customer_id}/accounts", response_model=list[NessieAccount])
async def list_accounts(
    customer_id: str,
    client: NessieClient = Depends(get_nessie_client),
) -> list[NessieAccount]:
    try:
        validate_nessie_id(customer_id)
        return await client.get_customer_accounts(customer_id)
    except NessieError as exc:
        raise _run(exc) from None


@router.get("/accounts/{account_id}", response_model=NessieAccount)
async def get_account(
    account_id: str,
    client: NessieClient = Depends(get_nessie_client),
) -> NessieAccount:
    try:
        validate_nessie_id(account_id)
        return await client.get_account(account_id)
    except NessieError as exc:
        raise _run(exc) from None


@router.get("/accounts/{account_id}/transactions", response_model=list[NessieTransaction])
async def list_transactions(
    account_id: str,
    client: NessieClient = Depends(get_nessie_client),
) -> list[NessieTransaction]:
    """Purchases, deposits, and withdrawals for one account. Empty lists are valid."""

    try:
        validate_nessie_id(account_id)
        return await client.get_account_transactions(account_id)
    except NessieError as exc:
        raise _run(exc) from None
