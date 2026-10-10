import Link from "next/link";
import { Compass } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

/**
 * Sits outside the `(app)` route group so it can catch any unmatched URL,
 * including ones that never reach the product shell. That means it renders
 * without the sidebar, so it carries its own way back.
 */
export default function NotFound() {
  return (
    <main
      id="main-content"
      className="flex min-h-dvh items-center justify-center px-6"
    >
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="That route isn't part of FinTwin. Head back to the Overview dashboard to pick up where you left off."
        action={
          <Button asChild size="sm">
            <Link href="/overview">Back to Overview</Link>
          </Button>
        }
        className="w-full max-w-md"
      />
    </main>
  );
}
