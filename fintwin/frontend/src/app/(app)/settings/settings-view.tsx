"use client";

import { useId, useState } from "react";
import { Check, Monitor, Moon, RotateCcw, Sun } from "lucide-react";

import { ProfileSettingsCard } from "@/app/(app)/settings/profile-settings-card";
import { PrivacyNotice } from "@/components/onboarding/privacy-notice";
import { useActiveWorkspace, useWorkspace } from "@/components/providers/workspace-provider";
import { SimulationDisclaimer } from "@/components/shared/disclosure-badges";
import { OptionTile } from "@/components/shared/option-tile";
import { PageHeader } from "@/components/shared/page-header";
import { safeToSpendText } from "@/components/simulation/scenario-impact";
import { SimulationError, SimulationRunning } from "@/components/simulation/simulation-states";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useSimulation } from "@/hooks/use-simulation";
import {
  DEFAULT_PREFERENCES,
  EMERGENCY_ASSUMPTIONS,
  FORECAST_HORIZONS,
  TARGET_CONFIDENCES,
} from "@/lib/constants";
import { formatCurrency, formatProbability } from "@/lib/formatters";
import { formatCents } from "@/lib/money";
import type {
  ForecastHorizon,
  TargetConfidence,
  ThemePreference,
} from "@/types/financial";

const PROTECTED_BALANCE_PRESETS = [0, 100, 300, 500, 1000];
const MAX_PROTECTED_BALANCE = 100_000;

