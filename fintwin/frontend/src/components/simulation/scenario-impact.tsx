"use client";

import { ArrowRight, CircleCheck, CircleX, TriangleAlert } from "lucide-react";

import { SourceTag } from "@/components/shared/disclosure-badges";
import {
  BAND_EXPLANATION,
  PercentileChart,
  PercentileLegend,
} from "@/components/simulation/percentile-chart";
import { Badge } from "@/components/ui/badge";
import { formatMediumDate } from "@/lib/dates";
import { formatPointChange, formatProbability } from "@/lib/formatters";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { describeScenario } from "@/simulation/scenarios";
import type { SafeToSpendResult, ScenarioResult, SimulationResult } from "@/simulation/types";

const pathCountFormatter = new Intl.NumberFormat("en-US");

export function safeToSpendText(result: SafeToSpendResult): string {
  return result.status === "meets_target" ? formatCents(result.amountCents) : "$0";
}

function verdict(baseline: SimulationResult, scenario: ScenarioResult): string {
  const target = Math.round(baseline.targetConfidence * 100);
  const minimum = formatCents(baseline.protectedMinimumCents);
  const after = formatProbability(scenario.safety.safetyProbability);
  const { type, amountCents, effectiveDate } = scenario.scenario;
  const extra =
    type === "one_time_purchase" &&
    effectiveDate === baseline.referenceDate &&
    baseline.safeToSpend.status === "meets_target" &&
    amountCents > baseline.safeToSpend.amountCents
      ? ` That’s ${formatCents(amountCents - baseline.safeToSpend.amountCents)} more than your safe-to-spend of ${formatCents(
          baseline.safeToSpend.amountCents,
        )}.`
      : "";

  return scenario.meetsTarget
    ? `With this change, your balance stays above ${minimum} in ${after} of simulated futures — still meeting your ${target}% target.${extra}`
    : `With this change, your balance stays above ${minimum} in only ${after} of simulated futures — below your ${target}% target.${extra}`;
}

/** The headline before → after for one scenario against the baseline. */
export function ScenarioImpact({
  baseline,
  scenario,
}: {
  baseline: SimulationResult;
  scenario: ScenarioResult;
}) {
  const target = Math.round(baseline.targetConfidence * 100);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <SourceTag source="hypothetical" />
          <p className="text-sm font-medium">{scenario.scenario.description}</p>
          <span className="text-xs text-muted-foreground">· {describeScenario(scenario.scenario)}</span>
        </div>

        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <div>
            <p className="text-xs text-muted-foreground">Chance of staying safe</p>
            <p className="tabular-figures font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              <span className="text-muted-foreground">
                {formatProbability(baseline.safety.safetyProbability)}
              </span>
              <ArrowRight aria-label="becomes" className="mx-2 inline size-6 align-middle text-muted-foreground" />
              <span className={scenario.meetsTarget ? "text-foreground" : "text-risk"}>
                {formatProbability(scenario.safety.safetyProbability)}
              </span>
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "mb-1.5 gap-1",
              scenario.safetyChangePoints < 0 ? "border-risk/30 text-risk" : "border-success/30 text-success",
            )}
          >
            {formatPointChange(scenario.safetyChangePoints)}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "mb-1.5 gap-1",
              scenario.meetsTarget ? "border-success/30 text-success" : "border-risk/30 text-risk",
            )}
          >
            {scenario.meetsTarget ? <CircleCheck aria-hidden /> : <CircleX aria-hidden />}
            {scenario.meetsTarget ? `Meets your ${target}% target` : `Below your ${target}% target`}
          </Badge>
        </div>

        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {verdict(baseline, scenario)}
        </p>

        {scenario.warnings.map((warning) => (
          <p
            key={warning}
            className="flex items-start gap-2 rounded-lg bg-warning/8 p-3 text-xs leading-relaxed text-muted-foreground"
          >
            <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0 text-warning" />
            {warning}
          </p>
        ))}
      </div>

      <BeforeAfterTable baseline={baseline} scenarios={[scenario]} />

      <div className="space-y-3">
        <PercentileLegend withScenario />
        <PercentileChart
          bands={baseline.forecast}
          scenarioBands={scenario.forecast}
          protectedMinimumCents={baseline.protectedMinimumCents}
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          {BAND_EXPLANATION} Before and after use the same{" "}
          {pathCountFormatter.format(baseline.pathCount)} simulated futures, so the difference comes
          from this change alone, not from random noise.
        </p>
      </div>
    </div>
  );
}

