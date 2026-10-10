"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useWorkspace } from "@/components/providers/workspace-provider";
import { FinTwinLogo } from "@/components/shared/fintwin-logo";

/**
 * Renders the dashboard only once a financial profile is active.
 *
 * Saved profiles live in `localStorage`, which the server cannot read, so the
 * server and the first client render both show the same neutral loading
 * screen (no hydration mismatch). After hydration, a visitor without a profile
 * is sent to the welcome screen with `replace`, so Back does not bounce them
 * into the redirect again. The welcome screen never redirects, so there is no
 * loop.
 */
export function ProfileGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isHydrated, activeProfile } = useWorkspace();
  const needsOnboarding = isHydrated && !activeProfile;

  useEffect(() => {
    if (needsOnboarding) router.replace("/");
  }, [needsOnboarding, router]);

  if (!isHydrated || !activeProfile) {
    return (
      <div
        id="main-content"
        className="flex min-h-dvh flex-col items-center justify-center gap-4"
        role="status"
        aria-live="polite"
      >
        <FinTwinLogo className="size-10 animate-pulse rounded-xl" />
        <p className="text-sm text-muted-foreground">
          {needsOnboarding ? "Taking you to setup…" : "Loading your financial twin…"}
        </p>
      </div>
    );
  }

  return children;
}
