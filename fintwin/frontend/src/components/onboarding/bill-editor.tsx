"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  CurrencyInput,
  DateInput,
  DayOfMonthSelect,
  FieldError,
  Question,
  describedBy,
} from "@/components/onboarding/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { categoryIcons } from "@/lib/category-visuals";
import { addDays } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import {
  EMPTY_BILL_INPUT,
  ONE_TIME_BILL_MAX_DAYS,
  addBill,
  billToInput,
  removeBill,
  updateBill,
  validateBillInput,
  type BillInput,
} from "@/lib/onboarding/bills";
import { createId } from "@/lib/onboarding/draft";
import type { FieldErrors } from "@/lib/onboarding/validation";
import {
  billCategoryLabels,
  billCategoryToDomain,
  billFrequencyLabels,
  describeBillSchedule,
} from "@/lib/profile/labels";
import {
  BILL_CATEGORIES,
  BILL_FREQUENCIES,
  type BillCategory,
  type BillFrequency,
  type ProfileBill,
} from "@/types/profile";

const MAX_BILLS = 50;

/** Which bill the form is for: a new one, an existing one, or closed. */
type EditorState = { mode: "closed" } | { mode: "add" } | { mode: "edit"; id: string };

export function BillEditor({
  bills,
  onChange,
  today,
}: {
  bills: ProfileBill[];
  onChange: (bills: ProfileBill[]) => void;
  today: string;
}) {
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });

  function handleRemove(bill: ProfileBill) {
    const previous = bills;

    onChange(removeBill(bills, bill.id));
    toast(`Removed “${bill.name}”`, {
      action: { label: "Undo", onClick: () => onChange(previous) },
    });
  }

  return (
    <div className="space-y-3">
      {bills.length > 0 ? (
        <ul className="space-y-2">
          {bills.map((bill) =>
            editor.mode === "edit" && editor.id === bill.id ? (
              <li key={bill.id}>
                <BillForm
                  initial={billToInput(bill)}
                  editingId={bill.id}
                  bills={bills}
                  today={today}
                  onCancel={() => setEditor({ mode: "closed" })}
                  onSave={(saved) => {
                    onChange(updateBill(bills, saved));
                    setEditor({ mode: "closed" });
                  }}
                />
              </li>
            ) : (
              <BillRow
                key={bill.id}
                bill={bill}
                onEdit={() => setEditor({ mode: "edit", id: bill.id })}
                onRemove={() => handleRemove(bill)}
              />
            ),
          )}
        </ul>
      ) : null}

      {editor.mode === "add" ? (
        <BillForm
          initial={EMPTY_BILL_INPUT}
          bills={bills}
          today={today}
          onCancel={() => setEditor({ mode: "closed" })}
          onSave={(saved) => {
            onChange(addBill(bills, saved));
            setEditor({ mode: "closed" });
          }}
        />
      ) : bills.length < MAX_BILLS ? (
        <Button
          type="button"
          variant="outline"
          className="h-9 w-full border-dashed sm:w-auto"
          onClick={() => setEditor({ mode: "add" })}
          disabled={editor.mode === "edit"}
        >
          <Plus aria-hidden />
          Add a bill
        </Button>
      ) : null}

      {bills.length === 0 && editor.mode === "closed" ? (
        <p className="text-xs text-muted-foreground">
          No other recurring bills? You can skip this and continue.
        </p>
      ) : null}
    </div>
  );
}

function BillRow({
  bill,
  onEdit,
  onRemove,
}: {
  bill: ProfileBill;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const Icon = categoryIcons[billCategoryToDomain[bill.category]];

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon aria-hidden className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{bill.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {billCategoryLabels[bill.category]} · {describeBillSchedule(bill)}
        </span>
      </span>
      <span className="tabular-figures shrink-0 text-sm font-medium">
        {formatCents(bill.amountCents)}
      </span>
      <span className="flex shrink-0 items-center">
        <Button type="button" variant="ghost" size="icon-sm" onClick={onEdit}>
          <Pencil aria-hidden />
          <span className="sr-only">Edit {bill.name}</span>
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove}>
          <Trash2 aria-hidden />
          <span className="sr-only">Remove {bill.name}</span>
        </Button>
      </span>
    </li>
  );
}

