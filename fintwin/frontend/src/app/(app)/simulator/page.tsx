import type { Metadata } from "next";

import { SimulatorView } from "./simulator-view";

// Rendered from the profile in this browser; see `(app)/layout.tsx`.
export const instant = false;

export const metadata: Metadata = {
  title: "Future Simulator",
  description:
    "Test a purchase or change against thousands of simulated futures for your bank balance.",
};

export default function SimulatorPage() {
  return <SimulatorView />;
}
