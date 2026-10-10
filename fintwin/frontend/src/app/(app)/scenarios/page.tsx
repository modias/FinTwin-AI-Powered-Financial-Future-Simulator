import type { Metadata } from "next";

import { PhaseBadge } from "@/components/shared/disclosure-badges";
import { PageHeader } from "@/components/shared/page-header";
import {
  PlannedCapabilities,
  PreviewNotice,
} from "@/components/shared/phase-preview";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Rendered from the profile in this browser; see `(app)/layout.tsx`.
export const instant = false;

export const metadata: Metadata = {
  title: "Scenario Lab",
  description:
    "Compare financial decisions side by side. Arriving in Phase 2.",
};

/**
 * Preview of the Scenario Lab.
 *
 * The example scenarios below are illustrations of the *questions* the lab will
 * answer. They deliberately carry no numbers — no projected balance, no
 * probability — because nothing has computed them.
 */
const exampleScenarios = [
  {
    name: "Buy a $1,400 laptop",
    question: "Up front, or over six months?",
    detail:
      "Compare a single large withdrawal against a financed plan, and see which one keeps more of your buffer intact through the next two rent cycles.",
  },
  {
    name: "Move to a $1,150 apartment",
    question: "Can the new rent absorb a late paycheck?",
    detail:
      "Raise a recurring commitment and watch how much slack is left when income arrives a week behind schedule.",
  },
  {
    name: "Take a $900 trip in December",
    question: "Which month should it come out of?",
    detail:
      "Place a one-off expense anywhere in the horizon and find the date that costs the least safety.",
  },
  {
    name: "Start saving $250 a month",
    question: "What does it cost the day-to-day?",
    detail:
      "Add a standing transfer and see the effect on how much is safe to spend each week.",
  },
];

export default function ScenariosPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Phase 2"
        title="Scenario Lab"
        description="Put two or more financial decisions beside each other and compare what each one does to your future balance and your safety margin."
        actions={<PhaseBadge />}
      />

      <PreviewNotice>
        <span className="font-medium text-foreground">
          Scenario comparison is coming in Phase 2.
        </span>{" "}
        It depends on the Monte Carlo engine: comparing two decisions means
        running both through the simulator and measuring the difference, which
        is not something Phase 1 can do.
      </PreviewNotice>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-heading text-base font-medium">
            The kind of question you&rsquo;ll be able to ask
          </h2>
          <p className="text-sm text-muted-foreground">
            Examples of scenarios the lab is being built around.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {exampleScenarios.map((scenario) => (
            <Card
              key={scenario.name}
              className="[--card-spacing:--spacing(5)]"
            >
              <CardHeader>
                <CardTitle className="text-[15px]">{scenario.name}</CardTitle>
                <CardDescription>{scenario.question}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {scenario.detail}
                </p>
                <Badge variant="secondary" className="text-[10px]">
                  Comparison available in Phase 2
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <PlannedCapabilities
        title="How comparison will work"
        items={[
          {
            title: "Scenarios build on your real schedule",
            description:
              "Each scenario starts from your current balance, bills and income, then layers one change on top so the difference is attributable to that change alone.",
          },
          {
            title: "Side-by-side percentile bands",
            description:
              "Two or more simulated futures are drawn on one chart, so you can see where they diverge rather than comparing two numbers.",
          },
          {
            title: "Safety delta, not just balance delta",
            description:
              "The headline comparison is the change in your probability of staying above the protected balance, because an outcome that is richer on average can still be riskier.",
          },
          {
            title: "Saved scenarios",
            description:
              "Keep a scenario and revisit it as your actual balance moves, to see whether the decision still holds.",
          },
        ]}
      />
    </div>
  );
}
