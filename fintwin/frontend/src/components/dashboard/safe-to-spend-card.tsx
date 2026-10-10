"use client";

import { useState } from "react";
import { ChevronDown, Info, ShieldCheck, Wallet } from "lucide-react";

import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { IllustrativeBadge } from "@/components/shared/disclosure-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFinancialSummary } from "@/hooks/use-financial-data";
import { formatCurrency, splitCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { SafeToSpendEstimate } from "@/types/financial";

/**
 * The dashboard's headline answer to "how much can I spend today?".
 *
 * Phase 1 shows a transparent subtraction (see `services/safe-to-spend.ts`) and
 * says so in three places: the badge, the allocation bar caption, and the
 * expandable breakdown. It never claims a probability.
 */
export function SafeToSpendCard() {
  const { preferences, dataset } = useActiveWorkspace();
  const { data: summary, isPending } = useFinancialSummary();

  if (isPending || !summary) {
    return <SafeToSpendCardSkeleton />;
  }

  const estimate = summary.safeToSpend;
  const { whole, fraction } = splitCurrency(estimate.amount);

  return (
    <Card className="gap-0 ring-primary/20 [--card-spacing:--spacing(6)]">
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[13px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                Safe to spend today
              </h2>
              <IllustrativeBadge />
            </div>

            <p className="tabular-figures font-heading leading-none font-semibold tracking-tight">
              <span className="text-[44px] sm:text-[56px]">{whole}</span>
              <span className="ml-0.5 text-2xl text-muted-foreground">
                .{fraction}
              </span>
            </p>

            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              {estimate.clamped ? (
                <>
                  Your known obligations for the next{" "}
                  {estimate.reservationWindowDays} days already exceed what is
                  available above your protected balance, so this estimate is{" "}
                  <span className="text-foreground">held at $0</span>.
                </>
              ) : (
                <>
                  What&rsquo;s left after setting aside the next{" "}
                  {estimate.reservationWindowDays} days of bills and estimated
                  spending, and protecting{" "}
                  {formatCurrency(estimate.minimumProtectedBalance)}.
                </>
              )}
            </p>
          </div>

          <dl className="grid shrink-0 grid-cols-2 gap-x-8 gap-y-4 lg:gap-x-10">
            <SupportingStat
              label="Current balance"
              value={formatCurrency(summary.currentBalance)}
            />
            <SupportingStat
              label="Protected minimum balance"
              value={formatCurrency(summary.protectedMinimumBalance)}
            />
            <SupportingStat
              label="Target confidence"
              value={`${preferences.targetConfidence}%`}
              note="Saved for the Phase 2 simulation. It does not affect this estimate."
            />
            <SupportingStat
              label="Forecast horizon"
              value={`${preferences.forecastHorizonDays} days`}
            />
          </dl>
        </div>

        <AllocationBar estimate={estimate} />

        <Separator />

        <CalculationDisclosure
          estimate={estimate}
          targetConfidence={preferences.targetConfidence}
          isDemo={dataset.source === "demo"}
        />
      </CardContent>
    </Card>
  );
}

function SupportingStat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="space-y-1">
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {note ? (
          <Tooltip>
            <TooltipTrigger
              className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label={`About ${label}`}
            >
              <Info aria-hidden className="size-3 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px]">{note}</TooltipContent>
          </Tooltip>
        ) : null}
      </dt>
      <dd className="tabular-figures font-heading text-lg font-medium">
        {value}
      </dd>
    </div>
  );
}

/**
 * Shows how the current balance divides between what is spendable and what is
 * already committed. Widths come from the same numbers as the breakdown.
 */
