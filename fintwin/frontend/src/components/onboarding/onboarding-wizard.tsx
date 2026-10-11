"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ListChecks } from "lucide-react";

import { errorId } from "@/components/onboarding/fields";
import { HousingStep } from "@/components/onboarding/housing-step";
import { IncomeStep } from "@/components/onboarding/income-step";
import { SafetyStep } from "@/components/onboarding/safety-step";
import { SpendingStep } from "@/components/onboarding/spending-step";
import { StepProgress } from "@/components/onboarding/step-progress";
import type { StepProps } from "@/components/onboarding/step-props";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToday } from "@/hooks/use-today";
import { createEmptyDraft } from "@/lib/onboarding/draft";
import {
  LAST_STEP,
  hasErrors,
  validateStep,
  type FieldErrors,
} from "@/lib/onboarding/validation";
import type { OnboardingDraft } from "@/types/profile";

const STEP_COPY = [
  {
    title: "Let’s start with your money.",
    subtitle: "This helps us understand when money comes into your account.",
    Component: IncomeStep,
  },
  {
    title: "What expenses can you count on?",
    subtitle: "We’ll use your recurring bills to understand when money leaves your account.",
    Component: HousingStep,
  },
  {
    title: "What does a typical month look like?",
    subtitle:
      "Your everyday spending helps us estimate how much your balance might fluctuate.",
    Component: SpendingStep,
  },
  {
    title: "What does financial peace of mind mean to you?",
    subtitle: "Choose the balance you want FinTwin to protect.",
    Component: SafetyStep,
  },
] satisfies {
  title: string;
  subtitle: string;
  Component: (props: StepProps) => ReactNode;
}[];

/** Moves focus to the first field with an error, or to its message. */
function focusFirstError(errors: FieldErrors) {
  const key = Object.keys(errors)[0];

  if (!key) return;

  requestAnimationFrame(() => {
    const target = document.getElementById(key) ?? document.getElementById(errorId(key));

    target?.scrollIntoView({ block: "center", behavior: "smooth" });
    target?.focus({ preventScroll: true });
  });
}

/**
 * The four-step questionnaire. Every change is saved to the draft as it is
 * made, so a refresh or a later visit resumes where the user left off.
 */
export function OnboardingWizard() {
  const router = useRouter();
  const { isHydrated, draft: savedDraft, draftSession, patchDraft } = useWorkspace();
  const today = useToday();
  const emptyDraft = useMemo(() => createEmptyDraft(), []);
  const draft = savedDraft ?? emptyDraft;
  const step = Math.min(draft.step, LAST_STEP);

  // Errors appear only after the user tries to continue from a step, then
  // update live as they fix them. Attempts from an earlier questionnaire don't
  // count.
  const [attempts, setAttempts] = useState<{
    session: number;
    steps: ReadonlySet<number>;
  }>({ session: draftSession, steps: new Set() });
  const attempted =
    attempts.session === draftSession ? attempts.steps : new Set<number>();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);

  useEffect(() => {
    if (previousStep.current === step) return;

    previousStep.current = step;
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  if (!isHydrated || !today) {
    return <WizardSkeleton />;
  }

  const update = patchDraft;
  const errors = attempted.has(step) ? validateStep(draft, step, today) : {};
  const copy = STEP_COPY[step];

  /** Validates the current step; on success saves `patch` and runs `then`. */
  function advance(patch: Partial<OnboardingDraft>, then?: () => void) {
    const stepErrors = validateStep(draft, step, today as string);

    if (hasErrors(stepErrors)) {
      setAttempts({ session: draftSession, steps: new Set(attempted).add(step) });
      focusFirstError(stepErrors);
      return;
    }

    patchDraft(patch);
    then?.();
  }

  const goNext = () =>
    step === LAST_STEP
      ? advance({ reviewed: true }, () => router.push("/onboarding/review"))
      : advance({ step: step + 1 });

  const spendingIsEmpty =
    step === 2 && Object.values(draft.spendingCents).every((value) => !value);

  return (
    <div className="space-y-6">
      {draft.basedOn !== "blank" ? (
        <p className="rounded-lg border border-primary/25 bg-primary/6 px-4 py-3 text-sm text-muted-foreground">
          {draft.basedOn === "personal"
            ? "You’re editing your financial profile. Nothing changes until you save on the review screen."
            : "You’re starting from the demo answers. Saving creates your own profile; the demo stays available in Settings."}
        </p>
      ) : null}

      <Card className="[--card-spacing:--spacing(6)]">
        <CardContent className="space-y-8">
          <StepProgress step={step} />

          <div
            key={step}
            className="animate-in fade-in slide-in-from-right-2 space-y-8 duration-300"
          >
            <header className="space-y-1.5">
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="font-heading text-2xl font-semibold tracking-tight outline-none sm:text-[28px]"
              >
                {copy.title}
              </h1>
              <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
            </header>

            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                goNext();
              }}
            >
              <copy.Component draft={draft} update={update} errors={errors} today={today} />
              {/* Lets Enter in a text field submit the step. */}
              <button type="submit" hidden aria-hidden tabIndex={-1} />
            </form>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {step > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => patchDraft({ step: step - 1 })}
                >
                  <ArrowLeft aria-hidden />
                  Back
                </Button>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              {draft.reviewed && step !== LAST_STEP ? (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => advance({}, () => router.push("/onboarding/review"))}
                >
                  <ListChecks aria-hidden />
                  Save &amp; return to review
                </Button>
              ) : null}
              {spendingIsEmpty ? (
                <Button type="button" variant="ghost" size="lg" onClick={goNext}>
                  Skip for now
                </Button>
              ) : null}
              <Button type="button" size="lg" className="px-5" onClick={goNext}>
                {step === LAST_STEP ? "Review my answers" : "Continue"}
                <ArrowRight aria-hidden />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function WizardSkeleton() {
  return (
    <Card className="[--card-spacing:--spacing(6)]" aria-busy>
      <CardContent className="space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-1.5 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-8 w-80 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-9 w-60" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-9 w-60" />
        </div>
      </CardContent>
    </Card>
  );
}