interface Row {
  label: string;
  baseline: string;
  values: { text: string; tone?: "risk" | "positive" }[];
}

/** Baseline and up to three scenarios side by side, on the same simulated paths. */
export function BeforeAfterTable({
  baseline,
  scenarios,
  headers,
}: {
  baseline: SimulationResult;
  scenarios: ScenarioResult[];
  headers?: string[];
}) {
  const required = baseline.safeToSpend.requiredSafePaths;
  const rows: Row[] = [
    {
      label: "Chance of staying safe",
      baseline: formatProbability(baseline.safety.safetyProbability),
      values: scenarios.map((scenario) => ({
        text: `${formatProbability(scenario.safety.safetyProbability)} (${formatPointChange(
          scenario.safetyChangePoints,
        )})`,
        tone: scenario.safety.safePaths >= required ? undefined : "risk",
      })),
    },
    {
      label: "Chance of dipping below your minimum",
      baseline: formatProbability(baseline.safety.breachProbability),
      values: scenarios.map((scenario) => ({
        text: formatProbability(scenario.safety.breachProbability),
      })),
    },
    {
      label: "Meets your target",
      baseline: baseline.safety.safePaths >= required ? "Yes" : "No",
      values: scenarios.map((scenario) => ({
        text: scenario.meetsTarget ? "Yes" : "No",
        tone: scenario.meetsTarget ? "positive" : "risk",
      })),
    },
    {
      label: "Safe to spend today",
      baseline: safeToSpendText(baseline.safeToSpend),
      values: scenarios.map((scenario) => ({ text: safeToSpendText(scenario.safeToSpendAfter) })),
    },
    {
      label: `Median balance in ${baseline.horizonDays} days`,
      baseline: formatCents(baseline.risk.medianEndingBalanceCents),
      values: scenarios.map((scenario) => ({ text: formatCents(scenario.medianEndingBalanceCents) })),
    },
    {
      label: "Lowest balance, bad case (5th percentile)",
      baseline: formatCents(baseline.risk.minimumBalanceP5Cents),
      values: scenarios.map((scenario) => ({
        text: formatCents(scenario.minimumBalanceP5Cents),
        tone: scenario.minimumBalanceP5Cents < baseline.protectedMinimumCents ? "risk" : undefined,
      })),
    },
    {
      label: "Tightest day",
      baseline: formatMediumDate(baseline.risk.tightestDay.date),
      values: scenarios.map((scenario) => ({ text: formatMediumDate(scenario.tightestDay.date) })),
    },
  ];
  const columnHeaders = headers ?? scenarios.map(() => "With this change");

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th scope="col" className="py-2 pr-4 font-medium">
              <span className="sr-only">Measure</span>
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Today&rsquo;s plan
            </th>
            {columnHeaders.map((header, index) => (
              <th key={`${header}-${index}`} scope="col" className="py-2 pr-4 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-border/60 last:border-0">
              <th scope="row" className="py-2.5 pr-4 text-xs font-normal text-muted-foreground">
                {row.label}
              </th>
              <td className="tabular-figures py-2.5 pr-4 font-medium">{row.baseline}</td>
              {row.values.map((value, index) => (
                <td
                  key={index}
                  className={cn(
                    "tabular-figures py-2.5 pr-4 font-medium",
                    value.tone === "risk" && "text-risk",
                    value.tone === "positive" && "text-success",
                  )}
                >
                  {value.text}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
