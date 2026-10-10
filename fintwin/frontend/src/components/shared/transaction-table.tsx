"use client";

import { Receipt } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { categoryIcons } from "@/lib/category-visuals";
import { formatMediumDate } from "@/lib/dates";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types/financial";

interface TransactionTableProps {
  transactions: Transaction[] | undefined;
  isPending: boolean;
  /** Hides the category and type columns on narrow dashboard cards. */
  variant?: "compact" | "full";
  emptyTitle?: string;
  emptyDescription?: string;
}

/**
 * Shared transaction table, used by both the dashboard card and the
 * Transaction History page so the two always render a transaction identically.
 */
export function TransactionTable({
  transactions,
  isPending,
  variant = "full",
  emptyTitle = "No transactions found",
  emptyDescription = "Try a different search term or category filter.",
}: TransactionTableProps) {
  if (isPending && !transactions) {
    return <TableSkeleton rows={variant === "compact" ? 5 : 8} />;
  }

  if (!transactions || transactions.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Merchant</TableHead>
            <TableHead className={variant === "compact" ? "hidden sm:table-cell" : ""}>
              Category
            </TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead
              className={cn(
                "text-right",
                variant === "compact" && "hidden md:table-cell",
              )}
            >
              Type
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => {
            const Icon = categoryIcons[transaction.category];
            const isCredit = transaction.type === "credit";

            return (
              <TableRow key={transaction.id}>
                <TableCell>
                  <span className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon aria-hidden className="size-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">
                        {transaction.merchant}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {transaction.description}
                      </span>
                    </span>
                  </span>
                </TableCell>
                <TableCell
                  className={variant === "compact" ? "hidden sm:table-cell" : ""}
                >
                  <span className="text-[13px] text-muted-foreground">
                    {transaction.category}
                  </span>
                </TableCell>
                <TableCell className="text-[13px] whitespace-nowrap text-muted-foreground">
                  {formatMediumDate(transaction.date)}
                </TableCell>
                <TableCell
                  className={cn(
                    "tabular-figures text-right text-[13px] font-medium whitespace-nowrap",
                    isCredit && "text-success",
                  )}
                >
                  {isCredit ? "+" : "\u2212"}
                  {formatCurrency(transaction.amount)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right",
                    variant === "compact" && "hidden md:table-cell",
                  )}
                >
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      isCredit
                        ? "border-success/30 text-success"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {isCredit ? "Credit" : "Debit"}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
