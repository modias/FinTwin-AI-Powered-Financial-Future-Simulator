import { Check } from "lucide-react";

import { ONBOARDING_STEPS } from "@/lib/onboarding/validation";
import { cn } from "@/lib/utils";

/** "Step 2 of 4" with a segmented bar. The review screen passes `step = 4`. */
export function StepProgress({ step }: { step: number }) {
  const total = ONBOARDING_STEPS.length;
  const isReview = step >= total;

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground">
        {isReview ? "Review" : `Step ${step + 1} of ${total}`}
        <span className="sr-only">
          {isReview ? "" : `: ${ONBOARDING_STEPS[step].title}`}
        </span>
      </p>
      <ol className="grid grid-cols-4 gap-2" aria-label="Setup progress">
        {ONBOARDING_STEPS.map((item, index) => {
          const isDone = index < step;
          const isCurrent = index === step;

          return (
            <li key={item.title} aria-current={isCurrent ? "step" : undefined}>
              <span
                aria-hidden
                className={cn(
                  "block h-1.5 rounded-full transition-colors duration-300",
                  isDone || isCurrent ? "bg-primary" : "bg-muted",
                  isCurrent && "bg-primary/70",
                )}
              />
              <span
                className={cn(
                  "mt-2 hidden items-center gap-1 text-xs sm:flex",
                  isCurrent ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {isDone ? <Check aria-hidden className="size-3 text-primary" /> : null}
                {item.title}
                <span className="sr-only">
                  {isDone ? " (done)" : isCurrent ? " (current)" : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
