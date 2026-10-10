"use client";

import { useMemo } from "react";
import {
  ArrowDownUp,
  CalendarRange,
  CreditCard,
  Receipt,
  Repeat,
  Store,
  TrendingDown,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { DataSourceBadge } from "@/components/shared/data-source-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { NoHistoryNotice } from "@/components/shared/no-history-notice";
import { ChartSkeleton } from "@/components/shared/loading-skeleton";
import {
  MetricCard,
  MetricCardSkeleton,
} from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useBills,
  useSelectedAccount,
  useSpendingSummary,
  useTransactions,
} from "@/hooks/use-financial-data";
import {
  averageDailySpending,
  largestExpense,
  monthlyRecurringCost,
  runwayInDays,
  summarizeCashFlow,
  topMerchantByFrequency,
  weeklySpending,
  type WeeklySpend,
} from "@/lib/calculations";
import { categoryColor } from "@/lib/category-visuals";
import { formatMediumDate } from "@/lib/dates";
import {
  formatCompactCurrency,
  formatCurrency,
  formatPercent,
} from "@/lib/formatters";
import type { CategorySpend } from "@/types/financial";

/**
 * Descriptive analytics only.
 *
 * Everything on this page is a measurement of transactions that already
 * happened — no projection, no probability. That keeps it honest in Phase 1 and
 * means none of it has to be revisited when the simulator arrives.
 */
export function InsightsView() {
  const { dataset } = useActiveWorkspace();

  if (dataset.source !== "demo") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Financial Insights"
          description="Insights measure transactions that already happened, so they need history."
          actions={<DataSourceBadge />}
        />
        <NoHistoryNotice />
      </div>
    );
  }

  return <HistoryInsights />;
}

