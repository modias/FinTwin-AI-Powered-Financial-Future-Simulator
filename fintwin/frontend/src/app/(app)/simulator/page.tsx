import type { Metadata } from "next";

import { SimulatorPreview } from "./simulator-preview";

// Rendered from the profile in this browser; see `(app)/layout.tsx`.
export const instant = false;

export const metadata: Metadata = {
  title: "Future Simulator",
  description:
    "Monte Carlo simulation of your future bank balance. Arriving in Phase 2.",
};

export default function SimulatorPage() {
  return <SimulatorPreview />;
}
