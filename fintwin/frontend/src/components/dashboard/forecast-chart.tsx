"use client";

import { useMemo } from "react";
import { ArrowDownRight, LineChart, TrendingUp } from "lucide-react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { Disclaimer } from "@/components/shared/disclosure-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { ChartSkeleton } from "@/components/shared/loading-skeleton";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useForecast, useUpcomingEvents } from "@/hooks/use-financial-data";
import { FORECAST_HORIZONS } from "@/lib/constants";
import { formatMediumDate, formatShortDate } from "@/lib/dates";
import { formatCompactCurrency, formatCurrency } from "@/lib/formatters";
import type {
  CashFlowEvent,
  ForecastHorizon,
  ForecastPoint,
} from "@/types/financial";

const seriesColors = {
  balance: "var(--chart-1)",
  income: "var(--chart-2)",
  bills: "var(--chart-3)",
  estimated: "var(--chart-5)",
  protected: "var(--success)",
};

/**
 * The illustrative balance projection.
 *
 * It plots one deterministic path — the balance walk from the selected
 * account's real mock balance through its scheduled events — with the protected
 * balance as a threshold line. There are deliberately no percentile bands: a
 * single path has no distribution to draw, and drawing one would imply a
 * simulation that does not exist yet.
 */
export function ForecastChart() {
  const { preferences, updatePreferences, dataset } = useActiveWorkspace();
  const { data: series, isPending } = useForecast();
  const { data: events } = useUpcomingEvents(preferences.forecastHorizonDays);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CashFlowEvent[]>();

    for (const event of events ?? []) {
      const bucket = map.get(event.date);

      if (bucket) {
        bucket.push(event);
      } else {
        map.set(event.date, [event]);
      }
    }

    return map;
  }, [events]);

  const axisBounds = useMemo(() => {
    if (!series) return null;

    const balances = series.points.map((point) => point.projectedBalance);
    const lowest = Math.min(...balances, series.protectedBalance);
    const highest = Math.max(...balances, series.protectedBalance);
    const padding = Math.max((highest - lowest) * 0.14, 60);

    const largestEvent = Math.max(
      1,
      ...series.points.map((point) =>
        Math.max(point.income, point.bills + point.estimatedSpending),
      ),
    );

    return {
      // Keeping the floor at or above zero stops the area from being drawn
      // below an axis that money cannot reach.
      balanceDomain: [Math.max(0, lowest - padding), highest + padding] as const,
      // Event bars are scaled against a taller axis so they read as context
      // beneath the balance line rather than competing with it.
      eventDomain: [0, largestEvent * 3.4] as const,
    };
  }, [series]);

  return (
    <Card className="[--card-spacing:--spacing(5)]">
      <CardHeader>
        <CardTitle className="text-base">Your Financial Future</CardTitle>
        <CardDescription>
          Explore an illustrative projection of your upcoming cash flow.
        </CardDescription>
        <CardAction>
          <HorizonTabs
            value={preferences.forecastHorizonDays}
            onChange={(forecastHorizonDays) =>
              updatePreferences({ forecastHorizonDays })
            }
          />
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-5">
        <ChartLegend />

        {isPending || !series || !axisBounds ? (
          <div className="h-[300px] sm:h-[340px]">
            <ChartSkeleton className="h-full" />
          </div>
        ) : series.points.length === 0 ? (
          <EmptyState
            icon={LineChart}
            title="Nothing to project"
            description="This account has no scheduled income or bills inside the selected horizon."
          />
        ) : (
          <div className="h-[300px] w-full sm:h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={series.points}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id="forecastBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={seriesColors.balance}
                      stopOpacity={0.34}
                    />
                    <stop
                      offset="100%"
                      stopColor={seriesColors.balance}
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                  vertical={false}
                />

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
                  yAxisId="balance"
                  domain={[...axisBounds.balanceDomain]}
                  tickFormatter={formatCompactCurrency}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <YAxis
                  yAxisId="events"
                  hide
                  domain={[...axisBounds.eventDomain]}
                />

                <Tooltip
                  cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                  content={(props) => (
                    <ForecastTooltip
                      active={props.active}
                      point={
                        props.payload?.[0]?.payload as ForecastPoint | undefined
                      }
                      events={
                        eventsByDate.get(
                          (props.payload?.[0]?.payload as ForecastPoint | undefined)
                            ?.date ?? "",
                        ) ?? []
                      }
                    />
                  )}
                />

                <Bar
                  yAxisId="events"
                  dataKey="income"
                  name="Scheduled income"
                  stackId="events"
                  fill={seriesColors.income}
                  radius={[2, 2, 0, 0]}
                  maxBarSize={10}
                  isAnimationActive={false}
                />
                <Bar
                  yAxisId="events"
                  dataKey="bills"
                  name="Scheduled bills"
                  stackId="events"
                  fill={seriesColors.bills}
                  radius={[2, 2, 0, 0]}
                  maxBarSize={10}
                  isAnimationActive={false}
                />
                <Bar
                  yAxisId="events"
                  dataKey="estimatedSpending"
                  name="Estimated spending"
                  stackId="events"
                  fill={seriesColors.estimated}
                  fillOpacity={0.55}
                  radius={[2, 2, 0, 0]}
                  maxBarSize={10}
                  isAnimationActive={false}
                />

                <Area
                  yAxisId="balance"
                  type="monotone"
                  dataKey="projectedBalance"
                  name="Projected balance"
                  stroke={seriesColors.balance}
                  strokeWidth={2}
                  fill="url(#forecastBalance)"
                  activeDot={{
                    r: 4,
                    strokeWidth: 2,
                    stroke: "var(--card)",
                    fill: seriesColors.balance,
                  }}
                  animationDuration={420}
                />

                <ReferenceLine
                  yAxisId="balance"
                  y={series.protectedBalance}
                  stroke={seriesColors.protected}
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  ifOverflow="extendDomain"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="flex flex-col gap-4 border-t border-border/60 pt-4 sm:flex-row sm:items-start sm:justify-between">
          {series ? (
            <dl className="flex flex-wrap gap-x-8 gap-y-3">
              <ForecastStat
                icon={ArrowDownRight}
                label="Lowest projected balance"
                value={formatCurrency(series.lowestProjectedBalance)}
                detail={formatMediumDate(series.lowestProjectedBalanceDate)}
                tone={
                  series.lowestProjectedBalance < series.protectedBalance
                    ? "risk"
                    : "neutral"
                }
              />
              <ForecastStat
                icon={TrendingUp}
                label={`Projected in ${series.horizonDays} days`}
                value={formatCurrency(series.endingBalance)}
                detail={formatMediumDate(
                  series.points[series.points.length - 1].date,
                )}
              />
            </dl>
          ) : (
            <Skeleton className="h-10 w-64" />
          )}

          <Disclaimer className="max-w-sm sm:text-right">
            <span className="font-medium text-warning">
              Illustrative forecast
            </span>{" "}
            — not a Monte Carlo simulation. One deterministic path over{" "}
            {dataset.source === "demo"
              ? "demonstration data"
              : "the schedule and estimates you entered"}
            , with no percentile bands until Phase 2.
          </Disclaimer>
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
    <Tabs
      value={String(value)}
      onValueChange={(next) => onChange(Number(next) as ForecastHorizon)}
    >
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

function ChartLegend() {
  const items = [
    { label: "Projected balance", color: seriesColors.balance, shape: "line" },
    { label: "Scheduled income", color: seriesColors.income, shape: "bar" },
    { label: "Scheduled bills", color: seriesColors.bills, shape: "bar" },
    {
      label: "Estimated spending",
      color: seriesColors.estimated,
      shape: "bar",
    },
    {
      label: "Protected balance",
      color: seriesColors.protected,
      shape: "dashed",
    },
  ] as const;

  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <span
            aria-hidden
            className={
              item.shape === "bar"
                ? "h-2.5 w-1.5 rounded-sm"
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

function ForecastTooltip({
  active,
  point,
  events,
}: {
  active?: boolean;
  point?: ForecastPoint;
  events: CashFlowEvent[];
}) {
  if (!active || !point) {
    return null;
  }

  return (
    <div className="min-w-[200px] rounded-lg bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-foreground/10">
      <p className="text-xs text-muted-foreground">
        {formatMediumDate(point.date)} · day {point.dayIndex}
      </p>
      <p className="tabular-figures mt-1 font-heading text-base font-semibold">
        {formatCurrency(point.projectedBalance)}
      </p>
      <p className="text-xs text-muted-foreground">Projected balance</p>

      {events.length > 0 ? (
        <ul className="mt-2.5 space-y-1.5 border-t border-border pt-2.5">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex items-baseline justify-between gap-4 text-xs"
            >
              <span className="min-w-0 truncate">
                {event.name}
                {event.confidence === "estimated" ? (
                  <span className="text-muted-foreground"> (est.)</span>
                ) : null}
              </span>
              <span
                className="tabular-figures shrink-0 font-medium"
                style={{
                  color:
                    event.direction === "income"
                      ? seriesColors.income
                      : event.confidence === "estimated"
                        ? seriesColors.estimated
                        : seriesColors.bills,
                }}
              >
                {event.direction === "income" ? "+" : "\u2212"}
                {formatCurrency(event.amount)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
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
          <span className={tone === "risk" ? "text-risk" : undefined}>
            {value}
          </span>
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            {detail}
          </span>
        </dd>
      </div>
    </div>
  );
}
