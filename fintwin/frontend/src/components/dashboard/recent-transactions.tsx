"use client";

import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { TransactionTable } from "@/components/shared/transaction-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTransactions } from "@/hooks/use-financial-data";

const RECENT_TRANSACTION_COUNT = 6;

export function RecentTransactions() {
  const { selectedAccountId, dataset } = useActiveWorkspace();
  const hasHistory = dataset.source === "demo";
  const { data: transactions, isPending } = useTransactions({
    accountId: selectedAccountId,
    limit: RECENT_TRANSACTION_COUNT,
  });

  if (!hasHistory) return null;

  return (
    <Card className="[--card-spacing:--spacing(5)]">
      <CardHeader>
        <CardTitle className="text-base">Recent transactions</CardTitle>
        <CardDescription>The latest activity on this account.</CardDescription>
      </CardHeader>

      <CardContent>
        <TransactionTable
          transactions={transactions}
          isPending={isPending}
          variant="compact"
          emptyTitle="No transactions yet"
          emptyDescription="This account has no transaction history in the demonstration dataset."
        />
      </CardContent>
    </Card>
  );
}
