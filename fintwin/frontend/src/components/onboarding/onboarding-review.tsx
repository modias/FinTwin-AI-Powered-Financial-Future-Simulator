"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CircleAlert,
  ClipboardList,
  Info,
  Pencil,
  Sparkles,
} from "lucide-react";

import { PrivacyNotice } from "@/components/onboarding/privacy-notice";
import { StepProgress } from "@/components/onboarding/step-progress";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToday } from "@/hooks/use-today";
import { EMERGENCY_ASSUMPTIONS } from "@/lib/constants";
import { formatMediumDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import {
  ONBOARDING_STEPS,
  hasErrors,
  isScheduledPayFrequency,
  validateDraft,
} from "@/lib/onboarding/validation";
import {
  billCategoryLabels,
  confidenceLabels,
  describeBillSchedule,
  ordinal,
  payFrequencyLabels,
  variableSpendingLabels,
} from "@/lib/profile/labels";
import { monthlyBudget } from "@/lib/profile/normalize";
import { cn } from "@/lib/utils";
import {
  VARIABLE_SPENDING_CATEGORIES,
  type FinancialProfile,
  type OnboardingDraft,
} from "@/types/profile";

/** The profile fields `monthlyBudget` needs, read from a possibly incomplete draft. */
function budgetInputs(draft: OnboardingDraft) {
  const amount = draft.paycheckAmountCents ?? 0;
  const income: FinancialProfile["income"] = isScheduledPayFrequency(draft.payFrequency)
    ? { frequency: draft.payFrequency, paycheckAmountCents: amount, nextPayday: "" }
    : draft.payFrequency === "semimonthly"
      ? { frequency: "semimonthly", paycheckAmountCents: amount, semimonthlyPaydays: [1, 15] }
      : draft.payFrequency === "irregular"
        ? {
            frequency: "irregular",
            paycheckAmountCents: amount,
            expectedPayments: draft.expectedPayments,
          }
        : { frequency: "none", paycheckAmountCents: 0 };

  return {
    income,
    housing: {
      amountCents: draft.noHousingPayment ? 0 : (draft.housingAmountCents ?? 0),
      dueDay: draft.housingDueDay,
    },
    recurringBills: draft.bills,
    variableSpending: {
      period: draft.spendingPeriod,
      amountsCents: Object.fromEntries(
        VARIABLE_SPENDING_CATEGORIES.map((category) => [
          category,
          draft.spendingCents[category] ?? 0,
        ]),
      ) as FinancialProfile["variableSpending"]["amountsCents"],
    },
    emergencies: { enabled: draft.emergenciesEnabled },
  };
}

export function OnboardingReview() {
  const router = useRouter();
  const { isHydrated, draft, saveDraft, completeOnboarding, discardDraft } =
    useWorkspace();
  const today = useToday();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isHydrated || !today || isSubmitting) {
    return <ReviewSkeleton label={isSubmitting ? "Creating your financial twin…" : undefined} />;
  }

  if (!draft) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Nothing to review yet"
        description="Answer the four setup questions first, then come back here to check everything."
        action={
          <Button asChild>
            <Link href="/onboarding">Start setup</Link>
          </Button>
        }
      />
    );
  }

  const stepErrors = validateDraft(draft, today);
  const isValid = !stepErrors.some(hasErrors);
  const budget = monthlyBudget(budgetInputs(draft), today);
  const isEditing = draft.basedOn === "personal";

  const editStep = (step: number) => {
    saveDraft({ ...draft, step });
    router.push("/onboarding");
  };

  function submit() {
    const result = completeOnboarding();

    if (!result.ok) {
      router.push("/onboarding");
      return;
    }

    setIsSubmitting(true);
    toast.success(isEditing ? "Your financial twin is updated" : "Your financial twin is ready", {
      description: "The dashboard now uses the answers you entered.",
    });
    router.push("/overview");
  }

  return (
    <div className="space-y-6">
      <Card className="[--card-spacing:--spacing(6)]">
        <CardContent className="space-y-6">
          <StepProgress step={ONBOARDING_STEPS.length} />
          <header className="space-y-1.5">
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-[28px]">
              Review your financial twin
            </h1>
            <p className="text-sm text-muted-foreground">
              Check your answers. You can change any section now, and update
              them anytime later from Settings.
            </p>
          </header>

          <MonthlySummary budget={budget} />
        </CardContent>
      </Card>

      <ReviewSection
        title="Income & balance"
        onEdit={() => editStep(0)}
        error={firstError(stepErrors[0])}
      >
        <Row label="Checking balance" value={money(draft.balanceCents)} />
        <Row
          label="Take-home pay per paycheck"
          value={
            draft.payFrequency === "none" ? "No regular income" : money(draft.paycheckAmountCents)
          }
        />
        <Row
          label="Pay schedule"
          value={draft.payFrequency ? payFrequencyLabels[draft.payFrequency] : "Not answered"}
        />
        {isScheduledPayFrequency(draft.payFrequency) ? (
          <Row
            label="Next payday"
            value={draft.nextPayday ? formatMediumDate(draft.nextPayday) : "Not answered"}
          />
        ) : null}
        {draft.payFrequency === "semimonthly" ? (
          <Row
            label="Paydays"
            value={
              draft.semimonthlyPaydays.every((day) => day !== null)
                ? `The ${ordinal(draft.semimonthlyPaydays[0] as number)} and ${ordinal(
                    draft.semimonthlyPaydays[1] as number,
                  )}`
                : "Not answered"
            }
          />
        ) : null}
        {draft.payFrequency === "irregular" ? (
          <Row
            label="Expected payments"
            value={
              draft.expectedPayments.length === 0
                ? "None listed — no income is counted"
                : draft.expectedPayments
                    .map((payment) => `${formatCents(payment.amountCents)} on ${formatMediumDate(payment.date)}`)
                    .join(", ")
            }
          />
        ) : null}
      </ReviewSection>

      <ReviewSection
        title="Housing & bills"
        onEdit={() => editStep(1)}
        error={firstError(stepErrors[1])}
      >
        <Row
          label="Rent or mortgage"
          value={
            draft.noHousingPayment
              ? "None"
              : `${money(draft.housingAmountCents)}${
                  draft.housingDueDay ? ` · due on the ${ordinal(draft.housingDueDay)}` : ""
                }`
          }
        />
        {draft.bills.length === 0 ? (
          <Row label="Other recurring bills" value="None" />
        ) : (
          draft.bills.map((bill) => (
            <Row
              key={bill.id}
              label={bill.name}
              detail={`${billCategoryLabels[bill.category]} · ${describeBillSchedule(bill)}`}
              value={formatCents(bill.amountCents)}
            />
          ))
        )}
      </ReviewSection>

      <ReviewSection
        title="Everyday spending"
        onEdit={() => editStep(2)}
        error={firstError(stepErrors[2])}
      >
        {VARIABLE_SPENDING_CATEGORIES.map((category) => (
          <Row
            key={category}
            label={variableSpendingLabels[category]}
            value={`${formatCents(draft.spendingCents[category] ?? 0)} / ${
              draft.spendingPeriod === "weekly" ? "week" : "month"
            }`}
          />
        ))}
        <Row
          label="Unexpected expenses"
          value={
            draft.emergenciesEnabled
              ? `Included · ${formatCents(budget.emergencyAllowanceCents)} / month`
              : "Not included"
          }
          detail={
            draft.emergenciesEnabled
              ? `Assumes about ${EMERGENCY_ASSUMPTIONS.eventsPerYear} a year averaging ${formatCents(
                  EMERGENCY_ASSUMPTIONS.averageCostCents,
                )}.`
              : "Leaving these out may make the forecast optimistic."
          }
        />
      </ReviewSection>

      <ReviewSection
        title="Financial safety"
        onEdit={() => editStep(3)}
        error={firstError(stepErrors[3])}
      >
        <Row label="Balance to protect" value={money(draft.protectedMinimumCents)} />
        <Row
          label="Caution level"
          value={`${confidenceLabels[draft.targetConfidence].title} · ${Math.round(
            draft.targetConfidence * 100,
          )}%`}
          detail="A target for the future simulation, not a guarantee."
        />
        <Row label="Forecast horizon" value={`${draft.horizonDays} days`} />
      </ReviewSection>

      <div className="space-y-4">
        {!isValid ? (
          <p className="flex items-start gap-2 text-sm text-destructive" role="alert">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            Some answers need attention before FinTwin can build your profile.
            Use Edit on the highlighted sections.
          </p>
        ) : null}

        {draft.basedOn === "demo" ? (
          <p className="text-xs text-muted-foreground">
            These started as the demo answers. Saving creates your own profile;
            the demo data stays available from Settings.
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={() => editStep(3)}>
              <ArrowLeft aria-hidden />
              Back
            </Button>
            {draft.basedOn !== "blank" ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  discardDraft();
                  router.push("/overview");
                }}
              >
                Discard changes
              </Button>
            ) : null}
          </div>
          <Button
            type="button"
            size="lg"
            className="px-6"
            disabled={!isValid}
            onClick={submit}
          >
            <Sparkles aria-hidden />
            {isEditing ? "Update My Financial Twin" : "Create My Financial Twin"}
          </Button>
        </div>
      </div>

      <PrivacyNotice />
    </div>
  );
}

