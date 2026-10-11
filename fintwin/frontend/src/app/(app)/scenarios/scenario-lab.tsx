"use client";

import { useState } from "react";
import { Pencil, Plus, Trophy, X } from "lucide-react";

import {
  SimulatedBadge,
  SimulationDisclaimer,
  SourceTag,
} from "@/components/shared/disclosure-badges";
import { PageHeader } from "@/components/shared/page-header";
import {
  BAND_EXPLANATION,
  PercentileChart,
  PercentileLegend,
} from "@/components/simulation/percentile-chart";
import {
  ScenarioForm,
  draftFromScenario,
  emptyScenarioDraft,
  validateScenarioDraft,
  type ScenarioDraft,
} from "@/components/simulation/scenario-form";
import { BeforeAfterTable } from "@/components/simulation/scenario-impact";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useScenarioComparison, useSimulationInput } from "@/hooks/use-simulation";
import { formatProbability } from "@/lib/formatters";
import { MAX_SCENARIOS } from "@/simulation/handler";
import { describeScenario } from "@/simulation/scenarios";
import type { FinancialScenario, ScenarioResult, SimulationInput } from "@/simulation/types";

const pathCountFormatter = new Intl.NumberFormat("en-US");

/** The laptop question: buy now, wait for payday, or buy something cheaper. */
function laptopExamples(input: SimulationInput): FinancialScenario[] {
  const payday = input.scheduledIncome[0]?.date;
  const today = input.referenceDate;

  return [
    {
      id: "lab:laptop-today",
      type: "one_time_purchase",
      amountCents: 120_000,
      effectiveDate: today,
      frequency: null,
      description: "$1,200 laptop today",
    },
    ...(payday
      ? [
          {
            id: "lab:laptop-after-payday",
            type: "delayed_purchase" as const,
            amountCents: 120_000,
            effectiveDate: payday,
            frequency: null,
            description: "$1,200 laptop after payday",
          },
        ]
      : []),
    {
      id: "lab:cheaper-laptop",
      type: "one_time_purchase",
      amountCents: 70_000,
      effectiveDate: today,
      frequency: null,
      description: "$700 laptop today",
    },
  ];
}

/** Highest safety wins; ties go to the higher median ending balance. */
function bestIndex(results: ScenarioResult[]): number {
  return results.reduce(
    (best, result, index) => {
      const current = results[best];
      const better =
        result.safety.safePaths > current.safety.safePaths ||
        (result.safety.safePaths === current.safety.safePaths &&
          result.medianEndingBalanceCents > current.medianEndingBalanceCents);

      return better ? index : best;
    },
    0,
  );
}