const themeOptions: {
  value: ThemePreference;
  label: string;
  icon: typeof Moon;
}[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/**
 * The financial profile and its preferences, persisted to `localStorage` and
 * applied immediately.
 *
 * Every control here changes something the user can see: the protected
 * balance, horizon, safety target and unexpected-expense setting are inputs
 * to the simulation, so changing one re-runs it (the "Effect right now" card
 * shows the new result), and the theme is applied on change. Preferences
 * belong to the active profile, so switching to the demo and back keeps each
 * one's settings.
 */
export function SettingsView() {
  const {
    preferences,
    updatePreferences,
    resetPreferences,
    isHydrated,
  } = useWorkspace();
  const { activeProfile, setEmergenciesEnabled } = useActiveWorkspace();
  const protectedBalanceId = useId();
  const emergenciesId = useId();

  // A local string mirror lets the field hold transient states ("", "1.") while
  // typing without pushing an invalid number into preferences. `syncedWith`
  // tracks the preference the draft was derived from, so a change made
  // elsewhere (a preset button, a reset) re-seeds the field during render
  // rather than in an effect.
  const [balance, setBalance] = useState({
    draft: String(preferences.minimumProtectedBalance),
    syncedWith: preferences.minimumProtectedBalance,
  });

  if (balance.syncedWith !== preferences.minimumProtectedBalance) {
    setBalance({
      draft: String(preferences.minimumProtectedBalance),
      syncedWith: preferences.minimumProtectedBalance,
    });
  }

  const balanceDraft = balance.draft;

  const setBalanceDraft = (draft: string) => {
    setBalance((current) => ({ ...current, draft }));
  };

  const commitBalance = (raw: string) => {
    const parsed = Number(raw);

    if (raw.trim() === "" || !Number.isFinite(parsed) || parsed < 0) {
      setBalanceDraft(String(preferences.minimumProtectedBalance));
      return;
    }

    const clamped = Math.min(
      Math.round(parsed * 100) / 100,
      MAX_PROTECTED_BALANCE,
    );

    setBalanceDraft(String(clamped));
    updatePreferences({ minimumProtectedBalance: clamped });
  };

  const isDefault =
    preferences.minimumProtectedBalance ===
      DEFAULT_PREFERENCES.minimumProtectedBalance &&
    preferences.targetConfidence === DEFAULT_PREFERENCES.targetConfidence &&
    preferences.forecastHorizonDays ===
      DEFAULT_PREFERENCES.forecastHorizonDays &&
    preferences.theme === DEFAULT_PREFERENCES.theme;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Preferences are saved in this browser and applied to the dashboard immediately."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={resetPreferences}
            disabled={isDefault}
          >
            <RotateCcw aria-hidden />
            Reset to defaults
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <ProfileSettingsCard />

          <Card className="[--card-spacing:--spacing(5)]">
            <CardHeader>
              <CardTitle className="text-base">
                Protected minimum balance
              </CardTitle>
              <CardDescription>
                The balance FinTwin tries to keep you above on every day of every
                simulated future. Raising it lowers how much is safe to spend today.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor={protectedBalanceId} className="sr-only">
                  Protected minimum balance in dollars
                </Label>
                <div className="relative w-full max-w-[220px]">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
                  >
                    $
                  </span>
                  <Input
                    id={protectedBalanceId}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={MAX_PROTECTED_BALANCE}
                    step={25}
                    value={balanceDraft}
                    onChange={(event) => setBalanceDraft(event.target.value)}
                    onBlur={(event) => commitBalance(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        commitBalance(event.currentTarget.value);
                      }
                    }}
                    className="tabular-figures pl-6"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Press Enter or click away to apply.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {PROTECTED_BALANCE_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    variant={
                      preferences.minimumProtectedBalance === preset
                        ? "secondary"
                        : "outline"
                    }
                    size="sm"
                    onClick={() =>
                      updatePreferences({ minimumProtectedBalance: preset })
                    }
                  >
                    {preferences.minimumProtectedBalance === preset ? (
                      <Check aria-hidden />
                    ) : null}
                    {formatCurrency(preset).replace(".00", "")}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="[--card-spacing:--spacing(5)]">
            <CardHeader>
              <CardTitle className="text-base">Forecast horizon</CardTitle>
              <CardDescription>
                How many days each simulated future covers. A longer horizon
                includes more bills and more chances for surprises. This is the
                same control as the 30/60/90 toggle on the forecast chart.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={String(preferences.forecastHorizonDays)}
                onValueChange={(next) =>
                  updatePreferences({
                    forecastHorizonDays: Number(next) as ForecastHorizon,
                  })
                }
                className="grid gap-3 sm:grid-cols-3"
              >
                {FORECAST_HORIZONS.map((horizon) => (
                  <OptionTile
                    key={horizon}
                    value={String(horizon)}
                    title={`${horizon} days`}
                    description={
                      horizon === 30
                        ? "The recurring rhythm of bills and pay"
                        : horizon === 60
                          ? "Adds the next month's one-off events"
                          : "A full season, including bigger one-off costs"
                    }
                    isSelected={preferences.forecastHorizonDays === horizon}
                  />
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          <Card className="[--card-spacing:--spacing(5)]">
            <CardHeader>
              <CardTitle className="text-base">Safety target</CardTitle>
              <CardDescription>
                The share of simulated futures that must stay above your
                protected minimum before FinTwin calls an amount safe to spend.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={String(preferences.targetConfidence)}
                onValueChange={(next) =>
                  updatePreferences({
                    targetConfidence: Number(next) as TargetConfidence,
                  })
                }
                className="grid gap-3 sm:grid-cols-3"
              >
                {TARGET_CONFIDENCES.map((confidence) => (
                  <OptionTile
                    key={confidence}
                    value={String(confidence)}
                    title={`${
                      confidence === 90
                        ? "Flexible"
                        : confidence === 95
                          ? "Balanced"
                          : "Very cautious"
                    } · ${confidence}%`}
                    description={
                      confidence === 90
                        ? "More spending room, less margin"
                        : confidence === 95
                          ? "The default"
                          : "The most margin for surprises"
                    }
                    isSelected={preferences.targetConfidence === confidence}
                  />
                ))}
              </RadioGroup>

              <p className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
                A higher target leaves more room for bad luck, so it never
                increases how much is safe to spend. It is a target for the
                model, <span className="text-foreground">not a guarantee</span>:
                the model can be wrong, and real life can differ from every
                simulated future.
              </p>
            </CardContent>
          </Card>

          <Card className="[--card-spacing:--spacing(5)]">
            <CardHeader>
              <CardTitle className="text-base">Unexpected expenses</CardTitle>
              <CardDescription>
                Car repairs, medical bills and other surprises you can&rsquo;t
                schedule.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <Switch
                  id={emergenciesId}
                  checked={activeProfile.emergencies.enabled}
                  onCheckedChange={setEmergenciesEnabled}
                  className="mt-0.5"
                />
                <Label htmlFor={emergenciesId} className="flex-col items-start gap-1">
                  <span className="text-sm font-medium">Include them in the simulation</span>
                  <span className="text-xs leading-relaxed font-normal text-muted-foreground">
                    Each simulated future draws its own surprises: about{" "}
                    {EMERGENCY_ASSUMPTIONS.eventsPerYear} a year, averaging{" "}
                    {formatCents(EMERGENCY_ASSUMPTIONS.averageCostCents)}. This is a
                    modelling assumption, not a prediction about you. Leaving them
                    out makes results more optimistic.
                  </span>
                </Label>
              </div>
            </CardContent>
          </Card>

          <Card className="[--card-spacing:--spacing(5)]">
            <CardHeader>
              <CardTitle className="text-base">Theme</CardTitle>
              <CardDescription>
                Light is the default. Dark follows the same palette, and System
                matches your device. The theme applies to every profile.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={preferences.theme}
                onValueChange={(next) =>
                  updatePreferences({ theme: next as ThemePreference })
                }
                className="grid gap-3 sm:grid-cols-3"
              >
                {themeOptions.map((option) => (
                  <OptionTile
                    key={option.value}
                    value={option.value}
                    title={option.label}
                    icon={option.icon}
                    isSelected={preferences.theme === option.value}
                  />
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <EffectRightNow />

          <Card className="[--card-spacing:--spacing(5)]">
            <CardContent className="space-y-3">
              <p className="text-[13px] font-medium">Where this is stored</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Your answers and preferences
                {isHydrated ? " have been loaded" : " are loading"} from this
                browser. There is no backend and no account in this build.
              </p>
              <PrivacyNotice />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** The simulation's answer for the current settings; re-runs whenever one changes. */
function EffectRightNow() {
  const { data: result, input, error, retry } = useSimulation();

  return (
    <Card className="[--card-spacing:--spacing(5)] xl:sticky xl:top-20">
      <CardHeader>
        <CardTitle className="text-base">Effect right now</CardTitle>
        <CardDescription>
          What your current settings mean for the selected account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <SimulationError error={error} onRetry={retry} />
        ) : result ? (
          <>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Safe to spend today</p>
              <p className="tabular-figures font-heading text-3xl font-semibold tracking-tight">
                {safeToSpendText(result.safeToSpend)}
              </p>
              {result.safeToSpend.warning ? (
                <p className="text-xs leading-relaxed text-risk">{result.safeToSpend.warning}</p>
              ) : null}
            </div>

            <dl className="space-y-2 border-t border-border/60 pt-4 text-xs">
              <SummaryRow
                label="Chance of staying above your minimum"
                value={formatProbability(result.safety.safetyProbability)}
              />
              <SummaryRow
                label="Chance of dipping below it"
                value={formatProbability(result.safety.breachProbability)}
              />
              <SummaryRow
                label="Lowest balance, bad case"
                value={formatCents(result.risk.minimumBalanceP5Cents)}
              />
              <SummaryRow label="Horizon" value={`${result.horizonDays} days`} />
              <SummaryRow
                label="Simulations"
                value={new Intl.NumberFormat("en-US").format(result.pathCount)}
              />
            </dl>
            <SimulationDisclaimer />
          </>
        ) : (
          <div className="space-y-3">
            <SimulationRunning pathCount={input.pathCount} />
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-figures">{value}</dd>
    </div>
  );
}
