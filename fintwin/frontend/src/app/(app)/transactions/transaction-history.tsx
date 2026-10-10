"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { DataSourceBadge } from "@/components/shared/data-source-badge";
import { NoHistoryNotice } from "@/components/shared/no-history-notice";
import { PageHeader } from "@/components/shared/page-header";
import { TransactionTable } from "@/components/shared/transaction-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccounts, useTransactions } from "@/hooks/use-financial-data";
import { signedTransactionAmount, sumBy } from "@/lib/calculations";
import { formatCurrency } from "@/lib/formatters";
import { TRANSACTION_CATEGORIES, type TransactionCategory } from "@/types/financial";

type CategoryFilter = TransactionCategory | "all";
type AccountScope = string | "all";

/**
 * The full transaction dataset with search and category filtering.
 *
 * A personal profile has no history, and the demo's transactions are never
 * shown in its place, so it gets an explanation instead of an empty table.
 */
export function TransactionHistory() {
  const { dataset } = useActiveWorkspace();

  if (dataset.source !== "demo") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Transaction History"
          description="Settled transactions for your account."
          actions={<DataSourceBadge />}
        />
        <NoHistoryNotice />
      </div>
    );
  }

  return <DemoTransactionHistory />;
}

/**
 * Filtering runs through the service's `TransactionQuery` rather than in the
 * component, so the same query shape works unchanged when the list is served by
 * the backend and the filtering moves into SQL.
 */
function DemoTransactionHistory() {
  const { selectedAccountId } = useActiveWorkspace();
  const { data: accounts } = useAccounts();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [scope, setScope] = useState<AccountScope>("selected");

  const accountId = scope === "all" ? undefined : selectedAccountId;

  const { data: transactions, isPending } = useTransactions({
    accountId,
    search: search.trim() || undefined,
    category,
  });

  const totals = useMemo(() => {
    if (!transactions) return null;

    return {
      count: transactions.length,
      net: sumBy(transactions, signedTransactionAmount),
      debits: sumBy(
        transactions.filter((transaction) => transaction.type === "debit"),
        (transaction) => transaction.amount,
      ),
      credits: sumBy(
        transactions.filter((transaction) => transaction.type === "credit"),
        (transaction) => transaction.amount,
      ),
    };
  }, [transactions]);

  const isFiltered = search.trim().length > 0 || category !== "all";
  const scopeLabel =
    scope === "all"
      ? "all demonstration accounts"
      : (accounts?.find((account) => account.id === selectedAccountId)?.name ??
        "the selected account");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transaction History"
        description={`Every transaction FinTwin holds for ${scopeLabel}.`}
        actions={<DataSourceBadge />}
      />

      <Card className="[--card-spacing:--spacing(5)]">
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="transaction-search">Search</Label>
              <div className="relative">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="transaction-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Merchant, description or category"
                  className="pl-8"
                  autoComplete="off"
                />
                {search ? (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setSearch("")}
                    className="absolute top-1/2 right-1.5 -translate-y-1/2"
                  >
                    <X aria-hidden />
                    <span className="sr-only">Clear search</span>
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="transaction-category">Category</Label>
              <Select
                value={category}
                onValueChange={(next) => setCategory(next as CategoryFilter)}
              >
                <SelectTrigger
                  id="transaction-category"
                  className="w-full md:w-[176px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="all">All categories</SelectItem>
                  {TRANSACTION_CATEGORIES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="transaction-scope">Account</Label>
              <Select
                value={scope}
                onValueChange={(next) => setScope(next as AccountScope)}
              >
                <SelectTrigger
                  id="transaction-scope"
                  className="w-full md:w-[196px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="selected">Selected account</SelectItem>
                  <SelectItem value="all">All demo accounts</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {totals ? (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
              <span>
                <span className="tabular-figures text-foreground">
                  {totals.count}
                </span>{" "}
                {totals.count === 1 ? "transaction" : "transactions"}
              </span>
              <span>
                Money out{" "}
                <span className="tabular-figures text-foreground">
                  {formatCurrency(totals.debits)}
                </span>
              </span>
              <span>
                Money in{" "}
                <span className="tabular-figures text-success">
                  {formatCurrency(totals.credits)}
                </span>
              </span>
              <span>
                Net{" "}
                <span className="tabular-figures text-foreground">
                  {totals.net >= 0 ? "+" : "\u2212"}
                  {formatCurrency(Math.abs(totals.net))}
                </span>
              </span>
              {isFiltered ? (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setSearch("");
                    setCategory("all");
                  }}
                  className="ml-auto"
                >
                  <X aria-hidden />
                  Clear filters
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="[--card-spacing:--spacing(5)]">
        <CardContent>
          <TransactionTable
            transactions={transactions}
            isPending={isPending}
            emptyTitle={
              isFiltered ? "No matching transactions" : "No transactions"
            }
            emptyDescription={
              isFiltered
                ? "Nothing matches this search and category combination. Try clearing the filters."
                : "This account has no transactions in the demonstration dataset."
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
