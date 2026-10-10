"use client";

import { useState } from "react";

import { CurrencyInput, Question, describedBy } from "@/components/onboarding/fields";
import type { StepProps } from "@/components/onboarding/step-props";
import { OptionTile } from "@/components/shared/option-tile";
import { RadioGroup } from "@/components/ui/radio-group";
import { FORECAST_HORIZONS } from "@/lib/constants";
import { formatCents } from "@/lib/money";
import { PROTECTED_MINIMUM_PRESETS_CENTS } from "@/lib/onboarding/draft";
import { confidenceLabels } from "@/lib/profile/labels";
import type { ForecastHorizon } from "@/types/financial";
import { PROFILE_CONFIDENCES, type ProfileConfidence } from "@/types/profile";

const HORIZON_DESCRIPTIONS: Record<ForecastHorizon, string> = {
  30: "The month ahead.",
  60: "The next two months.",
  90: "A full season, with room for bigger one-off costs.",
};

function isPreset(cents: number | null): boolean {
  return (PROTECTED_MINIMUM_PRESETS_CENTS as readonly number[]).includes(cents ?? -1);
}

export function SafetyStep({ draft, update, errors }: StepProps) {
  // "Custom" stays selected while typing, even if the amount happens to match a preset.
  const [isCustom, setIsCustom] = useState(() => !isPreset(draft.protectedMinimumCents));

  return (
    <div className="space-y-8">
      <Question
        fieldId="protectedMinimum"
        label="What is the lowest balance you want to keep in your account?"
        hint="FinTwin treats this as a floor: every spending estimate keeps your balance above it."
        error={errors.protectedMinimum}
        asGroup
      >
        <RadioGroup
          aria-labelledby="protectedMinimum-label"
          value={isCustom ? "custom" : String(draft.protectedMinimumCents)}
          onValueChange={(next) => {
            if (next === "custom") {
              setIsCustom(true);
              return;
            }

            setIsCustom(false);
            update({ protectedMinimumCents: Number(next) });
          }}
          className="grid grid-cols-2 gap-2.5 sm:grid-cols-4"
        >
          {PROTECTED_MINIMUM_PRESETS_CENTS.map((preset) => (
            <OptionTile
              key={preset}
              value={String(preset)}
              title={formatCents(preset).replace(".00", "")}
              isSelected={!isCustom && draft.protectedMinimumCents === preset}
            />
          ))}
          <OptionTile value="custom" title="Custom" isSelected={isCustom} />
        </RadioGroup>

        {isCustom ? (
          <CurrencyInput
            id="protectedMinimum"
            aria-label="Custom minimum balance"
            valueCents={draft.protectedMinimumCents}
            onValueChange={(protectedMinimumCents) => update({ protectedMinimumCents })}
            placeholder="0.00"
            className="sm:max-w-60"
            aria-invalid={errors.protectedMinimum ? true : undefined}
            aria-describedby={describedBy("protectedMinimum", true, errors.protectedMinimum)}
          />
        ) : null}
      </Question>

      <Question
        fieldId="targetConfidence"
        label="How cautious should FinTwin be?"
        hint="These are the odds the future simulation will aim for when it decides what’s safe to spend. They are targets, not guarantees."
        asGroup
      >
        <RadioGroup
          aria-labelledby="targetConfidence-label"
          value={String(draft.targetConfidence)}
          onValueChange={(next) =>
            update({ targetConfidence: Number(next) as ProfileConfidence })
          }
          className="grid gap-2.5 sm:grid-cols-3"
        >
          {PROFILE_CONFIDENCES.map((confidence) => (
            <OptionTile
              key={confidence}
              value={String(confidence)}
              title={`${confidenceLabels[confidence].title} · ${Math.round(confidence * 100)}%`}
              description={`${confidenceLabels[confidence].description}${
                confidence === 0.95 ? " Recommended." : ""
              }`}
              isSelected={draft.targetConfidence === confidence}
            />
          ))}
        </RadioGroup>
        <p className="text-xs leading-relaxed text-muted-foreground">
          The simulation that uses this isn&rsquo;t available yet. Until it is,
          FinTwin shows a simple illustrative estimate and never presents it as
          a probability.
        </p>
      </Question>

      <Question
        fieldId="horizonDays"
        label="How far into the future should we look?"
        asGroup
      >
        <RadioGroup
          aria-labelledby="horizonDays-label"
          value={String(draft.horizonDays)}
          onValueChange={(next) => update({ horizonDays: Number(next) as ForecastHorizon })}
          className="grid gap-2.5 sm:grid-cols-3"
        >
          {FORECAST_HORIZONS.map((horizon) => (
            <OptionTile
              key={horizon}
              value={String(horizon)}
              title={`${horizon} days`}
              description={HORIZON_DESCRIPTIONS[horizon]}
              isSelected={draft.horizonDays === horizon}
            />
          ))}
        </RadioGroup>
      </Question>
    </div>
  );
}
