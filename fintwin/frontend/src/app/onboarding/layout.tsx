import type { ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";

import { FinTwinWordmark } from "@/components/shared/fintwin-logo";
import { Button } from "@/components/ui/button";

/**
 * A focused layout for the questionnaire: no sidebar, just the wordmark and a
 * way out. Answers are saved as they are typed, so leaving loses nothing.
 */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            aria-label="FinTwin home"
            className="rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <FinTwinWordmark />
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <X aria-hidden />
              Save &amp; exit
            </Link>
          </Button>
        </div>
      </header>
      <main id="main-content" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
