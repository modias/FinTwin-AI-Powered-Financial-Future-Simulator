"use client";

import { ArrowDownRight, CalendarClock, ShieldCheck, TriangleAlert } from "lucide-react";

import { SourceTag } from "@/components/shared/disclosure-badges";
import { MetricCard, MetricCardSkeleton } from "@/components/shared/metric-card";
import { useFinancialSummary } from "@/hooks/use-financial-data";
import { useSimulation } from "@/hooks/use-simulation";
import { formatMediumDate } from "@/lib/dates";
import { formatCurrency, formatProbability } from "@/lib/formatters";
import { formatCents } from "@/lib/money";

const pathCountFormatter = new Intl.NumberFormat("en-US");

/**
 * Headline figures under the hero card: three from the simulation and one
 * from the schedule, each labelled with where it comes from.
 */
export function FinancialSummaryCards() {
  const { data: result } = useSimulation();
  const { data: summary } = useFinancialSummary();

  if (!result || !summary) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <MetricCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  const { safety, risk } = result;
  const target = Math.round(result.targetConfidence * 100);
  const meetsTarget = safety.safePaths >= result.safeToSpend.requiredSafePaths;
  const paths = pathCountFormatter.format(result.pathCount);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Financial safety"
        value={formatProbability(safety.safetyProbability)}
        hint={`Simulated futures that never drop below ${formatCents(
          result.protectedMinimumCents,
        )} in the next ${result.horizonDays} days. ${
          meetsTarget ? "Meets" : "Below"
        } your ${target}% target.`}
        icon={ShieldCheck}
        tone={meetsTarget ? "positive" : "risk"}
        badge={<SourceTag source="simulated" />}
      />

      <MetricCard
        label="Chance of dipping below your minimum"
        value={formatProbability(safety.breachProbability)}
        hint={
          risk.medianFirstBreach
            ? `Of ${paths} simulations. When it happens, typically first around ${formatMediumDate(
                risk.medianFirstBreach.date,
              )}.`
            : `None of the ${paths} simulations dipped below it.`
        }
        icon={TriangleAlert}
        tone={safety.breachProbability > 1 - result.targetConfidence ? "risk" : "neutral"}
        badge={<SourceTag source="simulated" />}
      />

      <MetricCard
        label="Lowest balance, bad case"
        value={formatCents(risk.minimumBalanceP5Cents)}
        hint={`In the worst 5% of simulations, the balance falls to this or lower at some point. Median low point: ${formatCents(
          risk.medianMinimumBalanceCents,
        )}.`}
        icon={ArrowDownRight}
        tone={risk.minimumBalanceP5Cents < result.protectedMinimumCents ? "warning" : "neutral"}
        badge={<SourceTag source="simulated" />}
      />

      <MetricCard
        label="Upcoming bills"
        value={formatCurrency(summary.upcomingBillsTotal)}
        hint={`${summary.upcomingBillsCount} scheduled ${
          summary.upcomingBillsCount === 1 ? "bill" : "bills"
        } in the next ${summary.upcomingWindowDays} days${
          summary.nextIncomeDate ? ` · next income ${formatMediumDate(summary.nextIncomeDate)}` : ""
        }`}
        icon={CalendarClock}
        tone="warning"
        badge={<SourceTag source="scheduled" />}
      />
    </div>
  );
}
