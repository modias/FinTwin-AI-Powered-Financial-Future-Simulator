"use client";

import { ExpectedPaymentsEditor } from "@/components/onboarding/expected-payments-editor";
import {
  CurrencyInput,
  DateInput,
  DayOfMonthSelect,
  FieldError,
  Question,
  describedBy,
} from "@/components/onboarding/fields";
import type { StepProps } from "@/components/onboarding/step-props";
import { OptionTile } from "@/components/shared/option-tile";
import { RadioGroup } from "@/components/ui/radio-group";
import { addDays } from "@/lib/dates";
import {
  payFrequencyDescriptions,
  payFrequencyLabels,
} from "@/lib/profile/labels";
import {
  isScheduledPayFrequency,
  requiresPaycheckAmount,
} from "@/lib/onboarding/validation";
import { PAY_FREQUENCIES, type PayFrequency } from "@/types/profile";

const NEXT_PAYDAY_WINDOW: Record<"weekly" | "biweekly" | "monthly", number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 31,
};

export function IncomeStep({ draft, update, errors, today }: StepProps) {
  const frequency = draft.payFrequency;
  const amountIsOptional = !requiresPaycheckAmount(frequency) && frequency !== null;

  return (
    <div className="space-y-8">
      <Question
        fieldId="balance"
        label="What is your current checking account balance?"
        hint="Your available balance right now — the number your banking app shows as available to spend. Just the amount: FinTwin never asks for bank logins or account numbers."
        error={errors.balance}
      >
        <CurrencyInput
          id="balance"
          valueCents={draft.balanceCents}
          onValueChange={(balanceCents) => update({ balanceCents })}
          placeholder="0.00"
          className="sm:max-w-60"
          aria-invalid={errors.balance ? true : undefined}
          aria-describedby={describedBy("balance", true, errors.balance)}
        />
      </Question>

      <Question
        fieldId="paycheckAmount"
        label="How much is your typical paycheck after taxes?"
        optional={amountIsOptional}
        hint={
          frequency === "irregular"
            ? "Your typical take-home amount, if there is one. For irregular income, the forecast only counts the specific payments you list below."
            : "Your take-home pay — what actually lands in your account after taxes and deductions. Enter 0 if you don’t have regular income."
        }
        error={errors.paycheckAmount}
      >
        <CurrencyInput
          id="paycheckAmount"
          valueCents={draft.paycheckAmountCents}
          onValueChange={(paycheckAmountCents) => update({ paycheckAmountCents })}
          placeholder="0.00"
          className="sm:max-w-60"
          aria-invalid={errors.paycheckAmount ? true : undefined}
          aria-describedby={describedBy("paycheckAmount", true, errors.paycheckAmount)}
        />
      </Question>

      <Question
        fieldId="payFrequency"
        label="How often are you paid?"
        error={errors.payFrequency}
        asGroup
      >
        <RadioGroup
          id="payFrequency"
          aria-labelledby="payFrequency-label"
          aria-invalid={errors.payFrequency ? true : undefined}
          aria-describedby={describedBy("payFrequency", false, errors.payFrequency)}
          value={frequency ?? ""}
          onValueChange={(next) => update({ payFrequency: next as PayFrequency })}
          className="grid gap-2.5 sm:grid-cols-2"
        >
          {PAY_FREQUENCIES.map((option) => (
            <OptionTile
              key={option}
              value={option}
              title={payFrequencyLabels[option]}
              description={payFrequencyDescriptions[option]}
              isSelected={frequency === option}
            />
          ))}
        </RadioGroup>
      </Question>

      {isScheduledPayFrequency(frequency) ? (
        <Question
          fieldId="nextPayday"
          label="When is your next payday?"
          hint="Every future paycheck is placed on the calendar from this date, so choose the real one — FinTwin won’t guess it."
          error={errors.nextPayday}
        >
          <DateInput
            id="nextPayday"
            value={draft.nextPayday}
            onValueChange={(nextPayday) => update({ nextPayday })}
            min={addDays(today, 1)}
            max={addDays(today, NEXT_PAYDAY_WINDOW[frequency])}
            aria-invalid={errors.nextPayday ? true : undefined}
            aria-describedby={describedBy("nextPayday", true, errors.nextPayday)}
          />
        </Question>
      ) : null}

      {frequency === "semimonthly" ? (
        <Question
          fieldId="semimonthlyPaydays"
          label="Which two days of the month are you paid?"
          hint="For example, the 1st and the 15th. When a month is shorter than the day you choose, FinTwin uses that month’s last day."
          asGroup
        >
          <div
            className="flex flex-col gap-2 sm:flex-row"
            role="group"
            aria-labelledby="semimonthlyPaydays-label"
          >
            <DayOfMonthSelect
              id="semimonthlyPaydays"
              aria-label="First payday"
              placeholder="First payday"
              value={draft.semimonthlyPaydays[0]}
              onValueChange={(day) =>
                update({ semimonthlyPaydays: [day, draft.semimonthlyPaydays[1]] })
              }
              invalid={Boolean(errors.semimonthlyPaydays)}
              describedBy={describedBy("semimonthlyPaydays", true, errors.semimonthlyPaydays)}
            />
            <DayOfMonthSelect
              id="semimonthlyPaydays-2"
              aria-label="Second payday"
              placeholder="Second payday"
              value={draft.semimonthlyPaydays[1]}
              onValueChange={(day) =>
                update({ semimonthlyPaydays: [draft.semimonthlyPaydays[0], day] })
              }
              invalid={Boolean(errors.semimonthlyPaydays)}
              describedBy={describedBy("semimonthlyPaydays", true, errors.semimonthlyPaydays)}
            />
          </div>
          <FieldError id="semimonthlyPaydays" message={errors.semimonthlyPaydays} />
        </Question>
      ) : null}

      {frequency === "irregular" ? (
        <Question
          fieldId="expectedPayments"
          label="Upcoming payments you expect"
          optional
          hint="Add payments you’re reasonably confident about. Each one is counted once, on its date. If you skip this, FinTwin counts no income at all rather than guessing."
          asGroup
        >
          <ExpectedPaymentsEditor
            payments={draft.expectedPayments}
            onChange={(expectedPayments) => update({ expectedPayments })}
            today={today}
            error={errors.expectedPayments}
          />
        </Question>
      ) : null}

      {frequency === "none" ? (
        <p className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
          FinTwin won&rsquo;t add any paychecks to your forecast. Your balance
          will only change with the bills and spending you enter next.
        </p>
      ) : null}
    </div>
  );
}
