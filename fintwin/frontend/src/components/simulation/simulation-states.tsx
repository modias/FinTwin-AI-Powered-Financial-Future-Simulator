"use client";

import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const pathCountFormatter = new Intl.NumberFormat("en-US");

/** Shown in place of a result while the simulation runs. */
export function SimulationRunning({
  pathCount,
  label = "Running",
  className,
}: {
  pathCount: number;
  label?: string;
  className?: string;
}) {
  return (
    <p
      role="status"
      className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}
    >
      <Loader2 aria-hidden className="size-3.5 animate-spin" />
      {label} {pathCountFormatter.format(pathCount)} simulations…
    </p>
  );
}

export function SimulationError({
  error,
  onRetry,
  className,
}: {
  error: Error;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-start gap-3 rounded-lg bg-risk/8 p-4 sm:flex-row sm:items-center", className)}
    >
      <AlertTriangle aria-hidden className="size-4 shrink-0 text-risk" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium">The simulation couldn&rsquo;t finish</p>
        <p className="text-xs break-words text-muted-foreground">{error.message}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RotateCcw aria-hidden />
        Try again
      </Button>
    </div>
  );
}
