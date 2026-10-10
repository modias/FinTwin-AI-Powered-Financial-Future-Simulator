"use client";

import { Wallet } from "lucide-react";

import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccounts } from "@/hooks/use-financial-data";
import { formatAccountLabel, formatCurrency } from "@/lib/formatters";

/**
 * Switches the account the whole dashboard is scoped to.
 *
 * The selection lives in `WorkspaceProvider` and is part of every query key,
 * so changing it refetches the summary, forecast, events, spending breakdown
 * and transaction list together. With a single account there is nothing to
 * switch, so it renders as a plain label rather than a dropdown with one
 * option.
 */
export function AccountSelector() {
  const { selectedAccountId, setSelectedAccountId, dataset } = useActiveWorkspace();
  const { data: accounts } = useAccounts();

  const selected = accounts?.find((account) => account.id === selectedAccountId);

  if (!accounts || !selected) {
    return <Skeleton className="h-8 w-[168px] rounded-lg sm:w-[216px]" />;
  }

  const accountLabel = (
    <span className="flex min-w-0 items-center gap-2">
      <Wallet aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate text-[13px]">
        {selected.name}
        {selected.mask ? (
          <span className="hidden text-muted-foreground sm:inline">
            {" "}
            •••• {selected.mask}
          </span>
        ) : null}
      </span>
    </span>
  );

  if (accounts.length === 1) {
    return (
      <div
        className="flex h-8 max-w-[216px] items-center rounded-lg border border-input px-2.5"
        aria-label={`Account: ${selected.name}`}
      >
        {accountLabel}
      </div>
    );
  }

  return (
    <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
      {/* The trigger renders its own label rather than <SelectValue> so the
          dropdown rows can show the balance without the trigger clamping it. */}
      <SelectTrigger
        className="h-8 w-[168px] sm:w-[216px]"
        aria-label={`${dataset.source === "demo" ? "Demo account" : "Account"}: ${selected.name}`}
      >
        {accountLabel}
      </SelectTrigger>
      <SelectContent align="end" position="popper" className="min-w-[260px]">
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.id} className="py-2">
            <span className="flex min-w-0 flex-col items-start gap-0.5">
              <span className="truncate text-[13px] font-medium">
                {formatAccountLabel(account.name, account.mask)}
              </span>
              <span className="tabular-figures text-xs text-muted-foreground">
                {formatCurrency(account.currentBalance)} · {account.institution}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
