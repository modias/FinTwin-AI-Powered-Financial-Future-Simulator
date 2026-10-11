"use client";

import { ArrowDownRight, TrendingUp } from "lucide-react";

import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import {
  Disclaimer,
  SimulatedBadge,
  SimulationDisclaimer,
} from "@/components/shared/disclosure-badges";
import { ChartSkeleton } from "@/components/shared/loading-skeleton";
import {
  BAND_EXPLANATION,
  PercentileChart,
  PercentileLegend,
} from "@/components/simulation/percentile-chart";
import { SimulationError, SimulationRunning } from "@/components/simulation/simulation-states";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSimulation } from "@/hooks/use-simulation";
import { FORECAST_HORIZONS } from "@/lib/constants";
import { formatMediumDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import type { ForecastHorizon } from "@/types/financial";

/**
 * The simulated balance forecast: each day's median and middle 80% across
 * every simulated path, against the protected minimum.
 *
 * The horizon comes from preferences, so the 30/60/90 toggle and the Settings
 * control write the same value, and changing it re-runs the simulation.
 */
export function ForecastChart() {
  const { preferences, updatePreferences } = useActiveWorkspace();
  const { data: result, input, error, retry } = useSimulation();

  return (
    <Card className="[--card-spacing:--spacing(5)]">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          Your Financial Future
          {result ? <SimulatedBadge pathCount={result.pathCount} /> : null}
        </CardTitle>
        <CardDescription>
          The range of balances across simulated futures, day by day.
        </CardDescription>
        <CardAction>
          <HorizonTabs
            value={preferences.forecastHorizonDays}
            onChange={(forecastHorizonDays) => updatePreferences({ forecastHorizonDays })}
          />
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-5">
        <PercentileLegend />

        {error ? (
          <SimulationError error={error} onRetry={retry} />
        ) : !result ? (
          <div className="relative h-[300px] sm:h-[340px]">
            <ChartSkeleton className="h-full" />
            <SimulationRunning pathCount={input.pathCount} className="absolute top-3 left-3" />
          </div>
        ) : (
          <PercentileChart
            bands={result.forecast}
            protectedMinimumCents={result.protectedMinimumCents}
          />
        )}

        <div className="flex flex-col gap-4 border-t border-border/60 pt-4 lg:flex-row lg:items-start lg:justify-between">
          {result ? (
            <dl className="flex flex-wrap gap-x-8 gap-y-3">
              <ForecastStat
                icon={ArrowDownRight}
                label="Tightest day (10th percentile)"
                value={formatCents(result.risk.tightestDay.p10Cents)}
                detail={formatMediumDate(result.risk.tightestDay.date)}
                tone={
                  result.risk.tightestDay.p10Cents < result.protectedMinimumCents
                    ? "risk"
                    : "neutral"
                }
              />
              <ForecastStat
                icon={TrendingUp}
                label={`Median in ${result.horizonDays} days`}
                value={formatCents(result.risk.medianEndingBalanceCents)}
                detail={formatMediumDate(result.forecast[result.forecast.length - 1].date)}
              />
            </dl>
          ) : (
            <div />
          )}

          <div className="max-w-md space-y-1.5 lg:text-right">
            <Disclaimer>{BAND_EXPLANATION}</Disclaimer>
            <SimulationDisclaimer />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HorizonTabs({
  value,
  onChange,
}: {
  value: ForecastHorizon;
  onChange: (horizon: ForecastHorizon) => void;
}) {
  return (
    <Tabs value={String(value)} onValueChange={(next) => onChange(Number(next) as ForecastHorizon)}>
      <TabsList aria-label="Forecast horizon">
        {FORECAST_HORIZONS.map((horizon) => (
          <TabsTrigger key={horizon} value={String(horizon)}>
            {horizon}d
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

function ForecastStat({
  icon: Icon,
  label,
  value,
  detail,
  tone = "neutral",
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "risk";
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon aria-hidden className="size-3.5" />
      </span>
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="tabular-figures text-sm font-medium">
          <span className={tone === "risk" ? "text-risk" : undefined}>{value}</span>
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">{detail}</span>
        </dd>
      </div>
    </div>
  );
}
