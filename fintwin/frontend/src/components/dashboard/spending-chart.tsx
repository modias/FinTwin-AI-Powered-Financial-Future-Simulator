"use client";

import { PieChartIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
  type PieSectorDataItem,
} from "recharts";

import { useCategoryHighlight } from "@/components/dashboard/category-highlight";
import { EmptyState } from "@/components/shared/empty-state";
import { DonutSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSpendingSummary } from "@/hooks/use-financial-data";
import { categoryColor, categoryIcons } from "@/lib/category-visuals";
import { formatMediumDate } from "@/lib/dates";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CategorySpend, SpendingSummary, TransactionCategory } from "@/types/financial";

/**
 * Spending by category.
 *
 * For the demo, every number — the total, the arc sizes, the percentages and
 * the top category — comes from a single pass over the transaction dataset in
 * `summarizeSpending`, so this card and the transaction table can never
 * disagree. A personal profile has no history, so it shows a typical month
 * built from the user's own answers and says so.
 */
export function SpendingChart() {
  const { data: summary, isPending } = useSpendingSummary();
  const { category: highlighted, setCategory: setHighlighted } = useCategoryHighlight();
  const cardRef = useRef<HTMLDivElement>(null);
  const isEstimate = summary?.basis === "estimates";
  const activeIndex =
    summary && highlighted
      ? summary.categories.findIndex((entry) => entry.category === highlighted)
      : -1;
  const isHighlighting = activeIndex >= 0;
  const toggle = (category: TransactionCategory | undefined) => {
    if (category) setHighlighted(category === highlighted ? null : category);
  };

  useEffect(() => {
    if (highlighted) cardRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlighted]);

  return (
    <Card ref={cardRef} className="[--card-spacing:--spacing(5)]">
      <CardHeader>
        <CardTitle className="text-base">
          {isEstimate ? "Estimated monthly spending" : "Spending overview"}
        </CardTitle>
        <CardDescription>{describePeriod(summary)}</CardDescription>
        {summary?.topCategory ? (
          <CardAction>
            <Badge variant="secondary">
              Top: {summary.topCategory.category}
            </Badge>
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent>
        {isPending || !summary ? (
          <DonutSkeleton />
        ) : summary.categories.length === 0 ? (
          <EmptyState
            icon={PieChartIcon}
            title={isEstimate ? "No spending entered" : "No spending in this period"}
            description={
              isEstimate
                ? "Your answers don’t include any monthly bills or everyday spending. Edit your financial profile in Settings to add them."
                : "This account has no debit transactions in the trailing 30 days."
            }
          />
        ) : (
          // Side by side only where the card is wide: full width at lg, half width from xl.
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center xl:flex-col xl:items-stretch 2xl:flex-row 2xl:items-center">
            <div className="relative mx-auto h-[216px] w-[216px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                {/* Remounting resets Recharts' own tooltip state, so `defaultIndex`
                    always shows the selected category as if it were hovered. */}
                <PieChart key={highlighted ?? "all"}>
                  <Pie
                    data={summary.categories}
                    dataKey="total"
                    nameKey="category"
                    innerRadius={66}
                    outerRadius={96}
                    paddingAngle={2}
                    strokeWidth={0}
                    animationDuration={420}
                    isAnimationActive={!isHighlighting}
                    activeShape={ActiveSector}
                    className="cursor-pointer"
                    onClick={(_, index) => toggle(summary.categories[index]?.category)}
                  >
                    {summary.categories.map((entry, index) => (
                      <Cell
                        key={entry.category}
                        fill={categoryColor(entry.category)}
                        fillOpacity={isHighlighting && index !== activeIndex ? 0.35 : 1}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    defaultIndex={isHighlighting ? activeIndex : undefined}
                    active={isHighlighting ? true : undefined}
                    trigger={isHighlighting ? "click" : "hover"}
                    content={(props) => (
                      <SpendingTooltip
                        active={props.active}
                        isEstimate={isEstimate}
                        entry={
                          props.payload?.[0]?.payload as
                            | CategorySpend
                            | undefined
                        }
                      />
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Centre label sits outside the SVG so it inherits app typography. */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs text-muted-foreground">
                  {isEstimate ? "Per month" : "Total spent"}
                </span>
                <span className="tabular-figures font-heading text-xl font-semibold">
                  {formatCurrency(summary.total)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {isEstimate
                    ? "Your estimates"
                    : `${summary.transactionCount} transactions`}
                </span>
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-3">
              <ul className="space-y-2.5">
                {summary.categories.map((entry, index) => (
                  <CategoryRow
                    key={entry.category}
                    entry={entry}
                    isSelected={index === activeIndex}
                    isDimmed={isHighlighting && index !== activeIndex}
                    onSelect={() => toggle(entry.category)}
                  />
                ))}
              </ul>
              {highlighted && !isHighlighting ? (
                <p className="text-xs leading-relaxed text-muted-foreground" role="status">
                  {highlighted} isn&rsquo;t part of this chart
                  {isEstimate ? ", which shows only monthly costs" : ""}.
                </p>
              ) : null}
              {isEstimate ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Built from the amounts you entered: rent or mortgage, recurring
                  bills and everyday spending. One-time bills and the
                  unexpected-expense allowance aren&rsquo;t monthly costs, so
                  they&rsquo;re left out here but included in the forecast.
                </p>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function describePeriod(summary: SpendingSummary | undefined): string {
  if (!summary) return "Trailing 30 days";

  if (summary.basis === "estimates") {
    return "A typical month, from your answers";
  }

  return `${formatMediumDate(summary.periodStart)} – ${formatMediumDate(
    summary.periodEnd,
  )}`;
}

function ActiveSector(props: PieSectorDataItem) {
  return <Sector {...props} outerRadius={(props.outerRadius ?? 0) + 6} />;
}

function CategoryRow({
  entry,
  isSelected,
  isDimmed,
  onSelect,
}: {
  entry: CategorySpend;
  isSelected: boolean;
  isDimmed: boolean;
  onSelect: () => void;
}) {
  const Icon = categoryIcons[entry.category];

  return (
    <li>
      <button
        type="button"
        aria-pressed={isSelected}
        title={`Show only ${entry.category} in upcoming events`}
        onClick={onSelect}
        className={cn(
          "block w-full cursor-pointer space-y-1.5 rounded-sm text-left outline-none transition-opacity duration-200 hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50",
          isDimmed && "opacity-40 hover:opacity-70",
        )}
      >
        <span className="flex items-center justify-between gap-3 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <Icon
              aria-hidden
              className="size-3.5 shrink-0"
              style={{ color: categoryColor(entry.category) }}
            />
            <span className="truncate">{entry.category}</span>
          </span>
          <span className="flex shrink-0 items-baseline gap-2">
            <span className="tabular-figures font-medium">
              {formatCurrency(entry.total)}
            </span>
            <span className="tabular-figures w-11 text-right text-xs text-muted-foreground">
              {formatPercent(entry.percentage)}
            </span>
          </span>
        </span>
        <span
          className="block h-1 overflow-hidden rounded-full bg-muted"
          role="presentation"
        >
          <span
            className="block h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${entry.percentage}%`,
              backgroundColor: categoryColor(entry.category),
            }}
          />
        </span>
      </button>
    </li>
  );
}

function SpendingTooltip({
  active,
  entry,
  isEstimate,
}: {
  active?: boolean;
  entry?: CategorySpend;
  isEstimate: boolean;
}) {
  if (!active || !entry) {
    return null;
  }

  const Icon = categoryIcons[entry.category];

  return (
    <div className="rounded-lg bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-foreground/10">
      <p className="flex items-center gap-2 text-[13px] font-medium">
        <Icon
          aria-hidden
          className="size-3.5"
          style={{ color: categoryColor(entry.category) }}
        />
        {entry.category}
      </p>
      <p className="tabular-figures mt-1 font-heading text-base font-semibold">
        {formatCurrency(entry.total)}
      </p>
      <p className="text-xs text-muted-foreground">
        {isEstimate
          ? `${formatPercent(entry.percentage)} of your estimated month`
          : `${formatPercent(entry.percentage)} of spending · ${entry.transactionCount} ${
              entry.transactionCount === 1 ? "transaction" : "transactions"
            }`}
      </p>
    </div>
  );
}
