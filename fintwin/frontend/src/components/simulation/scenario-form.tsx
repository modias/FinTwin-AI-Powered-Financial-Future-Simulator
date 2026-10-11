"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Play } from "lucide-react";

import { CurrencyInput, DateInput, Question, describedBy } from "@/components/onboarding/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addDays } from "@/lib/dates";
import { SCENARIO_LABELS, scenarioIssues } from "@/simulation/scenarios";
import { financialScenarioSchema } from "@/simulation/schemas";
import {
  SCENARIO_FREQUENCIES,
  SCENARIO_TYPES,
  type FinancialScenario,
  type ScenarioFrequency,
  type ScenarioType,
  type SimulationInput,
} from "@/simulation/types";

export interface ScenarioDraft {
  type: ScenarioType;
  amountCents: number | null;
  effectiveDate: string | null;
  frequency: ScenarioFrequency | null;
  description: string;
}

const AMOUNT_HINTS: Record<ScenarioType, string> = {
  one_time_purchase: "The full price, paid on the date below.",
  delayed_purchase: "The full price, paid later instead of today.",
  recurring_expense: "The amount each time it repeats.",
  emergency_expense: "A specific surprise cost you want to test.",
  income_increase: "Extra per paycheck, from the date below.",
  income_decrease: "Less per paycheck, from the date below.",
  rent_increase: "Extra per rent or mortgage payment.",
  rent_decrease: "Less per rent or mortgage payment.",
};

const FREQUENCY_LABELS: Record<ScenarioFrequency, string> = {
  weekly: "Every week",
  biweekly: "Every two weeks",
  monthly: "Every month",
};

export function emptyScenarioDraft(input: SimulationInput): ScenarioDraft {
  return {
    type: "one_time_purchase",
    amountCents: null,
    effectiveDate: input.referenceDate,
    frequency: null,
    description: "",
  };
}

/** The draft as a scenario, or the problems to fix first. */
export function validateScenarioDraft(
  draft: ScenarioDraft,
  input: SimulationInput,
): { scenario: FinancialScenario; errors: null } | { scenario: null; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (draft.amountCents === null || draft.amountCents <= 0) {
    errors.amount = "Enter an amount above $0.";
  }

  if (!draft.effectiveDate) {
    errors.date = "Choose a date.";
  }

  if (draft.type === "recurring_expense" && !draft.frequency) {
    errors.frequency = "Choose how often it repeats.";
  }

  if (Object.keys(errors).length > 0) return { scenario: null, errors };

  const candidate: FinancialScenario = {
    id: [draft.type, draft.amountCents, draft.effectiveDate, draft.frequency ?? "once"].join(":"),
    type: draft.type,
    amountCents: draft.amountCents ?? 0,
    effectiveDate: draft.effectiveDate ?? input.referenceDate,
    frequency: draft.type === "recurring_expense" ? draft.frequency : null,
    description: draft.description.trim() || SCENARIO_LABELS[draft.type],
  };
  const parsed = financialScenarioSchema.safeParse(candidate);

  if (!parsed.success) {
    return { scenario: null, errors: { form: parsed.error.issues[0]?.message ?? "Check these details." } };
  }

  const issues = scenarioIssues(parsed.data, input);

  if (issues.length > 0) return { scenario: null, errors: { date: issues.join(" ") } };

  return { scenario: parsed.data, errors: null };
}

export function draftFromScenario(scenario: FinancialScenario): ScenarioDraft {
  return {
    type: scenario.type,
    amountCents: scenario.amountCents,
    effectiveDate: scenario.effectiveDate,
    frequency: scenario.frequency,
    description: scenario.description,
  };
}

/**
 * One what-if. Nothing runs until it's submitted, and it's validated against
 * the forecast it will be tested on (the date must fall inside the horizon).
 */
