"use client";

import { CircleAlert, CircleDot, TriangleAlert } from "lucide-react";

import {
  SimulatedBadge,
  SimulationDisclaimer,
  SourceTag,
} from "@/components/shared/disclosure-badges";
import { ModelWarnings } from "@/components/simulation/model-inputs";
import { SimulationError, SimulationRunning } from "@/components/simulation/simulation-states";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSimulation } from "@/hooks/use-simulation";
import { formatProbability } from "@/lib/formatters";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { RiskDriver } from "@/simulation/types";

const toneIcon: Record<RiskDriver["tone"], typeof CircleDot> = {
  neutral: CircleDot,
  caution: CircleAlert,
  risk: TriangleAlert,
};

const toneColor: Record<RiskDriver["tone"], string> = {
  neutral: "text-muted-foreground",
  caution: "text-warning",
  risk: "text-risk",
};

/** Forward-looking risk from the simulation, and what drives it. */
export function SimulatedRisk() {
  const { data: result, input, error, retry } = useSimulation();

  return (
    <Card className="[--card-spacing:--spacing(5)]">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          Risk over the next {input.horizonDays} days
          <SimulatedBadge pathCount={input.pathCount} />
        </CardTitle>
        <CardDescription>
          How often simulated futures dip below your protected minimum, and what
          drives it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {error ? (
          <SimulationError error={error} onRetry={retry} />
        ) : !result ? (
          <div className="space-y-3">
            <SimulationRunning pathCount={input.pathCount} />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Figure
                label="Chance of staying above your minimum"
                value={formatProbability(result.safety.safetyProbability)}
              />
              <Figure
                label="Chance of dipping below it"
                value={formatProbability(result.safety.breachProbability)}
                tone={
                  result.safety.breachProbability > 1 - result.targetConfidence ? "risk" : undefined
                }
              />
              <Figure
                label="Lowest balance, bad case (5th percentile)"
                value={formatCents(result.risk.minimumBalanceP5Cents)}
              />
              <Figure
                label="Ends above your minimum"
                value={formatProbability(result.safety.endingAboveMinimumProbability)}
                note="Higher than the chance of staying above it: some futures dip below and recover, and those still count as unsafe."
              />
            </dl>

            <ul className="divide-y divide-border/60">
              {result.risk.drivers.map((driver) => {
                const Icon = toneIcon[driver.tone];

                return (
                  <li key={driver.id} className="flex items-start gap-3 py-3">
                    <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", toneColor[driver.tone])} />
                    <div className="min-w-0 space-y-1">
                      <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
                        {driver.title}
                        <SourceTag source={driver.source} />
                      </p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{driver.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <ModelWarnings warnings={result.warnings} />
          </>
        )}
        <SimulationDisclaimer />
      </CardContent>
    </Card>
  );
}

function Figure({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "risk";
}) {
  return (
    <div className="space-y-1 rounded-lg bg-muted/40 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "tabular-figures font-heading text-xl font-semibold tracking-tight",
          tone === "risk" && "text-risk",
        )}
      >
        {value}
      </dd>
      {note ? <p className="text-[11px] leading-relaxed text-muted-foreground">{note}</p> : null}
    </div>
  );
}
