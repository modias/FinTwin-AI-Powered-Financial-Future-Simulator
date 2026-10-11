/**
 * Validates a request and runs it. Shared by the worker and the in-thread
 * fallback, so both validate the same way and use the same path cache.
 */

import { z } from "zod";

import type { SimulationRuntime } from "@/simulation/engine";
import type { SimulationPayload, SimulationResponse } from "@/simulation/protocol";
import { financialScenarioSchema, simulationInputSchema } from "@/simulation/schemas";

/** The Scenario Lab compares at most this many at once. */
export const MAX_SCENARIOS = 3;

const scenariosSchema = z.array(financialScenarioSchema).max(MAX_SCENARIOS);

export function handleSimulationRequest(
  runtime: SimulationRuntime,
  id: number,
  payload: SimulationPayload,
): SimulationResponse {
  try {
    const input = simulationInputSchema.parse(payload.input);

    if (payload.kind === "run") {
      return { id, ok: true, kind: "run", result: runtime.run(input) };
    }

    const scenarios = scenariosSchema.parse(payload.scenarios);

    return { id, ok: true, kind: "compare", comparison: runtime.compare(input, scenarios) };
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? `Invalid simulation request: ${z.prettifyError(error)}`
        : error instanceof Error
          ? error.message
          : "The simulation failed.";

    return { id, ok: false, error: message };
  }
}
