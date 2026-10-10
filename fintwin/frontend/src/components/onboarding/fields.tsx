"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MAX_AMOUNT_CENTS } from "@/lib/constants";
import {
  centsToInputText,
  parseCurrencyToCents,
  sanitizeCurrencyInput,
} from "@/lib/money";
import { ordinal } from "@/lib/profile/labels";
import { cn } from "@/lib/utils";

export function errorId(fieldId: string): string {
  return `${fieldId}-error`;
}

export function hintId(fieldId: string): string {
  return `${fieldId}-hint`;
}

/** `aria-describedby` for a field, pointing at whichever of its hint and error exist. */
export function describedBy(fieldId: string, hasHint: boolean, error?: string) {
  const ids = [hasHint ? hintId(fieldId) : null, error ? errorId(fieldId) : null]
    .filter(Boolean)
    .join(" ");

  return ids || undefined;
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;

  return (
    <p
      id={errorId(id)}
      className="flex items-start gap-1.5 text-xs leading-relaxed text-destructive"
    >
      <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      {message}
    </p>
  );
}

/**
 * One question: a label, optional explanation, the control and its error.
 * `fieldId` is the id of the control, so the label and messages attach to it.
 */
export function Question({
  fieldId,
  label,
  hint,
  error,
  optional = false,
  asGroup = false,
  children,
  className,
}: {
  fieldId: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  /** For radio groups and other multi-control answers, labelled by the heading instead. */
  asGroup?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const labelContent = (
    <>
      {label}
      {optional ? (
        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
          Optional
        </span>
      ) : null}
    </>
  );

  return (
    <div className={cn("space-y-2", className)}>
      <div className="space-y-1">
        {asGroup ? (
          <p id={`${fieldId}-label`} className="text-sm font-medium">
            {labelContent}
          </p>
        ) : (
          <Label htmlFor={fieldId} className="text-sm">
            {labelContent}
          </Label>
        )}
        {hint ? (
          <p
            id={hintId(fieldId)}
            className="text-xs leading-relaxed text-muted-foreground"
          >
            {hint}
          </p>
        ) : null}
      </div>
      {children}
      <FieldError id={fieldId} message={error} />
    </div>
  );
}

type CurrencyInputProps = Omit<
  ComponentProps<"input">,
  "value" | "onChange" | "type" | "defaultValue"
> & {
  valueCents: number | null;
  onValueChange: (cents: number | null) => void;
};

/**
 * A dollar amount field that reports integer cents.
 *
 * It keeps its own text so in-between states like `12.` survive typing, and
 * re-seeds from `valueCents` when the value changes from outside (a preset, a
 * reset) — during render, not in an effect. Keystrokes that would exceed the
 * maximum amount are ignored.
 */
export function CurrencyInput({
  valueCents,
  onValueChange,
  className,
  onBlur,
  ...props
}: CurrencyInputProps) {
  const [field, setField] = useState({
    text: centsToInputText(valueCents),
    syncedWith: valueCents,
  });

  if (field.syncedWith !== valueCents) {
    setField({ text: centsToInputText(valueCents), syncedWith: valueCents });
  }

  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
      >
        $
      </span>
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={field.text}
        onChange={(event) => {
          const text = sanitizeCurrencyInput(event.target.value);
          const cents = parseCurrencyToCents(text);

          if (cents !== null && cents > MAX_AMOUNT_CENTS) return;

          setField({ text, syncedWith: cents });
          onValueChange(cents);
        }}
        onBlur={(event) => {
          setField({ text: centsToInputText(valueCents), syncedWith: valueCents });
          onBlur?.(event);
        }}
        className={cn("tabular-figures h-9 pl-6", className)}
      />
    </div>
  );
}

const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

export function DayOfMonthSelect({
  id,
  value,
  onValueChange,
  placeholder = "Choose a day",
  invalid,
  describedBy: ariaDescribedBy,
  className,
  "aria-label": ariaLabel,
}: {
  id: string;
  value: number | null;
  onValueChange: (day: number) => void;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <Select
      value={value === null ? "" : String(value)}
      onValueChange={(next) => onValueChange(Number(next))}
    >
      <SelectTrigger
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        className={cn("h-9 w-full sm:w-44", className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper" className="max-h-64">
        {DAYS.map((day) => (
          <SelectItem key={day} value={String(day)}>
            {ordinal(day)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** A native date picker limited to `[min, max]`. */
export function DateInput({
  value,
  onValueChange,
  className,
  ...props
}: Omit<ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: string | null;
  onValueChange: (date: string | null) => void;
}) {
  return (
    <Input
      {...props}
      type="date"
      value={value ?? ""}
      onChange={(event) => onValueChange(event.target.value || null)}
      className={cn("h-9 w-full sm:w-52", className)}
    />
  );
}
