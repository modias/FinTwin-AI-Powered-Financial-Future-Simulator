"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { ExplainScenarioButton } from "@/components/dashboard/explain-risk-button";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import {
  SimulatedBadge,
  SimulationDisclaimer,
} from "@/components/shared/disclosure-badges";
import { PageHeader } from "@/components/shared/page-header";
import { ModelInputs, ModelWarnings } from "@/components/simulation/model-inputs";
import {
  ScenarioForm,
  draftFromScenario,
  emptyScenarioDraft,
  validateScenarioDraft,
  type ScenarioDraft,
} from "@/components/simulation/scenario-form";
import { ScenarioImpact, safeToSpendText } from "@/components/simulation/scenario-impact";
import { SimulationError, SimulationRunning } from "@/components/simulation/simulation-states";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useScenarioComparison, useSimulation } from "@/hooks/use-simulation";
import { formatProbability } from "@/lib/formatters";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { FinancialScenario, SimulationInput } from "@/simulation/types";

interface Preset {
  label: string;
  /** `null` when the example doesn't apply to this forecast. */
  build: (input: SimulationInput) => FinancialScenario | null;
}

const PRESETS: Preset[] = [
  {
    label: "$600 PlayStation today",
    build: (input) => ({
      id: "preset:playstation",
      type: "one_time_purchase",
      amountCents: 60_000,
      effectiveDate: input.referenceDate,
      frequency: null,
      description: "PlayStation",
    }),
  },
  {
    label: "Same $600, after next payday",
    build: (input) => {
      const payday = input.scheduledIncome[0]?.date;

      return payday
        ? {
            id: "preset:playstation-later",
            type: "delayed_purchase",
            amountCents: 60_000,
            effectiveDate: payday,
            frequency: null,
            description: "PlayStation after payday",
          }
        : null;
    },
  },
  {
    label: "$45 a month subscription",
    build: (input) => ({
      id: "preset:subscription",
      type: "recurring_expense",
      amountCents: 4_500,
      effectiveDate: input.referenceDate,
      frequency: "monthly",
      description: "New subscription",
    }),
  },
];

/**
 * The Future Simulator: test one hypothetical change against the baseline,
 * on the same simulated futures.
 *
 * A submitted scenario is kept as plain data. If the inputs change (a new
 * minimum, a different horizon, an edited profile), it is re-evaluated
 * against the new baseline — or, if it no longer fits the horizon, the form
 * says why instead of showing a stale result.
 */
export function SimulatorView() {
  const { dataset } = useActiveWorkspace();
  const simulation = useSimulation();
  const { input } = simulation;
  const [draft, setDraft] = useState<ScenarioDraft>(() => emptyScenarioDraft(input));
  const [submitted, setSubmitted] = useState<FinancialScenario | null>(null);
  const [inputsOpen, setInputsOpen] = useState(false);

  // Re-validated against the current inputs on every render.
  const stillValid = submitted
    ? validateScenarioDraft(draftFromScenario(submitted), input).scenario !== null
    : false;
  const comparison = useScenarioComparison(submitted && stillValid ? [submitted] : []);

  function run(scenario: FinancialScenario) {
    setDraft(draftFromScenario(scenario));
    setSubmitted(scenario);
  }

  const baseline = simulation.data;
  const comparedScenario =
    stillValid && !simulation.error && !comparison.error ? comparison.data?.scenarios[0] : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Future Simulator"
        description="Test a decision before you make it. FinTwin runs it through the same simulated futures as your current plan and shows how your chance of staying above your protected minimum changes."
        actions={<SimulatedBadge pathCount={input.pathCount} />}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-6">
          <Card className="[--card-spacing:--spacing(5)]">
            <CardHeader>
              <CardTitle className="text-base">What if…</CardTitle>
              <CardDescription>
                Pick an example or describe your own change.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => {
                  const scenario = preset.build(input);

                  return scenario ? (
                    <Button
                      key={preset.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => run(scenario)}
                    >
                      {preset.label}
                    </Button>
                  ) : null;
                })}
              </div>

              <ScenarioForm
                idPrefix="simulator"
                input={input}
                draft={draft}
                onDraftChange={setDraft}
                onSubmit={run}
                disabled={comparison.isPending}
              />
            </CardContent>
          </Card>

          <Card className="[--card-spacing:--spacing(5)]">
            <CardHeader>
              <CardTitle className="text-base">Before and after</CardTitle>
              <CardDescription>
                Your current plan against the same plan with your change.
              </CardDescription>
              {comparedScenario && comparison.data ? (
                <CardAction>
                  <ExplainScenarioButton
                    input={input}
                    baseline={comparison.data.baseline}
                    scenario={comparedScenario}
                  />
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              {simulation.error ? (
                <SimulationError error={simulation.error} onRetry={simulation.retry} />
              ) : comparison.error ? (
                <SimulationError error={comparison.error} onRetry={comparison.retry} />
              ) : submitted && !stillValid ? (
                <p className="text-sm text-muted-foreground">
                  Your settings changed and this what-if no longer fits the{" "}
                  {input.horizonDays}-day forecast. Adjust the date above and run it again.
                </p>
              ) : comparison.data && comparedScenario ? (
                <ScenarioImpact baseline={comparison.data.baseline} scenario={comparedScenario} />
              ) : comparison.isPending ? (
                <div className="space-y-3">
                  <SimulationRunning pathCount={input.pathCount} label="Comparing across" />
                  <Skeleton className="h-10 w-72" />
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Run a what-if to compare it with your current plan.
                  {baseline
                    ? ` Right now your balance stays above ${formatCents(
                        baseline.protectedMinimumCents,
                      )} in ${formatProbability(
                        baseline.safety.safetyProbability,
                      )} of simulated futures, and you can spend up to ${safeToSpendText(
                        baseline.safeToSpend,
                      )} today while meeting your ${Math.round(
                        baseline.targetConfidence * 100,
                      )}% target.`
                    : ""}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Collapsible open={inputsOpen} onOpenChange={setInputsOpen} className="h-fit">
          <Card className="[--card-spacing:--spacing(5)]">
            <CardHeader>
              <CardTitle className="text-base">What the simulation uses</CardTitle>
              <CardDescription>Change these in Settings or by editing your profile.</CardDescription>
              <CardAction>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={inputsOpen ? "Hide simulation inputs" : "Show simulation inputs"}
                  >
                    <ChevronDown
                      aria-hidden
                      className={cn("transition-transform duration-200", inputsOpen && "rotate-180")}
                    />
                  </Button>
                </CollapsibleTrigger>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              <CollapsibleContent className="overflow-hidden data-closed:animate-collapsible-up data-open:animate-collapsible-down">
                <div className="space-y-4">
                  {baseline ? (
                    <>
                      <ModelInputs result={baseline} isDemo={dataset.source === "demo"} />
                      <ModelWarnings warnings={baseline.warnings} />
                    </>
                  ) : simulation.error ? null : (
                    <div className="space-y-3">
                      <SimulationRunning pathCount={input.pathCount} />
                      {Array.from({ length: 5 }, (_, index) => (
                        <Skeleton key={index} className="h-10 w-full" />
                      ))}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
              <SimulationDisclaimer />
            </CardContent>
          </Card>
        </Collapsible>
      </div>
    </div>
  );
}