function HistoryInsights() {
  const { selectedAccountId } = useActiveWorkspace();
  const account = useSelectedAccount();
  const { data: summary, isPending: isSummaryPending } = useSpendingSummary();
  const { data: transactions } = useTransactions({ accountId: selectedAccountId });
  const { data: bills } = useBills();

  const analytics = useMemo(() => {
    if (!summary || !transactions) return null;

    const cashFlow = summarizeCashFlow(
      transactions,
      selectedAccountId,
      summary.periodStart,
      summary.periodEnd,
    );

    return {
      cashFlow,
      dailyAverage: averageDailySpending(summary),
      largest: largestExpense(
        transactions,
        selectedAccountId,
        summary.periodStart,
        summary.periodEnd,
      ),
      topMerchant: topMerchantByFrequency(
        transactions,
        selectedAccountId,
        summary.periodStart,
        summary.periodEnd,
      ),
      weekly: weeklySpending(
        transactions,
        selectedAccountId,
        summary.periodStart,
        summary.periodEnd,
      ),
      runway: account ? runwayInDays(account.currentBalance, summary) : null,
    };
  }, [account, selectedAccountId, summary, transactions]);

  const recurring = useMemo(
    () => (bills ? monthlyRecurringCost(bills, selectedAccountId) : null),
    [bills, selectedAccountId],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Insights"
        description={
          summary
            ? `Measured from ${summary.transactionCount} transactions between ${formatMediumDate(
                summary.periodStart,
              )} and ${formatMediumDate(summary.periodEnd)}.`
            : "Descriptive analytics calculated from your transaction history."
        }
        actions={<DataSourceBadge />}
      />

      {isSummaryPending || !summary || !analytics ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <MetricCardSkeleton key={index} />
          ))}
        </div>
      ) : summary.transactionCount === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Not enough history yet"
          description="This account has no transactions in the trailing 30 days, so there is nothing to measure."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total spent"
              value={formatCurrency(summary.total)}
              hint={`Across ${summary.periodDays} days and ${summary.transactionCount} debits`}
              icon={Wallet}
              tone="accent"
            />
            <MetricCard
              label="Average daily spend"
              value={formatCurrency(analytics.dailyAverage)}
              hint={`About ${formatCurrency(analytics.dailyAverage * 30)} over a 30-day month`}
              icon={CalendarRange}
              tone="neutral"
            />
            <MetricCard
              label="Net cash flow"
              value={`${analytics.cashFlow.net >= 0 ? "+" : "\u2212"}${formatCurrency(
                Math.abs(analytics.cashFlow.net),
              )}`}
              hint={`${formatCurrency(analytics.cashFlow.income)} in, ${formatCurrency(
                analytics.cashFlow.spending,
              )} out`}
              icon={ArrowDownUp}
              tone={analytics.cashFlow.net >= 0 ? "positive" : "risk"}
            />
            <MetricCard
              label="Top category"
              value={summary.topCategory?.category ?? "—"}
              hint={
                summary.topCategory
                  ? `${formatCurrency(summary.topCategory.total)} · ${formatPercent(
                      summary.topCategory.percentage,
                    )} of spending`
                  : undefined
              }
              icon={TrendingDown}
              tone="warning"
            />

            <MetricCard
              label="Largest single expense"
              value={
                analytics.largest
                  ? formatCurrency(analytics.largest.amount)
                  : "—"
              }
              hint={
                analytics.largest
                  ? `${analytics.largest.merchant} · ${formatMediumDate(
                      analytics.largest.date,
                    )}`
                  : undefined
              }
              icon={CreditCard}
              tone="neutral"
            />
            <MetricCard
              label="Most frequent merchant"
              value={analytics.topMerchant?.merchant ?? "—"}
              hint={
                analytics.topMerchant
                  ? `${analytics.topMerchant.count} visits · ${formatCurrency(
                      analytics.topMerchant.total,
                    )} total`
                  : undefined
              }
              icon={Store}
              tone="neutral"
            />
            <MetricCard
              label="Recurring commitments"
              value={recurring ? formatCurrency(recurring.total) : "—"}
              hint={
                recurring
                  ? `${formatCurrency(recurring.scheduled)} scheduled + ${formatCurrency(
                      recurring.estimated,
                    )} estimated, normalised to a month`
                  : undefined
              }
              icon={Repeat}
              tone="accent"
            />
            <MetricCard
              label="Cover at this spend rate"
              value={
                analytics.runway === null
                  ? "—"
                  : `${analytics.runway} days`
              }
              hint="How long the current balance would last at the average daily spend, ignoring future income."
              icon={CalendarRange}
              tone={
                analytics.runway !== null && analytics.runway < 30
                  ? "warning"
                  : "positive"
              }
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card className="[--card-spacing:--spacing(5)]">
              <CardHeader>
                <CardTitle className="text-base">Spending by week</CardTitle>
                <CardDescription>
                  Seven-day windows ending on {formatMediumDate(summary.periodEnd)}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.weekly}
                      margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid
                        stroke="var(--border)"
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        dy={8}
                      />
                      <YAxis
                        tickFormatter={formatCompactCurrency}
                        tickLine={false}
                        axisLine={false}
                        width={56}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                      />
                      <Tooltip
                        cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                        content={(props) => (
                          <WeeklyTooltip
                            active={props.active}
                            entry={
                              props.payload?.[0]?.payload as
                                | WeeklySpend
                                | undefined
                            }
                          />
                        )}
                      />
                      <Bar
                        dataKey="total"
                        name="Spending"
                        fill="var(--chart-1)"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={56}
                        animationDuration={420}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="[--card-spacing:--spacing(5)]">
              <CardHeader>
                <CardTitle className="text-base">Category ranking</CardTitle>
                <CardDescription>
                  Totals over the same {summary.periodDays}-day window.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {summary.categories.length === 0 ? (
                  <ChartSkeleton />
                ) : (
                  <div
                    className="w-full"
                    style={{
                      height: `${Math.max(
                        200,
                        summary.categories.length * 40,
                      )}px`,
                    }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={summary.categories}
                        margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
                      >
                        <CartesianGrid
                          stroke="var(--border)"
                          strokeDasharray="3 3"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          tickFormatter={formatCompactCurrency}
                          tickLine={false}
                          axisLine={false}
                          tick={{
                            fill: "var(--muted-foreground)",
                            fontSize: 11,
                          }}
                        />
                        <YAxis
                          type="category"
                          dataKey="category"
                          tickLine={false}
                          axisLine={false}
                          width={104}
                          tick={{
                            fill: "var(--muted-foreground)",
                            fontSize: 11,
                          }}
                        />
                        <Tooltip
                          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                          content={(props) => (
                            <CategoryTooltip
                              active={props.active}
                              entry={
                                props.payload?.[0]?.payload as
                                  | CategorySpend
                                  | undefined
                              }
                            />
                          )}
                        />
                        <Bar
                          dataKey="total"
                          name="Spending"
                          radius={[0, 6, 6, 0]}
                          maxBarSize={22}
                          animationDuration={420}
                        >
                          {summary.categories.map((entry) => (
                            <Cell
                              key={entry.category}
                              fill={categoryColor(entry.category)}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="[--card-spacing:--spacing(5)]">
            <CardContent className="space-y-2">
              <p className="text-[13px] font-medium">
                These are measurements, not predictions
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Every figure above is computed from transactions that have
                already settled in the demonstration dataset. Forward-looking
                analysis — risk of breaching your protected balance, confidence
                in a spending decision — requires the simulation engine and is
                not estimated here.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function WeeklyTooltip({
  active,
  entry,
}: {
  active?: boolean;
  entry?: WeeklySpend;
}) {
  if (!active || !entry) return null;

  return (
    <div className="rounded-lg bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-foreground/10">
      <p className="text-xs text-muted-foreground">{entry.label}</p>
      <p className="tabular-figures mt-0.5 font-heading text-base font-semibold">
        {formatCurrency(entry.total)}
      </p>
      <p className="text-xs text-muted-foreground">
        Week starting {formatMediumDate(entry.weekStart)}
      </p>
    </div>
  );
}

function CategoryTooltip({
  active,
  entry,
}: {
  active?: boolean;
  entry?: CategorySpend;
}) {
  if (!active || !entry) return null;

  return (
    <div className="rounded-lg bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-foreground/10">
      <p className="text-[13px] font-medium">{entry.category}</p>
      <p className="tabular-figures mt-0.5 font-heading text-base font-semibold">
        {formatCurrency(entry.total)}
      </p>
      <p className="text-xs text-muted-foreground">
        {formatPercent(entry.percentage)} of spending · {entry.transactionCount}{" "}
        {entry.transactionCount === 1 ? "transaction" : "transactions"}
      </p>
    </div>
  );
}
