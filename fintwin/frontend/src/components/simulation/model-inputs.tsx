"use client";

import { AlertTriangle } from "lucide-react";

import { SourceTag, type FigureSource } from "@/components/shared/disclosure-badges";
import { formatMediumDate } from "@/lib/dates";
import { formatPercent } from "@/lib/formatters";
import { formatCents } from "@/lib/money";
import type { ModelWarning, SimulationResult, SpendingKindAssumptions } from "@/simulation/types";

const pathCountFormatter = new Intl.NumberFormat("en-US");

function variationText(assumptions: SpendingKindAssumptions): string {
  const weekly = formatPercent(assumptions.weeklyVariation * 100, 0);

  if (assumptions.basis === "transaction_history" && assumptions.history) {
    return `±${weekly} weekly, from ${assumptions.history.weeks} weeks of history`;
  }

  return `±${weekly} weekly (default)`;
}

interface InputRow {
  label: string;
  value: string;
  detail: string;
  source: FigureSource;
}

/**
 * Every input behind a result, labelled by where it comes from: what the user
 * entered, what is scheduled, what is estimated, what is measured from
 * history, and what is simply assumed.
 */
export function ModelInputs({
  result,
  isDemo,
}: {
  result: SimulationResult;
  isDemo: boolean;
}) {
  const { totals, spendingModel, emergencies } = result;
  const rows: InputRow[] = [
    {
      label: "Starting balance",
      value: formatCents(result.openingBalanceCents),
      detail: isDemo
        ? `Demo balance on ${formatMediumDate(result.referenceDate)}.`
        : `Entered on ${formatMediumDate(result.referenceDate)}.`,
      source: isDemo ? "historical" : "user_entered",
    },
    {
      label: "Income",
      value: formatCents(totals.scheduledIncomeCents),
      detail: `${totals.scheduledIncomeCount} ${
        totals.scheduledIncomeCount === 1 ? "payment" : "payments"
      }, fixed.`,
      source: "scheduled",
    },
    {
      label: "Bills",
      value: formatCents(totals.scheduledBillsCents),
      detail: `${totals.scheduledBillsCount} ${
        totals.scheduledBillsCount === 1 ? "bill" : "bills"
      }, fixed.`,
      source: "scheduled",
    },
    {
      label: "Essential spending",
      value: formatCents(totals.expectedEssentialCents),
      detail: `Expected total, ${variationText(spendingModel.essential)}.`,
      source: spendingModel.essential.basis === "transaction_history" ? "historical" : "estimated",
    },
    {
      label: "Discretionary spending",
      value: formatCents(totals.expectedDiscretionaryCents),
      detail: `Expected total, ${variationText(spendingModel.discretionary)}.`,
      source:
        spendingModel.discretionary.basis === "transaction_history" ? "historical" : "estimated",
    },
    emergencies
      ? {
          label: "Unexpected expenses",
          value: `~${emergencies.eventsPerYear} a year`,
          detail: `Avg ${formatCents(emergencies.meanCostCents)}, max ${formatCents(
            emergencies.maxCostCents,
          )}.`,
          source: "assumption",
        }
      : {
          label: "Unexpected expenses",
          value: "Off",
          detail: "Turned off in Settings. Results are more optimistic.",
          source: "assumption",
        },
    {
      label: "Simulations",
      value: pathCountFormatter.format(result.pathCount),
      detail: `Futures over ${result.horizonDays} days.`,
      source: "simulated",
    },
  ];

  return (
    <dl className="divide-y divide-border/60">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-6 py-2.5">
          <div className="min-w-0 space-y-0.5">
            <dt className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
              {row.label}
              <SourceTag source={row.source} />
            </dt>
            <dd className="text-xs leading-relaxed text-muted-foreground">{row.detail}</dd>
          </div>
          <span className="tabular-figures shrink-0 text-[13px] font-medium">{row.value}</span>
        </div>
      ))}
    </dl>
  );
}

export function ModelWarnings({ warnings }: { warnings: ModelWarning[] }) {
  if (warnings.length === 0) return null;

  return (
    <ul className="space-y-2">
      {warnings.map((warning) => (
        <li
          key={warning.code}
          className="flex items-start gap-2 rounded-lg bg-warning/8 p-3 text-xs leading-relaxed text-muted-foreground"
        >
          <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0 text-warning" />
          {warning.message}
        </li>
      ))}
    </ul>
  );
}