function AllocationBar({ estimate }: { estimate: SafeToSpendEstimate }) {
  const segments = [
    {
      label: "Safe to spend",
      amount: estimate.amount,
      color: "var(--primary)",
    },
    {
      label: "Reserved bills",
      amount: estimate.reservedUpcomingBills,
      color: "var(--chart-3)",
    },
    {
      label: "Estimated spending",
      amount: estimate.expectedEssentialExpenses,
      color: "var(--chart-5)",
    },
    {
      label: "Protected minimum",
      amount: estimate.minimumProtectedBalance,
      color: "var(--success)",
    },
  ].filter((segment) => segment.amount > 0);

  const total = segments.reduce((sum, segment) => sum + segment.amount, 0);

  if (total <= 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div
        className="flex h-2 gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={segments
          .map((segment) => `${segment.label} ${formatCurrency(segment.amount)}`)
          .join(", ")}
      >
        {segments.map((segment) => (
          <span
            key={segment.label}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(segment.amount / total) * 100}%`,
              backgroundColor: segment.color,
            }}
          />
        ))}
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {segments.map((segment) => (
          <li
            key={segment.label}
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ backgroundColor: segment.color }}
            />
            {segment.label}
            <span className="tabular-figures text-foreground">
              {formatCurrency(segment.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CalculationDisclosure({
  estimate,
  targetConfidence,
  isDemo,
}: {
  estimate: SafeToSpendEstimate;
  targetConfidence: number;
  isDemo: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="-ml-2.5">
          <ShieldCheck aria-hidden />
          How is this calculated?
          <ChevronDown
            aria-hidden
            className={cn(
              "transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden data-closed:animate-collapsible-up data-open:animate-collapsible-down">
        <div className="space-y-4 pt-4">
          <dl className="space-y-0">
            {estimate.breakdown.map((line, index) => (
              <div
                key={line.label}
                className={cn(
                  "flex items-start justify-between gap-6 py-2.5",
                  index > 0 && "border-t border-border/60",
                )}
              >
                <div className="space-y-0.5">
                  <dt className="text-[13px] font-medium">{line.label}</dt>
                  <dd className="text-xs leading-relaxed text-muted-foreground">
                    {line.description}
                  </dd>
                </div>
                <span
                  className={cn(
                    "tabular-figures shrink-0 text-[13px] font-medium",
                    line.effect === "subtract" && "text-muted-foreground",
                  )}
                >
                  {line.effect === "add" ? "" : "\u2212"}
                  {formatCurrency(line.amount)}
                </span>
              </div>
            ))}

            <div className="flex items-center justify-between gap-6 border-t border-border py-3">
              <dt className="text-[13px] font-medium">
                Illustrative safe-to-spend estimate
              </dt>
              <span className="tabular-figures shrink-0 font-heading text-base font-semibold">
                {formatCurrency(estimate.amount)}
              </span>
            </div>
          </dl>

          {estimate.clamped ? (
            <div className="flex items-start gap-2 rounded-lg bg-warning/8 p-3">
              <Wallet aria-hidden className="mt-0.5 size-3.5 text-warning" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                The raw result was{" "}
                <span className="tabular-figures text-foreground">
                  {formatCurrency(estimate.rawAmount)}
                </span>
                . FinTwin clamps the displayed estimate to a minimum of $0
                because a negative amount is not a spending instruction.
              </p>
            </div>
          ) : null}

          <div className="space-y-2 rounded-lg bg-muted/50 p-3.5">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-warning/30 text-warning">
                Phase 1 placeholder
              </Badge>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              This figure is simple arithmetic on{" "}
              {isDemo ? "demonstration data" : "the figures you entered"}. It
              does not model uncertainty and it is{" "}
              <span className="text-foreground">
                not a {targetConfidence}% probability of staying above your
                protected balance
              </span>
              . The Monte Carlo optimiser that produces a probabilistic
              safe-to-spend amount arrives in Phase 2. Upcoming income inside
              the window is deliberately ignored, which keeps this estimate
              conservative.
            </p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SafeToSpendCardSkeleton() {
  return (
    <Card className="gap-0 [--card-spacing:--spacing(6)]">
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:justify-between">
          <div className="space-y-4">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-14 w-64" />
            <Skeleton className="h-3.5 w-80 max-w-full" />
          </div>
          <div className="grid grid-cols-2 gap-x-10 gap-y-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-8 w-48" />
      </CardContent>
    </Card>
  );
}