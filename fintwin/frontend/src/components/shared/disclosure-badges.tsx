import { Info, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Honesty labels.
 *
 * Phase 1 renders real UI on top of demo data or the user's own estimates,
 * and a placeholder calculation. These badges are how the interface says so,
 * consistently, next to every figure that is not what it will eventually be.
 * `DataSourceBadge` says which data is on screen.
 */

export function IllustrativeBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 border-warning/30 text-warning", className)}
    >
      <Info aria-hidden />
      Illustrative estimate
    </Badge>
  );
}

export function PhaseBadge({
  phase = 2,
  className,
}: {
  phase?: number;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 border-primary/30 text-primary", className)}
    >
      <Sparkles aria-hidden />
      Coming in Phase {phase}
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
