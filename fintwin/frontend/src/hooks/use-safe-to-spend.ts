"use client";

import { useSimulation, type SimulationState } from "@/hooks/use-simulation";
import type { SafeToSpendResult, SimulationResult } from "@/simulation/types";

export interface SafeToSpendState extends SimulationState<SimulationResult> {
  safeToSpend: SafeToSpendResult | undefined;
}

/** Safe-to-spend from the current simulation, with the result it came from. */
export function useSafeToSpend(): SafeToSpendState {
  const simulation = useSimulation();

  return { ...simulation, safeToSpend: simulation.data?.safeToSpend };
}