export function ScenarioForm({
  idPrefix,
  input,
  draft,
  onDraftChange,
  onSubmit,
  submitLabel = "Run what-if",
  disabled = false,
  footer,
}: {
  idPrefix: string;
  input: SimulationInput;
  draft: ScenarioDraft;
  onDraftChange: (draft: ScenarioDraft) => void;
  onSubmit: (scenario: FinancialScenario) => void;
  submitLabel?: string;
  disabled?: boolean;
  footer?: ReactNode;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const ids = {
    type: `${idPrefix}-type`,
    amount: `${idPrefix}-amount`,
    date: `${idPrefix}-date`,
    frequency: `${idPrefix}-frequency`,
    description: `${idPrefix}-description`,
  };
  const lastDay = addDays(input.referenceDate, input.horizonDays);

  function update(patch: Partial<ScenarioDraft>) {
    onDraftChange({ ...draft, ...patch });
    setErrors({});
  }

  function changeType(type: ScenarioType) {
    const nextIncome = input.scheduledIncome[0]?.date;

    update({
      type,
      frequency: type === "recurring_expense" ? (draft.frequency ?? "monthly") : null,
      effectiveDate:
        type === "delayed_purchase" && draft.effectiveDate === input.referenceDate
          ? (nextIncome ?? addDays(input.referenceDate, 7))
          : draft.effectiveDate,
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();

    const result = validateScenarioDraft(draft, input);

    if (result.errors) {
      setErrors(result.errors);
      return;
    }

    onSubmit(result.scenario);
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Question fieldId={ids.type} label="What do you want to test?">
          <Select value={draft.type} onValueChange={(value) => changeType(value as ScenarioType)}>
            <SelectTrigger id={ids.type} className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {SCENARIO_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {SCENARIO_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Question>

        <Question
          fieldId={ids.amount}
          label="Amount"
          hint={AMOUNT_HINTS[draft.type]}
          error={errors.amount}
        >
          <CurrencyInput
            id={ids.amount}
            valueCents={draft.amountCents}
            onValueChange={(amountCents) => update({ amountCents })}
            placeholder="0.00"
            aria-invalid={errors.amount ? true : undefined}
            aria-describedby={describedBy(ids.amount, true, errors.amount)}
          />
        </Question>

        <Question
          fieldId={ids.date}
          label={draft.type === "one_time_purchase" || draft.type === "delayed_purchase" || draft.type === "emergency_expense" ? "When" : "Starting"}
          hint={`Today is day 0. The forecast runs to day ${input.horizonDays}.`}
          error={errors.date}
        >
          <DateInput
            id={ids.date}
            value={draft.effectiveDate}
            min={draft.type === "delayed_purchase" ? addDays(input.referenceDate, 1) : input.referenceDate}
            max={lastDay}
            onValueChange={(effectiveDate) => update({ effectiveDate })}
            aria-invalid={errors.date ? true : undefined}
            aria-describedby={describedBy(ids.date, true, errors.date)}
          />
        </Question>

        {draft.type === "recurring_expense" ? (
          <Question fieldId={ids.frequency} label="How often" error={errors.frequency}>
            <Select
              value={draft.frequency ?? ""}
              onValueChange={(value) => update({ frequency: value as ScenarioFrequency })}
            >
              <SelectTrigger
                id={ids.frequency}
                className="h-9 w-full"
                aria-invalid={errors.frequency ? true : undefined}
              >
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent position="popper">
                {SCENARIO_FREQUENCIES.map((frequency) => (
                  <SelectItem key={frequency} value={frequency}>
                    {FREQUENCY_LABELS[frequency]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Question>
        ) : null}

        <Question fieldId={ids.description} label="Description" optional>
          <Input
            id={ids.description}
            value={draft.description}
            maxLength={120}
            placeholder={SCENARIO_LABELS[draft.type]}
            onChange={(event) => update({ description: event.target.value })}
            className="h-9"
          />
        </Question>
      </div>

      {errors.form ? <p className="text-xs text-destructive">{errors.form}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={disabled}>
          <Play aria-hidden />
          {submitLabel}
        </Button>
        {footer}
      </div>
    </form>
  );
}
