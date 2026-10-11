/**
 * Client for the simulation worker.
 *
 * Requests run one at a time, in order. A request whose caller has given up
 * (its `AbortSignal` fired — TanStack Query aborts queries whose inputs
 * changed) is dropped before it reaches the worker, or its result is
 * discarded if it was already running. So moving a slider quickly simulates
 * only the latest inputs, and a superseded result can never resolve.
 *
 * Where Web Workers are unavailable (tests, very old browsers), the same
 * handler runs on the main thread.
 */

import { createSimulationRuntime } from "@/simulation/engine";
import { handleSimulationRequest } from "@/simulation/handler";
import type {
  SimulationPayload,
  SimulationRequest,
  SimulationResponse,
} from "@/simulation/protocol";
import type {
  FinancialScenario,
  ScenarioComparison,
  SimulationInput,
  SimulationResult,
} from "@/simulation/types";

interface Job {
  id: number;
  payload: SimulationPayload;
  resolve: (response: SimulationResponse) => void;
  reject: (error: Error) => void;
  abandoned: boolean;
}

function abortError(): Error {
  return new DOMException("The simulation was superseded", "AbortError");
}

export interface SimulationService {
  run(input: SimulationInput, signal?: AbortSignal): Promise<SimulationResult>;
  compare(
    input: SimulationInput,
    scenarios: FinancialScenario[],
    signal?: AbortSignal,
  ): Promise<ScenarioComparison>;
}

type Executor = {
  start(job: Job): void;
};

function workerExecutor(onSettled: () => void): Executor | null {
  if (typeof Worker === "undefined") return null;

  let worker: Worker | null = null;
  let active: Job | null = null;

  function create(): Worker {
    const created = new Worker(new URL("../workers/simulation.worker.ts", import.meta.url), {
      type: "module",
      name: "fintwin-simulation",
    });

    created.addEventListener("message", (event: MessageEvent<SimulationResponse>) => {
      const job = active;

      if (!job || event.data.id !== job.id) return;

      active = null;
      job.resolve(event.data);
      onSettled();
    });

    created.addEventListener("error", (event) => {
      event.preventDefault();

      const job = active;

      // A crashed worker is replaced on the next request; its cache is lost.
      created.terminate();
      worker = null;
      active = null;
      job?.reject(new Error(event.message || "The simulation worker stopped unexpectedly."));
      onSettled();
    });

    return created;
  }

  try {
    worker = create();
  } catch {
    return null;
  }

  return {
    start(job) {
      worker ??= create();
      active = job;

      const request: SimulationRequest = { id: job.id, ...job.payload };

      worker.postMessage(request);
    },
  };
}

function inlineExecutor(onSettled: () => void): Executor {
  const runtime = createSimulationRuntime();

  return {
    start(job) {
      // Yield first, so callers always see an asynchronous result.
      setTimeout(() => {
        job.resolve(handleSimulationRequest(runtime, job.id, job.payload));
        onSettled();
      }, 0);
    },
  };
}

export function createSimulationService({
  preferWorker = true,
}: { preferWorker?: boolean } = {}): SimulationService {
  const queue: Job[] = [];
  let busy = false;
  let nextId = 1;
  let executor: Executor | null = null;

  function onSettled() {
    busy = false;
    pump();
  }

  function pump() {
    if (busy) return;

    let job = queue.shift();

    while (job?.abandoned) job = queue.shift();

    if (!job) return;

    executor ??= (preferWorker ? workerExecutor(onSettled) : null) ?? inlineExecutor(onSettled);
    busy = true;
    executor.start(job);
  }

  function request(payload: SimulationPayload, signal?: AbortSignal): Promise<SimulationResponse> {
    if (signal?.aborted) return Promise.reject(abortError());

    return new Promise<SimulationResponse>((resolve, reject) => {
      const job: Job = {
        id: nextId++,
        payload,
        abandoned: false,
        resolve: (response) => {
          signal?.removeEventListener("abort", onAbort);
          if (!job.abandoned) resolve(response);
        },
        reject: (error) => {
          signal?.removeEventListener("abort", onAbort);
          if (!job.abandoned) reject(error);
        },
      };

      function onAbort() {
        job.abandoned = true;
        reject(abortError());
      }

      signal?.addEventListener("abort", onAbort, { once: true });
      queue.push(job);
      pump();
    });
  }

  return {
    async run(input, signal) {
      const response = await request({ kind: "run", input }, signal);

      if (!response.ok) throw new Error(response.error);
      if (response.kind !== "run") throw new Error("Unexpected simulation response");

      return response.result;
    },
    async compare(input, scenarios, signal) {
      const response = await request({ kind: "compare", input, scenarios }, signal);

      if (!response.ok) throw new Error(response.error);
      if (response.kind !== "compare") throw new Error("Unexpected simulation response");

      return response.comparison;
    },
  };
}

let shared: SimulationService | null = null;

/** The app-wide client; created on first use in the browser. */
export function getSimulationService(): SimulationService {
  shared ??= createSimulationService();

  return shared;
}
