"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, PencilLine, RotateCcw, Sparkles } from "lucide-react";

import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ONBOARDING_STEPS } from "@/lib/onboarding/validation";

/**
 * The welcome screen's buttons depend on what is saved in this browser, so
 * they render after hydration. First-time visitors build their twin;
 * returning visitors get a way back to where they were.
 */
export function WelcomeActions() {
  const router = useRouter();
  const {
    isHydrated,
    activeProfile,
    draft,
    startOnboarding,
    discardDraft,
  } = useWorkspace();

  if (!isHydrated) {
    return (
      <div className="flex flex-col items-center gap-3 sm:flex-row" aria-busy>
        <Skeleton className="h-10 w-52 rounded-lg" />
        <Skeleton className="h-10 w-44 rounded-lg" />
      </div>
    );
  }

  const buildTwin = () => {
    startOnboarding("blank");
    router.push("/onboarding");
  };

  if (activeProfile) {
    const isDemo = activeProfile.source === "demo";

    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="px-7">
            <Link href="/overview">
              Continue to dashboard
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          {draft ? (
            <Button type="button" variant="outline" size="lg" onClick={() => router.push("/onboarding")}>
              <PencilLine aria-hidden />
              Resume your answers
            </Button>
          ) : isDemo ? (
            <Button type="button" variant="outline" size="lg" onClick={buildTwin}>
              <Sparkles aria-hidden />
              Build My Financial Twin
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => {
                startOnboarding("active");
                router.push("/onboarding");
              }}
            >
              <PencilLine aria-hidden />
              Update my answers
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {isDemo
            ? "You’re exploring the demo data."
            : "Your financial twin is saved in this browser."}
        </p>
      </div>
    );
  }

  if (draft) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Button type="button" size="lg" className="px-7" onClick={() => router.push("/onboarding")}>
            Resume setup
            <ArrowRight aria-hidden />
          </Button>
        </div>
        <p className="flex flex-wrap items-center justify-center gap-x-2 text-xs text-muted-foreground">
          <span>
            Your answers are saved: you were on step{" "}
            {Math.min(draft.step, ONBOARDING_STEPS.length - 1) + 1} of{" "}
            {ONBOARDING_STEPS.length}.
          </span>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto px-0 text-xs"
            onClick={() => {
              discardDraft();
              buildTwin();
            }}
          >
            <RotateCcw aria-hidden />
            Start over
          </Button>
        </p>
      </div>
    );
  }

  return (
    <Button type="button" size="lg" className="px-7" onClick={buildTwin}>
      Build My Financial Twin
      <ArrowRight aria-hidden />
    </Button>
  );
}