function money(cents: number | null): string {
  return cents === null ? "Not answered" : formatCents(cents);
}

function firstError(errors: Partial<Record<string, string>>): string | undefined {
  return Object.values(errors)[0];
}

function MonthlySummary({ budget }: { budget: ReturnType<typeof monthlyBudget> }) {
  const overspending = budget.differenceCents < 0;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryFigure
          label="Monthly income"
          value={formatCents(budget.incomeCents)}
          note={
            budget.incomeBasis === "expected_payments"
              ? "Expected payments in the next 30 days"
              : budget.incomeBasis === "none"
                ? "No regular income"
                : "Take-home pay, averaged per month"
          }
        />
        <SummaryFigure
          label="Monthly expenses"
          value={formatCents(budget.expensesCents)}
          note="Housing, bills, spending and allowance"
        />
        <SummaryFigure
          label={overspending ? "Monthly shortfall" : "Left over"}
          value={formatCents(Math.abs(budget.differenceCents))}
          note="Income minus expenses"
        />
      </div>

      <dl className="grid gap-x-6 gap-y-1.5 border-t border-border/70 pt-3 text-xs sm:grid-cols-2">
        <BreakdownRow label="Rent or mortgage" cents={budget.housingCents} />
        <BreakdownRow label="Recurring bills" cents={budget.billsCents} />
        <BreakdownRow label="Everyday spending" cents={budget.variableSpendingCents} />
        <BreakdownRow label="Unexpected expenses" cents={budget.emergencyAllowanceCents} />
      </dl>

      {overspending ? (
        <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
          <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          Your estimated monthly expenses are higher than your estimated monthly
          income. FinTwin will take this into account when forecasting your
          balance.
        </p>
      ) : null}

      <p className="text-xs leading-relaxed text-muted-foreground">
        Monthly figures convert weekly amounts at 52 weeks ÷ 12 months. One-time
        bills aren&rsquo;t monthly, so they&rsquo;re left out here but still
        appear in your forecast on their dates.
      </p>
    </div>
  );
}

