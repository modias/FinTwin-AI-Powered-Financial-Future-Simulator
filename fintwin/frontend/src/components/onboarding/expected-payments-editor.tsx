"use client";

import { useState } from "react";
import { CalendarPlus, Trash2 } from "lucide-react";

import {
  CurrencyInput,
  DateInput,
  FieldError,
  describedBy,
} from "@/components/onboarding/fields";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { addDays, formatMediumDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { futureDateError } from "@/lib/onboarding/bills";
import { createId } from "@/lib/onboarding/draft";
import { EXPECTED_PAYMENT_MAX_DAYS } from "@/lib/onboarding/validation";
import type { ExpectedPayment } from "@/types/profile";

const MAX_PAYMENTS = 24;

/**
 * Upcoming payments for irregular income. Each one becomes a single estimated
 * income event on its date; nothing is extrapolated from them.
 */
export function ExpectedPaymentsEditor({
  payments,
  onChange,
  today,
  error,
}: {
  payments: ExpectedPayment[];
  onChange: (payments: ExpectedPayment[]) => void;
  today: string;
  error?: string;
}) {
  const [date, setDate] = useState<string | null>(null);
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [errors, setErrors] = useState<{ date?: string; amount?: string }>({});

  const sorted = [...payments].sort((a, b) => (a.date < b.date ? -1 : 1));

  function addPayment() {
    const dateError = futureDateError(
      date,
      today,
      EXPECTED_PAYMENT_MAX_DAYS,
      "Choose the date you expect it.",
    );
    const amountError =
      amountCents === null || amountCents === 0
        ? "Enter the amount you expect."
        : undefined;

    if (dateError || amountError) {
      setErrors({ date: dateError ?? undefined, amount: amountError });
      return;
    }

    onChange([
      ...payments,
      { id: createId("payment"), date: date as string, amountCents: amountCents as number },
    ]);
    setDate(null);
    setAmountCents(null);
    setErrors({});
  }

  return (
    <div className="space-y-3">
      {sorted.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {sorted.map((payment) => (
            <li
              key={payment.id}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <span className="text-sm">
                {formatMediumDate(payment.date)}
                {payment.date <= today ? (
                  <span className="ml-2 text-xs text-destructive">Date has passed</span>
                ) : null}
              </span>
              <span className="flex items-center gap-2">
                <span className="tabular-figures text-sm font-medium">
                  {formatCents(payment.amountCents)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() =>
                    onChange(payments.filter((candidate) => candidate.id !== payment.id))
                  }
                >
                  <Trash2 aria-hidden />
                  <span className="sr-only">
                    Remove the {formatCents(payment.amountCents)} payment on{" "}
                    {formatMediumDate(payment.date)}
                  </span>
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <FieldError id="expectedPayments" message={error} />

      {payments.length < MAX_PAYMENTS ? (
        <div
          className="grid gap-3 rounded-lg border border-dashed border-border p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start"
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT") {
              event.preventDefault();
              addPayment();
            }
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="expected-payment-date" className="text-xs">
              Expected date
            </Label>
            <DateInput
              id="expected-payment-date"
              value={date}
              onValueChange={setDate}
              min={addDays(today, 1)}
              max={addDays(today, EXPECTED_PAYMENT_MAX_DAYS)}
              aria-invalid={errors.date ? true : undefined}
              aria-describedby={describedBy("expected-payment-date", false, errors.date)}
            />
            <FieldError id="expected-payment-date" message={errors.date} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expected-payment-amount" className="text-xs">
              Amount after taxes
            </Label>
            <CurrencyInput
              id="expected-payment-amount"
              valueCents={amountCents}
              onValueChange={setAmountCents}
              placeholder="0.00"
              aria-invalid={errors.amount ? true : undefined}
              aria-describedby={describedBy("expected-payment-amount", false, errors.amount)}
            />
            <FieldError id="expected-payment-amount" message={errors.amount} />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-9 sm:mt-[22px]"
            onClick={addPayment}
          >
            <CalendarPlus aria-hidden />
            Add payment
          </Button>
        </div>
      ) : null}
    </div>
  );
}
