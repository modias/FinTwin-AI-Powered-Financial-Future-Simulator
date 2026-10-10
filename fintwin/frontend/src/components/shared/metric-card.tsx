import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type MetricTone = "neutral" | "positive" | "warning" | "risk" | "accent";

const toneIconStyles: Record<MetricTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  positive: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  risk: "bg-risk/12 text-risk",
  accent: "bg-primary/12 text-primary",
};

interface MetricCardProps {
  label: string;
  /** The headline figure, or a short status string when no figure exists. */
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: MetricTone;
  /** Rendered in the top-right, typically a disclosure badge. */
  badge?: ReactNode;
  /** Renders the value in muted type, for "not available yet" states. */
  isMuted?: boolean;
  className?: string;
}

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  badge,
  isMuted = false,
  className,
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        "gap-0 transition-colors duration-200 hover:ring-foreground/20 [--card-spacing:--spacing(5)]",
        className,
      )}
    >
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <span className="text-[13px] font-medium text-muted-foreground">
            {label}
          </span>
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-lg",
              toneIconStyles[tone],
            )}
          >
            <Icon aria-hidden className="size-4" />
          </span>
        </div>

        <div className="space-y-1.5">
          <p
            className={cn(
              "tabular-figures font-heading text-2xl leading-none font-semibold tracking-tight",
              isMuted && "text-base font-medium text-muted-foreground",
            )}
          >
            {value}
          </p>
          {hint ? (
            <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
          ) : null}
        </div>

        {badge ? <div className="flex">{badge}</div> : null}
      </CardContent>
    </Card>
  );
}

export function MetricCardSkeleton() {
  return (
    <Card className="gap-0 [--card-spacing:--spacing(5)]">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="size-8 rounded-lg" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
      </CardContent>
    </Card>
  );
}
