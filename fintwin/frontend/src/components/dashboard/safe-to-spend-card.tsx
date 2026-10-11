"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, FlaskConical, ShieldAlert, ShieldCheck } from "lucide-react";

import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { SimulatedBadge } from "@/components/shared/disclosure-badges";
import { ModelInputs, ModelWarnings } from "@/components/simulation/model-inputs";
import { SimulationError, SimulationRunning } from "@/components/simulation/simulation-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useSafeToSpend } from "@/hooks/use-safe-to-spend";
import { addDays, formatMediumDate } from "@/lib/dates";
import { formatProbability, splitCurrency } from "@/lib/formatters";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { SimulationResult } from "@/simulation/types";

const pathCountFormatter = new Intl.NumberFormat("en-US");

/**
 * The dashboard's headline answer to "how much can I spend today?": the
 * largest purchase today that still keeps the balance above the protected
 * minimum, at every point in the horizon, in at least the target share of
 * simulated futures.
 */
export function SafeToSpendCard() {
  const { dataset } = useActiveWorkspace();
  const { data: result, input, error, retry } = useSafeToSpend();

  if (error) {
    return (
      <Card className="[--card-spacing:--spacing(6)]">
        <CardContent>
          <SimulationError error={error} onRetry={retry} />
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return <SafeToSpendCardSkeleton pathCount={input.pathCount} />;
  }

  const { safeToSpend, safety } = result;
  const target = Math.round(result.targetConfidence * 100);
  const endDate = addDays(result.referenceDate, result.horizonDays);
  const fails = safeToSpend.status !== "meets_target";

  return (
    <Card
      className={cn(
        "gap-0 [--card-spacing:--spacing(6)]",
        fails ? "ring-risk/25" : "ring-primary/20",
      )}
    >
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[13px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                Safe to spend today
              </h2>
              <SimulatedBadge pathCount={result.pathCount} />
            </div>

            {fails ? (
              <div className="space-y-2">
                <p className="tabular-figures font-heading text-[32px] leading-tight font-semibold tracking-tight sm:text-[40px]">
                  Safe to Spend: $0
                </p>
                <p className="flex max-w-xl items-start gap-2 text-sm leading-relaxed text-risk">
                  <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                  {safeToSpend.warning}
                </p>
              </div>
            ) : (
              <HeadlineAmount cents={safeToSpend.amountCents} />
            )}

            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              {fails ? (
                <>
                  Without any extra purchase, your balance stays above{" "}
                  {formatCents(result.protectedMinimumCents)} through{" "}
                  {formatMediumDate(endDate)} in{" "}
                  <span className="text-foreground">{formatProbability(safety.safetyProbability)}</span>{" "}
                  of {pathCountFormatter.format(result.pathCount)} simulated futures — short of your{" "}
                  {target}% target.
                </>
              ) : (
                <>
                  The most you could spend today and still stay above{" "}
                  {formatCents(result.protectedMinimumCents)} every day through{" "}
                  {formatMediumDate(endDate)} in at least {target}% of{" "}
                  {pathCountFormatter.format(result.pathCount)} simulated futures.
                  {safeToSpend.limitedBy === "available_balance"
                    ? " That’s everything above your protected minimum today."
                    : ""}{" "}
                  An estimate, not a guarantee.
                </>
              )}
            </p>

            <Button asChild variant="outline" size="sm">
              <Link href="/simulator">
                <FlaskConical aria-hidden />
                Test a purchase
              </Link>
            </Button>
          </div>

          <dl className="grid shrink-0 grid-cols-2 gap-x-8 gap-y-4 lg:gap-x-10">
            <SupportingStat label="Current balance" value={formatCents(result.openingBalanceCents)} />
            <SupportingStat
              label="Protected minimum"
              value={formatCents(result.protectedMinimumCents)}
            />
            <SupportingStat
              label="Chance of staying above it"
              value={formatProbability(safety.safetyProbability)}
              tone={safety.safePaths >= safeToSpend.requiredSafePaths ? "positive" : "risk"}
            />
            <SupportingStat label="Safety target" value={`${target}%`} />
            <SupportingStat label="Forecast horizon" value={`${result.horizonDays} days`} />
            <SupportingStat
              label="Simulations"
              value={pathCountFormatter.format(result.pathCount)}
            />
          </dl>
        </div>

        <ModelWarnings warnings={result.warnings} />

        <Separator />

        <CalculationDisclosure result={result} isDemo={dataset.source === "demo"} />
      </CardContent>
    </Card>
  );
}

function HeadlineAmount({ cents }: { cents: number }) {
  const { whole, fraction } = splitCurrency(cents / 100);

  return (
    <p className="tabular-figures font-heading leading-none font-semibold tracking-tight">
      <span className="text-[44px] sm:text-[56px]">{whole}</span>
      <span className="ml-0.5 text-2xl text-muted-foreground">.{fraction}</span>
    </p>
  );
}

function SupportingStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "risk";
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "tabular-figures font-heading text-lg font-medium",
          tone === "positive" && "text-success",
          tone === "risk" && "text-risk",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function CalculationDisclosure({ result, isDemo }: { result: SimulationResult; isDemo: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const target = Math.round(result.targetConfidence * 100);
  const { safeToSpend } = result;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="-ml-2.5 self-start">
            <ShieldCheck aria-hidden />
            How is this calculated?
            <ChevronDown
              aria-hidden
              className={cn("transition-transform duration-200", isOpen && "rotate-180")}
            />
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="overflow-hidden data-closed:animate-collapsible-up data-open:animate-collapsible-down">
        <div className="space-y-5 pt-4">
          <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-muted-foreground">
            <li>
              FinTwin simulates {pathCountFormatter.format(result.pathCount)} possible versions of
              the next {result.horizonDays} days. Income and bills land on their dates in every
              one; everyday spending and unexpected expenses are drawn at random in each.
            </li>
            <li>
              A simulated future counts as <span className="text-foreground">safe</span> only if
              the balance never drops below your protected minimum — not just at the end, but at
              every point, including right after a purchase today.
            </li>
            <li>
              Safe to spend is the largest amount you could spend today and still have at least{" "}
              {target}% of futures safe ({pathCountFormatter.format(safeToSpend.requiredSafePaths)}{" "}
              of {pathCountFormatter.format(result.pathCount)}). It is checked against the same
              simulated futures and rounded down to the cent.
            </li>
            <li>
              {target}% is a target for this model, not a guarantee: the model can be wrong, and
              real life can differ from all of its simulated futures.
            </li>
          </ol>

          <div className="space-y-2">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              What went in
            </h3>
            <ModelInputs result={result} isDemo={isDemo} />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SafeToSpendCardSkeleton({ pathCount }: { pathCount: number }) {
  return (
    <Card className="gap-0 [--card-spacing:--spacing(6)]">
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:justify-between">
          <div className="space-y-4">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-14 w-64" />
            <SimulationRunning pathCount={pathCount} />
          </div>
          <div className="grid grid-cols-2 gap-x-10 gap-y-4">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        </div>
        <Skeleton className="h-8 w-48" />
      </CardContent>
    </Card>
  );
}
