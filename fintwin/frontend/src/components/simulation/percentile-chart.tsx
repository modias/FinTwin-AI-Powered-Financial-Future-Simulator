"use client";

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMediumDate, formatShortDate } from "@/lib/dates";
import { formatCompactCurrency } from "@/lib/formatters";
import { formatCents } from "@/lib/money";
import type { ForecastBand } from "@/simulation/types";

export const chartColors = {
  median: "var(--chart-1)",
  band: "var(--chart-1)",
  scenario: "var(--chart-2)",
  protected: "var(--success)",
};

interface ChartRow {
  date: string;
  dayIndex: number;
  /** Dollars; the 10th–90th percentile range. */
  range: [number, number];
  median: number;
  scenarioRange?: [number, number];
  scenarioMedian?: number;
  baseline: ForecastBand;
  scenario?: ForecastBand;
}

export const BAND_EXPLANATION =
  "The shaded band holds the middle 80% of simulated balances each day (10th to 90th percentile). It is not a 95% confidence interval, and real balances can fall outside it.";

/**
 * Daily balance percentiles across the simulated paths, with an optional
 * what-if drawn over the same days. Values come straight from the engine;
 * nothing here is computed or randomised at render time.
 */
export function PercentileChart({
  bands,
  protectedMinimumCents,
  scenarioBands,
  scenarioLabel = "With your what-if",
  className = "h-[300px] sm:h-[340px]",
}: {
  bands: ForecastBand[];
  protectedMinimumCents: number;
  scenarioBands?: ForecastBand[];
  scenarioLabel?: string;
  className?: string;
}) {
  const rows = useMemo<ChartRow[]>(
    () =>
      bands.map((band, index) => {
        const scenario = scenarioBands?.[index];

        return {
          date: band.date,
          dayIndex: band.dayIndex,
          range: [band.p10Cents / 100, band.p90Cents / 100],
          median: band.p50Cents / 100,
          ...(scenario
            ? {
                scenarioRange: [scenario.p10Cents / 100, scenario.p90Cents / 100] as [number, number],
                scenarioMedian: scenario.p50Cents / 100,
              }
            : {}),
          baseline: band,
          scenario,
        };
      }),
    [bands, scenarioBands],
  );

  const domain = useMemo(() => {
    const all = [...bands, ...(scenarioBands ?? [])];
    const low = Math.min(protectedMinimumCents, ...all.map((band) => band.p10Cents)) / 100;
    const high = Math.max(protectedMinimumCents, ...all.map((band) => band.p90Cents)) / 100;
    const padding = Math.max((high - low) * 0.1, 50);

    return [Math.floor(low - padding), Math.ceil(high + padding)] as [number, number];
  }, [bands, scenarioBands, protectedMinimumCents]);

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            minTickGap={44}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            dy={8}
          />
          <YAxis
            domain={domain}
            tickFormatter={formatCompactCurrency}
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            content={(props) => (
              <PercentileTooltip
                active={props.active}
                row={props.payload?.[0]?.payload as ChartRow | undefined}
                scenarioLabel={scenarioLabel}
              />
            )}
          />

          <Area
            type="monotone"
            dataKey="range"
            name="Middle 80% of simulated balances"
            stroke="none"
            fill={chartColors.band}
            fillOpacity={scenarioBands ? 0.1 : 0.16}
            isAnimationActive={false}
            activeDot={false}
          />
          {scenarioBands ? (
            <Area
              type="monotone"
              dataKey="scenarioRange"
              name={`${scenarioLabel}: middle 80%`}
              stroke="none"
              fill={chartColors.scenario}
              fillOpacity={0.14}
              isAnimationActive={false}
              activeDot={false}
            />
          ) : null}

          <Line
            type="monotone"
            dataKey="median"
            name="Median balance"
            stroke={chartColors.median}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: chartColors.median }}
            isAnimationActive={false}
          />
          {scenarioBands ? (
            <Line
              type="monotone"
              dataKey="scenarioMedian"
              name={`${scenarioLabel}: median`}
              stroke={chartColors.scenario}
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              activeDot={{
                r: 4,
                strokeWidth: 2,
                stroke: "var(--card)",
                fill: chartColors.scenario,
              }}
              isAnimationActive={false}
            />
          ) : null}

          <ReferenceLine
            y={protectedMinimumCents / 100}
            stroke={chartColors.protected}
            strokeDasharray="5 4"
            strokeWidth={1.5}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PercentileLegend({
  withScenario = false,
  scenarioLabel = "With your what-if",
}: {
  withScenario?: boolean;
  scenarioLabel?: string;
}) {
  const items = [
    { label: "Median balance", color: chartColors.median, shape: "line" },
    { label: "Middle 80% of simulated balances", color: chartColors.band, shape: "band" },
    ...(withScenario
      ? [{ label: `${scenarioLabel} (median and middle 80%)`, color: chartColors.scenario, shape: "dashed" }]
      : []),
    { label: "Protected minimum", color: chartColors.protected, shape: "dashed" },
  ];

  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            aria-hidden
            className={
              item.shape === "band"
                ? "h-2.5 w-4 rounded-sm opacity-30"
                : item.shape === "dashed"
                  ? "h-0 w-4 border-t-2 border-dashed"
                  : "h-0.5 w-4 rounded-full"
            }
            style={
              item.shape === "dashed"
                ? { borderColor: item.color }
                : { backgroundColor: item.color }
            }
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function PercentileTooltip({
  active,
  row,
  scenarioLabel,
}: {
  active?: boolean;
  row?: ChartRow;
  scenarioLabel: string;
}) {
  if (!active || !row) return null;

  const { baseline, scenario } = row;
  const events = [
    baseline.scheduledIncomeCents > 0
      ? { label: "Scheduled income", amount: `+${formatCents(baseline.scheduledIncomeCents)}` }
      : null,
    baseline.scheduledBillsCents > 0
      ? { label: "Scheduled bills", amount: `\u2212${formatCents(baseline.scheduledBillsCents)}` }
      : null,
    baseline.expectedSpendingCents > 0
      ? {
          label: "Expected everyday spending",
          amount: `\u2212${formatCents(baseline.expectedSpendingCents)}`,
        }
      : null,
    scenario && scenario.scenarioCents !== 0
      ? {
          label: "What-if change",
          amount: `${scenario.scenarioCents > 0 ? "+" : "\u2212"}${formatCents(Math.abs(scenario.scenarioCents))}`,
        }
      : null,
  ].filter((entry) => entry !== null);

  return (
    <div className="min-w-[220px] rounded-lg bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-foreground/10">
      <p className="text-xs text-muted-foreground">
        {formatMediumDate(row.date)} · day {row.dayIndex}
      </p>
      <p className="tabular-figures mt-1 font-heading text-base font-semibold">
        {formatCents(baseline.p50Cents)}
      </p>
      <p className="text-xs text-muted-foreground">
        Median · middle 80%{" "}
        <span className="tabular-figures text-foreground">
          {formatCents(baseline.p10Cents)} – {formatCents(baseline.p90Cents)}
        </span>
      </p>

      {scenario ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {scenarioLabel}:{" "}
          <span className="tabular-figures font-medium" style={{ color: chartColors.scenario }}>
            {formatCents(scenario.p50Cents)}
          </span>{" "}
          median
        </p>
      ) : null}

      {events.length > 0 ? (
        <ul className="mt-2.5 space-y-1.5 border-t border-border pt-2.5">
          {events.map((event) => (
            <li key={event.label} className="flex items-baseline justify-between gap-4 text-xs">
              <span className="text-muted-foreground">{event.label}</span>
              <span className="tabular-figures font-medium">{event.amount}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
