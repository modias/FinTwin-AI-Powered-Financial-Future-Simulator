"use client";

import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { DataSourceBadge } from "@/components/shared/data-source-badge";
import { useUserProfile } from "@/hooks/use-financial-data";
import { useGreeting } from "@/hooks/use-greeting";
import { formatMediumDate } from "@/lib/dates";

export function WelcomeHeader() {
  const { greeting } = useGreeting();
  const { referenceDate, dataset } = useActiveWorkspace();
  const { data: profile } = useUserProfile();
  // Onboarding never asks for a name, so a personal profile is greeted without one.
  const firstName = profile?.name?.split(" ")[0] ?? null;

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1.5">
        {/* The greeting depends on the viewer's clock, which is only read
            after mount — see `useGreeting`. */}
        <h1
          suppressHydrationWarning
          className="font-heading text-2xl font-semibold tracking-tight sm:text-[28px]"
        >
          {greeting}
          {firstName ? `, ${firstName}` : null}
        </h1>
        <p className="text-sm text-muted-foreground">
          {dataset.source === "demo"
            ? "Here’s how your financial future is looking."
            : "Here’s how your financial future looks, based on your answers."}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <DataSourceBadge />
        <span className="text-xs text-muted-foreground">
          {dataset.source === "demo" ? "as of" : "balance entered"}{" "}
          {formatMediumDate(referenceDate)}
        </span>
      </div>
    </header>
  );
}
