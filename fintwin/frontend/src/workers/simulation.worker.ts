/**
 * Runs the Monte Carlo engine off the main thread. Paths stay here, cached
 * by `pathsKey`; only summaries (percentile bands, probabilities, amounts)
 * are posted back.
 */

import { createSimulationRuntime } from "@/simulation/engine";
import { handleSimulationRequest } from "@/simulation/handler";
import type { SimulationRequest } from "@/simulation/protocol";

const runtime = createSimulationRuntime();

self.addEventListener("message", (event: MessageEvent<SimulationRequest>) => {
  const { id, ...payload } = event.data;

  self.postMessage(handleSimulationRequest(runtime, id, payload));
});
