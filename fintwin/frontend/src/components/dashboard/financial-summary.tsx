"use client";

import { CalendarClock, Shield, Waypoints, Wallet } from "lucide-react";

import { PhaseBadge } from "@/components/shared/disclosure-badges";
import {
  MetricCard,
  MetricCardSkeleton,
} from "@/components/shared/metric-card";
import { useFinancialSummary, useSelectedAccount } from "@/hooks/use-financial-data";
import { useSimulationConfig } from "@/hooks/use-simulation-config";
import { formatMediumDate } from "@/lib/dates";
import { formatAccountLabel, formatCurrency, formatPercent } from "@/lib/formatters";
import type { VolatilitySource } from "@/services/simulation";

function simulationHint(volatility: VolatilitySource): string {
  const base =
    "A probability of staying above your protected balance needs the Monte Carlo engine. FinTwin will not estimate one without it.";

  if (volatility.kind === "transaction_history") return base;

  return `${base} With no transaction history, it will start from default assumptions: everyday spending varying by about ${formatPercent(
    volatility.everydaySpendingVariation * 100,
    0,
  )} and a ${formatPercent(volatility.incomeDelayProbability * 100, 0)} chance of a late paycheck.`;
}

/**
 * The four headline figures under the hero card.
 *
 * The fourth, Financial Safety, is where a probability would go once the Monte
 * Carlo engine exists. Until then it reports its own absence rather than
 * showing a number nothing computed.
 */
export function FinancialSummaryCards() {
  const { data: summary, isPending } = useFinancialSummary();
  const account = useSelectedAccount();
  const simulationConfig = useSimulationConfig();

  if (isPending || !summary) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <MetricCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Current balance"
        value={formatCurrency(summary.currentBalance)}
        hint={
          account
            ? `${formatAccountLabel(account.name, account.mask)} · ${account.institution}`
            : undefined
        }
        icon={Wallet}
        tone="accent"
      />

      <MetricCard
        label="Protected minimum balance"
        value={formatCurrency(summary.protectedMinimumBalance)}
        hint="The floor FinTwin keeps out of every spending estimate. Adjustable in Settings."
        icon={Shield}
        tone="positive"
      />

      <MetricCard
        label="Upcoming bills"
        value={formatCurrency(summary.upcomingBillsTotal)}
        hint={`${summary.upcomingBillsCount} scheduled ${
          summary.upcomingBillsCount === 1 ? "bill" : "bills"
        } in the next ${summary.upcomingWindowDays} days${
          summary.nextIncomeDate
            ? ` · next income ${formatMediumDate(summary.nextIncomeDate)}`
            : ""
        }`}
        icon={CalendarClock}
        tone="warning"
      />

      <MetricCard
        label="Financial safety"
        value="Simulation not yet available"
        hint={simulationHint(simulationConfig.volatility)}
        icon={Waypoints}
        tone="neutral"
        isMuted
        badge={<PhaseBadge />}
      />
    </div>
  );
}
