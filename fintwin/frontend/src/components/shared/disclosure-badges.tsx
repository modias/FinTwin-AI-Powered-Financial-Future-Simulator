import { Dices } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Honesty labels.
 *
 * Every simulated figure carries `SimulatedBadge` or sits beside
 * `SimulationDisclaimer`, and `SourceTag` says where an individual figure
 * comes from. `DataSourceBadge` says which profile is on screen.
 */

export const SIMULATION_DISCLAIMER =
  "Simulated estimates, not guarantees or financial advice.";

const pathCountFormatter = new Intl.NumberFormat("en-US");

export function SimulatedBadge({
  pathCount,
  className,
}: {
  pathCount?: number;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("gap-1 border-primary/30 text-primary", className)}>
      <Dices aria-hidden />
      {pathCount
        ? `Monte Carlo · ${pathCountFormatter.format(pathCount)} simulations`
        : "Monte Carlo simulation"}
    </Badge>
  );
}

/** The required disclaimer, verbatim. */
export function SimulationDisclaimer({ className }: { className?: string }) {
  return <Disclaimer className={className}>{SIMULATION_DISCLAIMER}</Disclaimer>;
}

export type FigureSource =
  | "user_entered"
  | "historical"
  | "scheduled"
  | "estimated"
  | "simulated"
  | "assumption"
  | "hypothetical";

export const FIGURE_SOURCE_LABELS: Record<FigureSource, { label: string; description: string }> = {
  user_entered: { label: "You entered", description: "A figure you typed during onboarding." },
  historical: { label: "History", description: "Measured from past transactions." },
  scheduled: { label: "Scheduled", description: "A known bill or paycheck on a known date." },
  estimated: { label: "Estimated", description: "An expected amount, such as weekly groceries." },
  simulated: {
    label: "Simulated",
    description: "Drawn at random on each of the simulated paths.",
  },
  assumption: {
    label: "Assumption",
    description: "A modelling assumption, not a fact about you.",
  },
  hypothetical: { label: "What-if", description: "A change you are testing, not a real event." },
};

const sourceStyles: Record<FigureSource, string> = {
  user_entered: "border-border text-muted-foreground",
  historical: "border-border text-muted-foreground",
  scheduled: "border-chart-3/40 text-chart-3",
  estimated: "border-chart-5/40 text-chart-5",
  simulated: "border-primary/30 text-primary",
  assumption: "border-warning/30 text-warning",
  hypothetical: "border-chart-2/40 text-chart-2",
};

export function SourceTag({ source, className }: { source: FigureSource; className?: string }) {
  const { label, description } = FIGURE_SOURCE_LABELS[source];

  return (
    <Badge
      variant="outline"
      title={description}
      className={cn("h-5 px-1.5 text-[10px] font-medium", sourceStyles[source], className)}
    >
      {label}
    </Badge>
  );
}

/** A quiet footnote for chart and card captions. */
export function Disclaimer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>
      {children}
    </p>
  );
}
