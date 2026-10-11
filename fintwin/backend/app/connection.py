"""Format the command-line Nessie connection check. Prints no secrets."""

import asyncio

from app.config import Settings, load_settings
from app.models.nessie import NessieCustomer, customer_display_name
from app.services.nessie_client import NessieClient, NessieError

MISSING_KEY_MESSAGE = """NESSIE_API_KEY is missing.

Add your Nessie API key to backend/.env
and rerun the connection test."""

_PREVIEW_LIMIT = 3


def format_success(customers: list[NessieCustomer]) -> str:
    lines = [
        "Testing Capital One Nessie connection...",
        "",
        "API Status: 200",
        "Connection: Successful",
        "",
        f"Customers found: {len(customers)}",
    ]

    preview = customers[:_PREVIEW_LIMIT]

    if preview:
        lines.append("")

        for index, customer in enumerate(preview, start=1):
            lines.append(f"Customer {index}: {customer_display_name(customer)} — {customer.id}")

    return "\n".join(lines)


def format_failure(message: str, upstream_status: int | None) -> str:
    status = "unavailable" if upstream_status is None else str(upstream_status)

    return "\n".join(
        [
            "Testing Capital One Nessie connection...",
            "",
            f"API Status: {status}",
            "Connection: Failed",
            "",
            message,
        ]
    )


async def run_check(settings: Settings) -> tuple[str, int]:
    """Return `(report, exit_code)`. A missing key never contacts Nessie."""

    if not settings.nessie_configured:
        return MISSING_KEY_MESSAGE, 1

    client = NessieClient(settings)

    try:
        customers = await client.get_customers()
    except NessieError as exc:
        return format_failure(exc.public_message, exc.upstream_status), 1
    finally:
        await client.aclose()

    return format_success(customers), 0


def main() -> int:
    report, code = asyncio.run(run_check(load_settings()))
    print(report)
    return code
