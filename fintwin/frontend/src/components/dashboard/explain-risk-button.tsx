"use client";

import { useQuery, type QueryKey } from "@tanstack/react-query";
import { CircleAlert, RotateCw, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildRiskExplanationRequest,
  buildScenarioExplanationRequest,
  explainRisk,
  explainScenario,
  type RiskExplanation,
} from "@/services/risk-explanation-service";
import type { ScenarioResult, SimulationInput, SimulationResult } from "@/simulation/types";

/**
 * Asks Gemini why the safety score is what it is, using only the result
 * already on screen. Fetched on first open and cached per simulation.
 */
export function ExplainRiskButton({
  input,
  result,
}: {
  input: SimulationInput;
  result: SimulationResult;
}) {
  return (
    <ExplanationPopover
      title="Why your safety score is what it is"
      queryKey={["risk-explanation", result.inputFingerprint]}
      fetchExplanation={(signal) => explainRisk(buildRiskExplanationRequest(input, result), signal)}
    />
  );
}

/**
 * Asks Gemini why one what-if moves the safety score from the baseline,
 * using only the comparison already on screen. Cached per baseline and change.
 */
export function ExplainScenarioButton({
  input,
  baseline,
  scenario,
}: {
  input: SimulationInput;
  baseline: SimulationResult;
  scenario: ScenarioResult;
}) {
  return (
    <ExplanationPopover
      title="Why this change moves your safety score"
      queryKey={["scenario-explanation", baseline.inputFingerprint, scenario.scenario]}
      fetchExplanation={(signal) =>
        explainScenario(buildScenarioExplanationRequest(input, baseline, scenario), signal)
      }
    />
  );
}

function ExplanationPopover({
  title,
  queryKey,
  fetchExplanation,
}: {
  title: string;
  queryKey: QueryKey;
  fetchExplanation: (signal: AbortSignal) => Promise<RiskExplanation>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchExplanation(signal),
    enabled: isOpen,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    retry: false,
  });

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="xs" className="-mr-1.5 text-primary">
          <Sparkles aria-hidden />
          Explain My Risk
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[min(32rem,var(--radix-popover-content-available-height))] w-[min(24rem,calc(100vw-2rem))] gap-3 overflow-y-auto p-4"
      >
        <PopoverHeader>
          <PopoverTitle className="flex items-center gap-1.5">
            <Sparkles aria-hidden className="size-3.5 text-primary" />
            {title}
          </PopoverTitle>
          <PopoverDescription className="text-xs">
            Written by Gemini from this simulation only. An estimate, not advice.
          </PopoverDescription>
        </PopoverHeader>

        {query.isPending ? (
          <div className="space-y-2" aria-busy="true" aria-label="Generating explanation">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        ) : query.isError ? (
          <div className="space-y-3">
            <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
              {query.error.message}
            </p>
            <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
              <RotateCw aria-hidden />
              Try again
            </Button>
          </div>
        ) : (
          <div className="space-y-3 text-sm leading-relaxed">
            <p>{query.data.summary}</p>
            {query.data.factors.length > 0 ? (
              <ul className="list-disc space-y-1.5 pl-5">
                {query.data.factors.map((factor) => (
                  <li key={factor.title}>
                    <span className="font-medium">{factor.title.replace(/:$/, "")}:</span>{" "}
                    <span className="text-muted-foreground">{factor.detail}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