function BillForm({
  initial,
  editingId,
  bills,
  today,
  onSave,
  onCancel,
}: {
  initial: BillInput;
  editingId?: string;
  bills: ProfileBill[];
  today: string;
  onSave: (bill: ProfileBill) => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState<BillInput>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const prefix = editingId ? `bill-${editingId}` : "bill-new";
  const ids = {
    name: `${prefix}-name`,
    amount: `${prefix}-amount`,
    category: `${prefix}-category`,
    frequency: `${prefix}-frequency`,
    nextDueDate: `${prefix}-next-due`,
    dueDay: `${prefix}-due-day`,
    dueDays: `${prefix}-due-days`,
  };

  const set = (patch: Partial<BillInput>) => setInput((current) => ({ ...current, ...patch }));

  function submit() {
    const result = validateBillInput(input, {
      existing: bills,
      today,
      editingId,
      createId: () => createId("bill"),
    });

    if (!result.ok) {
      setErrors(result.errors);

      const first = Object.keys(result.errors)[0] as keyof typeof ids | undefined;

      if (first) document.getElementById(ids[first])?.focus();

      return;
    }

    onSave(result.bill);
  }

  const frequency = input.frequency;
  const needsDate =
    frequency === "weekly" || frequency === "biweekly" || frequency === "one_time";
  const maxDays =
    frequency === "weekly" ? 7 : frequency === "biweekly" ? 14 : ONE_TIME_BILL_MAX_DAYS;

  return (
    <div
      className="space-y-4 rounded-xl border border-primary/30 bg-primary/4 p-4"
      role="group"
      aria-label={editingId ? "Edit bill" : "Add a bill"}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT") {
          event.preventDefault();
          submit();
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Question fieldId={ids.name} label="Bill name" error={errors.name}>
          <Input
            id={ids.name}
            value={input.name}
            onChange={(event) => set({ name: event.target.value })}
            placeholder="e.g. Electric, Car insurance"
            maxLength={60}
            autoComplete="off"
            className="h-9"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={describedBy(ids.name, false, errors.name)}
          />
        </Question>

        <Question fieldId={ids.amount} label="Amount" error={errors.amount}>
          <CurrencyInput
            id={ids.amount}
            valueCents={input.amountCents}
            onValueChange={(amountCents) => set({ amountCents })}
            placeholder="0.00"
            aria-invalid={errors.amount ? true : undefined}
            aria-describedby={describedBy(ids.amount, false, errors.amount)}
          />
        </Question>

        <Question fieldId={ids.category} label="Category" error={errors.category}>
          <Select
            value={input.category ?? ""}
            onValueChange={(category) => set({ category: category as BillCategory })}
          >
            <SelectTrigger
              id={ids.category}
              className="h-9 w-full"
              aria-invalid={errors.category ? true : undefined}
              aria-describedby={describedBy(ids.category, false, errors.category)}
            >
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent position="popper">
              {BILL_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {billCategoryLabels[category]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Question>

        <Question fieldId={ids.frequency} label="How often" error={errors.frequency}>
          <Select
            value={frequency ?? ""}
            onValueChange={(next) => set({ frequency: next as BillFrequency })}
          >
            <SelectTrigger
              id={ids.frequency}
              className="h-9 w-full"
              aria-invalid={errors.frequency ? true : undefined}
              aria-describedby={describedBy(ids.frequency, false, errors.frequency)}
            >
              <SelectValue placeholder="Choose how often" />
            </SelectTrigger>
            <SelectContent position="popper">
              {BILL_FREQUENCIES.map((option) => (
                <SelectItem key={option} value={option}>
                  {billFrequencyLabels[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Question>
      </div>

      {needsDate ? (
        <Question
          fieldId={ids.nextDueDate}
          label={frequency === "one_time" ? "Due date" : "Next due date"}
          error={errors.nextDueDate}
        >
          <DateInput
            id={ids.nextDueDate}
            value={input.nextDueDate}
            onValueChange={(nextDueDate) => set({ nextDueDate })}
            min={addDays(today, 1)}
            max={addDays(today, maxDays)}
            aria-invalid={errors.nextDueDate ? true : undefined}
            aria-describedby={describedBy(ids.nextDueDate, false, errors.nextDueDate)}
          />
        </Question>
      ) : null}

      {frequency === "monthly" ? (
        <Question
          fieldId={ids.dueDay}
          label="Day of the month it’s due"
          hint="In shorter months, a day like the 31st falls on the last day of the month."
          error={errors.dueDay}
        >
          <DayOfMonthSelect
            id={ids.dueDay}
            value={input.dueDay}
            onValueChange={(dueDay) => set({ dueDay })}
            invalid={Boolean(errors.dueDay)}
            describedBy={describedBy(ids.dueDay, true, errors.dueDay)}
          />
        </Question>
      ) : null}

      {frequency === "semimonthly" ? (
        <Question
          fieldId={ids.dueDays}
          label="The two days of the month it’s due"
          hint="In shorter months, a day like the 31st falls on the last day of the month."
          asGroup
        >
          <div
            className="flex flex-col gap-2 sm:flex-row"
            role="group"
            aria-labelledby={`${ids.dueDays}-label`}
          >
            <DayOfMonthSelect
              id={ids.dueDays}
              aria-label="First due day"
              placeholder="First day"
              value={input.dueDays[0]}
              onValueChange={(day) => set({ dueDays: [day, input.dueDays[1]] })}
              invalid={Boolean(errors.dueDays)}
              describedBy={describedBy(ids.dueDays, true, errors.dueDays)}
            />
            <DayOfMonthSelect
              id={`${ids.dueDays}-2`}
              aria-label="Second due day"
              placeholder="Second day"
              value={input.dueDays[1]}
              onValueChange={(day) => set({ dueDays: [input.dueDays[0], day] })}
              invalid={Boolean(errors.dueDays)}
              describedBy={describedBy(ids.dueDays, true, errors.dueDays)}
            />
          </div>
          <FieldError id={ids.dueDays} message={errors.dueDays} />
        </Question>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={submit}>
          {editingId ? "Save bill" : "Add bill"}
        </Button>
      </div>
    </div>
  );
}
