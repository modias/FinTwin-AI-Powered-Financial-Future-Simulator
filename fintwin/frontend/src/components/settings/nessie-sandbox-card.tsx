"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { formatCents } from "@/lib/money";
import {
  getNessieCustomerAccounts,
  getNessieCustomers,
  nessieCustomerName,
  NessieRequestError,
  type NessieAccount,
  type NessieCustomer,
} from "@/services/nessie-service";

const ACCOUNT_LABEL = {
  checking: "Checking",
  savings: "Savings",
  credit_card: "Credit card",
} as const;

/**
 * Development-only look at the Nessie sandbox.
 *
 * Loading a customer displays their accounts. It does not write the onboarding
 * profile, switch off demo mode, or change the simulation's opening balance.
 * Credit-card balances are shown as debt, not as cash, and checking and
 * savings are never added together.
 */
export function NessieSandboxCard() {
  if (process.env.NODE_ENV !== "development") return null;

  return <NessieSandboxPanel />;
}

function NessieSandboxPanel() {
  const [customers, setCustomers] = useState<NessieCustomer[] | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [accounts, setAccounts] = useState<NessieAccount[] | null>(null);
  const [checkingId, setCheckingId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const checkingAccounts = (accounts ?? []).filter((account) => account.type === "checking");
  const selected =
    checkingAccounts.find((account) => account.id === checkingId) ?? checkingAccounts[0] ?? null;

  async function loadCustomers() {
    setLoadingCustomers(true);
    setError(null);

    try {
      const next = await getNessieCustomers();
      setCustomers(next);
      setCustomerId("");
      setAccounts(null);
      setCheckingId("");
    } catch (caught) {
      setCustomers(null);
      setError(caught instanceof NessieRequestError ? caught.message : "Could not load customers.");
    } finally {
      setLoadingCustomers(false);
    }
  }

  async function loadAccounts(nextCustomerId: string) {
    setCustomerId(nextCustomerId);
    setAccounts(null);
    setCheckingId("");

    if (!nextCustomerId) return;

    setLoadingAccounts(true);
    setError(null);

    try {
      const next = await getNessieCustomerAccounts(nextCustomerId);
      setAccounts(next);
      setCheckingId(next.find((account) => account.type === "checking")?.id ?? "");
    } catch (caught) {
      setError(caught instanceof NessieRequestError ? caught.message : "Could not load accounts.");
    } finally {
      setLoadingAccounts(false);
    }
  }

  return (
    <Card className="[--card-spacing:--spacing(5)]">
      <CardHeader>
        <CardTitle className="text-base">Capital One sandbox</CardTitle>
        <CardDescription>
          Development only. This reads sandbox customers from the local backend and does not
          change your financial profile or the simulation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button type="button" variant="outline" size="sm" onClick={() => void loadCustomers()} disabled={loadingCustomers}>
          {loadingCustomers ? "Loading customers…" : "Load sandbox customers"}
        </Button>

        {customers ? (
          <div className="space-y-1.5">
            <Label htmlFor="nessie-customer">Sandbox customer</Label>
            <select
              id="nessie-customer"
              className="h-8 w-full max-w-md rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={customerId}
              onChange={(event) => void loadAccounts(event.target.value)}
            >
              <option value="">
                {customers.length === 0 ? "No sandbox customers" : "Choose a customer"}
              </option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {nessieCustomerName(customer)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {loadingAccounts ? <p className="text-sm text-muted-foreground">Loading accounts…</p> : null}

        {accounts ? (
          <div className="space-y-3">
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">This customer has no accounts.</p>
            ) : (
              <ul className="space-y-2">
                {accounts.map((account) => (
                  <li key={account.id} className="flex items-start justify-between gap-4 text-sm">
                    <span>
                      <span className="font-medium">{account.nickname ?? "Untitled account"}</span>
                      <span className="text-muted-foreground"> · {ACCOUNT_LABEL[account.type]}</span>
                      {account.type === "credit_card" ? (
                        <span className="block text-xs text-muted-foreground">
                          Card balance is not available cash.
                        </span>
                      ) : null}
                    </span>
                    <span className="tabular-figures shrink-0">{formatCents(account.balanceCents)}</span>
                  </li>
                ))}
              </ul>
            )}

            {checkingAccounts.length > 1 ? (
              <div className="space-y-1.5">
                <Label htmlFor="nessie-checking">Checking account</Label>
                <select
                  id="nessie-checking"
                  className="h-8 w-full max-w-md rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  value={selected?.id ?? ""}
                  onChange={(event) => setCheckingId(event.target.value)}
                >
                  {checkingAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.nickname ?? "Checking"}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <p className="text-sm">
              {selected ? (
                <>
                  Checking balance:{" "}
                  <span className="tabular-figures font-medium">{formatCents(selected.balanceCents)}</span>
                </>
              ) : (
                <span className="text-muted-foreground">This customer has no checking account.</span>
              )}
            </p>
          </div>
        ) : null}

        {error ? <p className="text-sm text-risk">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
