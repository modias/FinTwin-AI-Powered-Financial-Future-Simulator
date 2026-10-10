"use client";

import { BillEditor } from "@/components/onboarding/bill-editor";
import {
  CurrencyInput,
  DayOfMonthSelect,
  FieldError,
  Question,
  describedBy,
} from "@/components/onboarding/fields";
import type { StepProps } from "@/components/onboarding/step-props";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function HousingStep({ draft, update, errors, today }: StepProps) {
  return (
    <div className="space-y-8">
      <Question
        fieldId="housingAmount"
        label="How much is your monthly rent or mortgage payment?"
        hint="Enter it here only — don’t add it again as a bill below."
        error={draft.noHousingPayment ? undefined : errors.housingAmount}
      >
        <div className="space-y-3">
          {draft.noHousingPayment ? null : (
            <CurrencyInput
              id="housingAmount"
              valueCents={draft.housingAmountCents}
              onValueChange={(housingAmountCents) => update({ housingAmountCents })}
              placeholder="0.00"
              className="sm:max-w-60"
              aria-invalid={errors.housingAmount ? true : undefined}
              aria-describedby={describedBy("housingAmount", true, errors.housingAmount)}
            />
          )}
          <div className="flex items-center gap-2.5">
            <Switch
              id="noHousingPayment"
              checked={draft.noHousingPayment}
              onCheckedChange={(noHousingPayment) => update({ noHousingPayment })}
            />
            <Label htmlFor="noHousingPayment" className="text-sm font-normal">
              I don&rsquo;t pay rent or mortgage
            </Label>
          </div>
        </div>
      </Question>

      {!draft.noHousingPayment && (draft.housingAmountCents ?? 0) > 0 ? (
        <Question
          fieldId="housingDueDay"
          label="What day of the month is it due?"
          hint="If a month doesn’t have this day — like the 31st in April — FinTwin uses the last day of that month."
          error={errors.housingDueDay}
        >
          <DayOfMonthSelect
            id="housingDueDay"
            value={draft.housingDueDay}
            onValueChange={(housingDueDay) => update({ housingDueDay })}
            invalid={Boolean(errors.housingDueDay)}
            describedBy={describedBy("housingDueDay", true, errors.housingDueDay)}
          />
        </Question>
      ) : null}

      <Question
        fieldId="bills"
        label="What other recurring bills do you have?"
        optional
        hint="Utilities, phone, insurance, loan payments, subscriptions — anything with a known amount and due date. Leave out everyday spending like groceries; that comes next."
        asGroup
      >
        <FieldError id="bills" message={errors.bills} />
        <BillEditor
          bills={draft.bills}
          onChange={(bills) => update({ bills })}
          today={today}
        />
      </Question>
    </div>
  );
}
