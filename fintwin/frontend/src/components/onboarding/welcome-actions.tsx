"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The welcome screen's button depends on what is saved in this browser, so it
 * renders after hydration. First-time visitors are taken through the
 * questionnaire (resuming any saved draft); returning visitors with a profile
 * go straight to the dashboard.
 */
export function WelcomeActions() {
  const router = useRouter();
  const { isHydrated, activeProfile, startOnboarding } = useWorkspace();

  if (!isHydrated) {
    return <Skeleton className="h-10 w-52 rounded-lg" aria-busy />;
  }

  if (activeProfile) {
    return (
      <Button asChild size="lg" className="px-7">
        <Link href="/overview">
          Continue to dashboard
          <ArrowRight aria-hidden />
        </Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="lg"
      className="px-7"
      onClick={() => {
        startOnboarding("blank");
        router.push("/onboarding");
      }}
    >
      Continue to dashboard
      <ArrowRight aria-hidden />
    </Button>
  );
}
