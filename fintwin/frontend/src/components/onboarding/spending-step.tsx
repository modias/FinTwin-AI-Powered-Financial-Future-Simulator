"use client";

import { TriangleAlert } from "lucide-react";

import { CurrencyInput, Question } from "@/components/onboarding/fields";
import type { StepProps } from "@/components/onboarding/step-props";
import { OptionTile } from "@/components/shared/option-tile";
import { Label } from "@/components/ui/label";
import { RadioGroup } from "@/components/ui/radio-group";
import { EMERGENCY_ASSUMPTIONS } from "@/lib/constants";
import { formatCents } from "@/lib/money";
import {
  fromMonthlyCents,
  monthlyEmergencyAllowanceCents,
  monthlyVariableSpendingCents,
  toMonthlyCents,
} from "@/lib/profile/normalize";
import { variableSpendingHints, variableSpendingLabels } from "@/lib/profile/labels";
import { cn } from "@/lib/utils";
import {
  VARIABLE_SPENDING_CATEGORIES,
  type OnboardingDraft,
  type SpendingPeriod,
} from "@/types/profile";

/**
 * Switching between weekly and monthly converts the amounts already entered,
 * so "$100 a week" stays the same spending rather than becoming $100 a month.
 */
function convertSpending(
  draft: OnboardingDraft,
  period: SpendingPeriod,
): Partial<OnboardingDraft> {
  const spendingCents = Object.fromEntries(
    VARIABLE_SPENDING_CATEGORIES.map((category) => {
      const value = draft.spendingCents[category];

      return [
        category,
        value === null
          ? null
          : fromMonthlyCents(toMonthlyCents(value, draft.spendingPeriod), period),
      ];
    }),
  ) as OnboardingDraft["spendingCents"];

  return { spendingPeriod: period, spendingCents };
}

export function SpendingStep({ draft, update }: StepProps) {
  const period = draft.spendingPeriod;
  const monthlyTotal = monthlyVariableSpendingCents(draft.spendingCents, period);
  const enteredTotal = VARIABLE_SPENDING_CATEGORIES.reduce(
    (sum, category) => sum + (draft.spendingCents[category] ?? 0),
    0,
  );

  return (
    <div className="space-y-8">
      <Question
        fieldId="spending"
        label="About how much do you spend in each of these?"
        hint="Your best guess is fine — these are estimates, and FinTwin labels them that way. Don’t include rent or the bills you just added. Leave a field blank for $0."
        asGroup
      >
        <div className="space-y-4">
          <div
            role="radiogroup"
            aria-label="Amounts are entered"
            className="inline-flex gap-1 rounded-lg bg-muted p-1"
          >
            {(["weekly", "monthly"] as const).map((option) => (
              <Label
                key={option}
                className={cn(
                  "cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  period === option
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <input
                  type="radio"
                  name="spending-period"
                  value={option}
                  checked={period === option}
                  onChange={() => update(convertSpending(draft, option))}
                  className="sr-only"
                />
                {option === "weekly" ? "Per week" : "Per month"}
              </Label>
            ))}
          </div>

          <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
            {VARIABLE_SPENDING_CATEGORIES.map((category) => {
              const id = `spending-${category}`;

              return (
                <div key={category} className="space-y-1.5">
                  <Label htmlFor={id} className="text-sm">
                    {variableSpendingLabels[category]}
                  </Label>
                  <CurrencyInput
                    id={id}
                    valueCents={draft.spendingCents[category]}
                    onValueChange={(value) =>
                      update({
                        spendingCents: { ...draft.spendingCents, [category]: value },
                      })
                    }
                    placeholder="0"
                    aria-describedby={`${id}-hint`}
                  />
                  <p id={`${id}-hint`} className="text-xs text-muted-foreground">
                    {variableSpendingHints[category]}
                  </p>
                </div>
              );
            })}
          </div>

          <div
            className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3"
            aria-live="polite"
          >
            <span className="text-sm text-muted-foreground">
              Estimated everyday spending
            </span>
            <span className="text-right">
              <span className="tabular-figures font-heading text-lg font-semibold">
                {formatCents(monthlyTotal)}
              </span>
              <span className="text-sm text-muted-foreground"> / month</span>
              {period === "weekly" ? (
                <span className="block text-xs text-muted-foreground">
                  {formatCents(enteredTotal)} a week × 52 weeks ÷ 12 months
                </span>
              ) : null}
            </span>
          </div>
        </div>
      </Question>

      <Question
        fieldId="emergenciesEnabled"
        label="Should FinTwin plan for unexpected expenses?"
        hint="Unexpected expenses can include car repairs, medical costs, or other unplanned purchases."
        asGroup
      >
        <RadioGroup
          id="emergenciesEnabled"
          aria-labelledby="emergenciesEnabled-label"
          value={draft.emergenciesEnabled ? "yes" : "no"}
          onValueChange={(next) => update({ emergenciesEnabled: next === "yes" })}
          className="grid gap-2.5 sm:grid-cols-2"
        >
          <OptionTile
            value="yes"
            title="Yes, include them"
            description={`Sets aside about ${formatCents(monthlyEmergencyAllowanceCents())} a month.`}
            isSelected={draft.emergenciesEnabled}
          />
          <OptionTile
            value="no"
            title="No, leave them out"
            description="Only count the bills and spending I entered."
            isSelected={!draft.emergenciesEnabled}
          />
        </RadioGroup>

        <p className="text-xs leading-relaxed text-muted-foreground">
          The assumption: about {EMERGENCY_ASSUMPTIONS.eventsPerYear} surprises a
          year, averaging {formatCents(EMERGENCY_ASSUMPTIONS.averageCostCents)}{" "}
          each, spread evenly as a small weekly estimate — because nobody knows
          when they&rsquo;ll happen.
        </p>

        {!draft.emergenciesEnabled ? (
          <p className="flex items-start gap-2 rounded-lg bg-warning/8 p-3 text-xs leading-relaxed text-muted-foreground">
            <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0 text-warning" />
            Leaving unexpected expenses out may make your forecast look more
            optimistic than real life tends to be.
          </p>
        ) : null}
      </Question>
    </div>
  );
}
