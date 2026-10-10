"use client";

import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { PhaseBadge } from "@/components/shared/disclosure-badges";
import { PageHeader } from "@/components/shared/page-header";
import {
  PlannedCapabilities,
  PreviewField,
  PreviewNotice,
  PreviewPanel,
} from "@/components/shared/phase-preview";
import { Card, CardContent } from "@/components/ui/card";
import { useSelectedAccount } from "@/hooks/use-financial-data";
import { useSimulationConfig } from "@/hooks/use-simulation-config";
import { formatAccountLabel, formatCurrency, formatPercent } from "@/lib/formatters";

/**
 * Preview of the Future Simulator.
 *
 * It shows the inputs the Monte Carlo engine will take — populated from the
 * user's real preferences and the selected account, so the preview is accurate
 * rather than decorative — and no outputs at all.
 */
export function SimulatorPreview() {
  const { preferences } = useActiveWorkspace();
  const account = useSelectedAccount();
  const config = useSimulationConfig();
  const scheduledEvents = config.events.filter(
    (event) => event.confidence === "scheduled",
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Phase 2"
        title="Future Simulator"
        description="Run thousands of possible futures for your balance and see how often you stay above your protected minimum."
        actions={<PhaseBadge />}
      />

      <PreviewNotice>
        <span className="font-medium text-foreground">
          Monte Carlo simulations are coming in Phase 2.
        </span>{" "}
        This page shows the inputs the engine will take. Nothing on it computes
        a result yet, and FinTwin will not show a simulated outcome until there
        is a simulation behind it.
      </PreviewNotice>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <PreviewPanel
          title="Simulation inputs"
          description="Drawn from your current account, cash-flow schedule and saved preferences."
          footnote="These values are read-only here. Change them on the Overview dashboard and in Settings, where they already affect the illustrative estimate."
        >
          <PreviewField
            label="Starting balance"
            value={
              account ? formatCurrency(account.currentBalance) : "Loading…"
            }
            hint={
              account
                ? formatAccountLabel(account.name, account.mask)
                : "Reading the selected account"
            }
          />
          <PreviewField
            label="Cash-flow events"
            value={`${config.events.length} over ${config.horizonDays} days`}
            hint={`${scheduledEvents} scheduled, ${
              config.events.length - scheduledEvents
            } estimated — the same events the illustrative forecast uses.`}
          />
          <PreviewField
            label="Spending variability"
            value={
              config.volatility.kind === "transaction_history"
                ? "Learned from history"
                : "Default assumptions"
            }
            hint={
              config.volatility.kind === "transaction_history"
                ? `Measured from ${config.volatility.transactionCount} transactions on this account.`
                : `No transaction history, so everyday spending is assumed to vary by about ${formatPercent(
                    config.volatility.everydaySpendingVariation * 100,
                    0,
                  )}, with a ${formatPercent(
                    config.volatility.incomeDelayProbability * 100,
                    0,
                  )} chance of a late paycheck.`
            }
          />
          <PreviewField
            label="Unexpected expenses"
            value={config.emergencies ? "Included" : "Not included"}
            hint={
              config.emergencies
                ? `Planned as about ${config.emergencies.eventsPerYear} surprises a year averaging ${formatCurrency(
                    config.emergencies.averageCost,
                  )}.`
                : "Leaving them out can make results look more optimistic."
            }
          />
          <PreviewField
            label="Protected minimum balance"
            value={formatCurrency(preferences.minimumProtectedBalance)}
            hint="The floor each simulated path is tested against."
          />
          <PreviewField
            label="Target confidence"
            value={`${preferences.targetConfidence}%`}
            hint="The share of simulated paths that must stay above the floor for an amount to be called safe."
          />
          <PreviewField
            label="Forecast horizon"
            value={`${preferences.forecastHorizonDays} days`}
            hint="How far forward each path is walked."
          />
        </PreviewPanel>

        <div className="space-y-6">
          <PlannedCapabilities
            items={[
              {
                title: "Thousands of simulated paths",
                description:
                  "Income timing, bill amounts and discretionary spending are each sampled from your history instead of assumed fixed.",
              },
              {
                title: "Percentile bands on the forecast",
                description:
                  "The Overview chart gains 10th, 50th and 90th percentile bands around the projection, replacing today's single deterministic line.",
              },
              {
                title: "A real probability of safety",
                description:
                  "The Financial Safety card fills in with the measured share of paths that never breach your protected balance.",
              },
              {
                title: "Probabilistic safe-to-spend",
                description:
                  "The headline amount becomes the largest spend today that still meets your target confidence, replacing the Phase 1 subtraction.",
              },
            ]}
          />

          <Card className="[--card-spacing:--spacing(5)]">
            <CardContent className="space-y-2">
              <p className="text-[13px] font-medium">
                Why there is no number here
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                A confidence figure is only meaningful if something measured it.
                Showing a plausible-looking percentage before the engine exists
                would make FinTwin feel finished while teaching you the wrong
                thing about your own risk, so this page stays empty until the
                simulation is real.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