function SummaryFigure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="tabular-figures font-heading text-xl font-semibold tracking-tight">
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function BreakdownRow({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-figures">{formatCents(cents)}</dd>
    </div>
  );
}

function ReviewSection({
  title,
  onEdit,
  error,
  children,
}: {
  title: string;
  onEdit: () => void;
  error?: string;
  children: ReactNode;
}) {
  return (
    <Card
      className={cn(
        "[--card-spacing:--spacing(5)]",
        error && "ring-destructive/40",
      )}
    >
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardAction>
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            <Pencil aria-hidden />
            Edit
            <span className="sr-only"> {title}</span>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <p className="flex items-start gap-2 text-xs text-destructive">
            <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            {error}
          </p>
        ) : null}
        <dl className="divide-y divide-border/60">{children}</dl>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex items-start justify-between gap-6 py-2 first:pt-0 last:pb-0">
      <dt className="min-w-0 text-sm">
        {label}
        {detail ? <span className="block text-xs text-muted-foreground">{detail}</span> : null}
      </dt>
      <dd className="tabular-figures shrink-0 text-right text-sm font-medium">{value}</dd>
    </div>
  );
}

function ReviewSkeleton({ label }: { label?: string }) {
  return (
    <div className="space-y-6" aria-busy role="status">
      {label ? <p className="text-sm text-muted-foreground">{label}</p> : null}
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