export function ScenarioLab() {
  const input = useSimulationInput();
  const [scenarios, setScenarios] = useState<FinancialScenario[]>(() => laptopExamples(input));
  const [draft, setDraft] = useState<ScenarioDraft>(() => emptyScenarioDraft(input));
  const [chartIndex, setChartIndex] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialScenario | null>(null);

  // Scenarios whose dates no longer fit (after a horizon change) are set aside, not silently run.
  const valid = scenarios.filter(
    (scenario) => validateScenarioDraft(draftFromScenario(scenario), input).scenario !== null,
  );
  const invalidCount = scenarios.length - valid.length;
  const comparison = useScenarioComparison(valid);
  const isFull = scenarios.length >= MAX_SCENARIOS;
  const results = comparison.data?.scenarios ?? [];
  const shownIndex = Math.min(chartIndex, Math.max(0, results.length - 1));
  const best = results.length > 1 ? bestIndex(results) : null;

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setDraft(emptyScenarioDraft(input));
  }

  function save(scenario: FinancialScenario) {
    if (editing) {
      setScenarios(
        scenarios.map((existing) =>
          existing.id === editing.id ? { ...scenario, id: editing.id } : existing,
        ),
      );
    } else {
      if (isFull) return;

      const id = scenarios.some((existing) => existing.id === scenario.id)
        ? `${scenario.id}:${scenarios.length}`
        : scenario.id;

      setScenarios([...scenarios, { ...scenario, id }]);
    }

    closeForm();
  }

  function remove(id: string) {
    setScenarios(scenarios.filter((scenario) => scenario.id !== id));
    setChartIndex(0);

    if (editing?.id === id) closeForm();
  }

  function edit(scenario: FinancialScenario) {
    setDraft(draftFromScenario(scenario));
    setEditing(scenario);
    setFormOpen(true);
  }

  function openNew() {
    setDraft(emptyScenarioDraft(input));
    setEditing(null);
    setFormOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scenario Lab"
        description={`Compare up to ${MAX_SCENARIOS} decisions side by side. Every option runs through the same ${pathCountFormatter.format(
          input.pathCount,
        )} simulated futures as your current plan, so differences come from the decisions, not from chance.`}
        actions={<SimulatedBadge pathCount={input.pathCount} />}
      />

      <div className="space-y-6">
        <Card className="[--card-spacing:--spacing(5)]">
          <CardHeader>
            <CardTitle className="text-base">
              Your options ({scenarios.length} of {MAX_SCENARIOS})
            </CardTitle>
            <CardDescription>
              {isFull ? "Remove one to make room for another." : "Edit one, or add another."}
            </CardDescription>
            {!isFull && !formOpen ? (
              <CardAction>
                <Button size="sm" variant="outline" onClick={openNew}>
                  <Plus aria-hidden />
                  Add option
                </Button>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent>
            {scenarios.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No options yet. Add one to start comparing.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {scenarios.map((scenario) => {
                  const isValid = valid.includes(scenario);

                  return (
                    <li
                      key={scenario.id}
                      className="flex items-start gap-1 rounded-lg border border-border/60 bg-muted/30 p-3"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
                          {scenario.description}
                          <SourceTag source="hypothetical" />
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isValid
                            ? describeScenario(scenario)
                            : `Outside the ${input.horizonDays}-day forecast — edit its date.`}
                        </p>
                      </div>
                      <div className="-mt-1 -mr-1 flex shrink-0">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${scenario.description}`}
                          onClick={() => edit(scenario)}
                        >
                          <Pencil aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${scenario.description}`}
                          onClick={() => remove(scenario.id)}
                        >
                          <X aria-hidden />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {formOpen ? (
          <Card className="[--card-spacing:--spacing(5)]">
            <CardHeader>
              <CardTitle className="text-base">
                {editing ? `Editing “${editing.description}”` : "Add an option"}
              </CardTitle>
              <CardDescription>
                {editing
                  ? "Change the details, then save to update the comparison."
                  : "Describe a decision to compare."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScenarioForm
                idPrefix="lab"
                input={input}
                draft={draft}
                onDraftChange={setDraft}
                onSubmit={save}
                submitLabel={editing ? "Save changes" : "Add to comparison"}
                footer={
                  <Button type="button" variant="ghost" onClick={closeForm}>
                    Cancel
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : null}

        <Card className="[--card-spacing:--spacing(5)]">
          <CardHeader>
            <CardTitle className="text-base">Comparison</CardTitle>
            <CardDescription>
              Each option on its own, against your current plan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {invalidCount > 0 ? (
              <p className="text-xs text-warning">
                {invalidCount === 1 ? "One option is" : `${invalidCount} options are`} left out
                because {invalidCount === 1 ? "its date falls" : "their dates fall"} outside the
                forecast.
              </p>
            ) : null}

            {comparison.error ? (
              <SimulationError error={comparison.error} onRetry={comparison.retry} />
            ) : !comparison.enabled ? (
              <p className="text-sm text-muted-foreground">Add an option to compare.</p>
            ) : !comparison.data ? (
              <div className="space-y-3">
                <SimulationRunning pathCount={input.pathCount} label="Comparing across" />
                <Skeleton className="h-56 w-full" />
              </div>
            ) : (
              <>
                {best !== null ? (
                  <p className="flex items-start gap-2 rounded-lg bg-success/8 p-3 text-sm leading-relaxed">
                    <Trophy aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                    <span>
                      <span className="font-medium">{results[best].scenario.description}</span>{" "}
                      keeps you safest: your balance stays above your minimum in{" "}
                      {formatProbability(results[best].safety.safetyProbability)} of simulated
                      futures{results[best].meetsTarget ? ", meeting your target" : ", though still below your target"}.
                    </span>
                  </p>
                ) : null}

                <BeforeAfterTable
                  baseline={comparison.data.baseline}
                  scenarios={results}
                  headers={results.map((result) => result.scenario.description)}
                />

                <div className="space-y-3">
                  {results.length > 1 ? (
                    <Tabs
                      value={String(shownIndex)}
                      onValueChange={(value) => setChartIndex(Number(value))}
                    >
                      <TabsList aria-label="Option shown on the chart">
                        {results.map((result, index) => (
                          <TabsTrigger key={result.scenario.id} value={String(index)}>
                            {result.scenario.description}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                  ) : null}
                  <PercentileLegend
                    withScenario
                    scenarioLabel={results[shownIndex].scenario.description}
                  />
                  <PercentileChart
                    bands={comparison.data.baseline.forecast}
                    scenarioBands={results[shownIndex].forecast}
                    scenarioLabel={results[shownIndex].scenario.description}
                    protectedMinimumCents={comparison.data.baseline.protectedMinimumCents}
                  />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {BAND_EXPLANATION}
                  </p>
                </div>
              </>
            )}

            <SimulationDisclaimer />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
