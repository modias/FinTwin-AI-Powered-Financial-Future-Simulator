/**
 * Reads Capital One Nessie sandbox data through the local FastAPI backend.
 *
 * The browser only learns `NEXT_PUBLIC_API_BASE_URL`. The Nessie API key stays
 * in `backend/.env` and is never part of these requests.
 *
 * These records are not the onboarding profile and not the demo dataset.
 * `source: "nessie"` marks every account and transaction. Nothing here writes
 * the financial profile or the Monte Carlo inputs.
 */

import { API_BASE_URL } from "@/lib/constants";

export type NessieAccountType = "checking" | "savings" | "credit_card";

export type NessieTransactionType = "purchase" | "deposit" | "withdrawal";

export interface NessieCustomer {
  id: string;
  firstName: string | null;
  lastName: string | null;
}

export interface NessieAccount {
  id: string;
  type: NessieAccountType;
  nickname: string | null;
  balanceCents: number;
  customerId: string | null;
  source: "nessie";
}

/**
 * A normalized Nessie transaction.
 *
 * `amountCents` is signed cash flow: deposits are positive, purchases and
 * withdrawals are negative. `category` is null because Nessie does not put a
 * category on the transaction itself, and this client does not guess one.
 * A missing date stays null instead of being replaced with today.
 */
export interface NessieTransaction {
  id: string;
  accountId: string;
  date: string | null;
  amountCents: number;
  category: string | null;
  sourceType: NessieTransactionType;
  description: string | null;
  status: string | null;
  source: "nessie";
}

export class NessieRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "NessieRequestError";
    this.status = status;
  }
}

async function getJson<T>(path: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new NessieRequestError(
      "Could not reach the FinTwin backend. Start it on port 8000 and try again.",
      0,
    );
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const detail =
      body &&
      typeof body === "object" &&
      "detail" in body &&
      typeof body.detail === "string"
        ? body.detail
        : "The backend request failed.";

    throw new NessieRequestError(detail, response.status);
  }

  return response.json() as Promise<T>;
}

export function getNessieCustomers(): Promise<NessieCustomer[]> {
  return getJson("/api/nessie/customers");
}

export function getNessieCustomer(customerId: string): Promise<NessieCustomer> {
  return getJson(`/api/nessie/customers/${encodeURIComponent(customerId)}`);
}

export function getNessieCustomerAccounts(customerId: string): Promise<NessieAccount[]> {
  return getJson(`/api/nessie/customers/${encodeURIComponent(customerId)}/accounts`);
}

export function getNessieAccount(accountId: string): Promise<NessieAccount> {
  return getJson(`/api/nessie/accounts/${encodeURIComponent(accountId)}`);
}

export function getNessieAccountTransactions(
  accountId: string,
): Promise<NessieTransaction[]> {
  return getJson(`/api/nessie/accounts/${encodeURIComponent(accountId)}/transactions`);
}

export function nessieCustomerName(customer: NessieCustomer): string {
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ");

  return name || "(no name on file)";
}
