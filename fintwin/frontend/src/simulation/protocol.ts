/** Messages between the app and the simulation worker. */

import type {
  FinancialScenario,
  ScenarioComparison,
  SimulationInput,
  SimulationResult,
} from "@/simulation/types";

export type SimulationRequest =
  | { id: number; kind: "run"; input: SimulationInput }
  | { id: number; kind: "compare"; input: SimulationInput; scenarios: FinancialScenario[] };

export type SimulationResponse =
  | { id: number; ok: true; kind: "run"; result: SimulationResult }
  | { id: number; ok: true; kind: "compare"; comparison: ScenarioComparison }
  | { id: number; ok: false; error: string };

export type SimulationPayload =
  | { kind: "run"; input: SimulationInput }
  | { kind: "compare"; input: SimulationInput; scenarios: FinancialScenario[] };
