import type { Metadata } from "next";

import { ScenarioLab } from "./scenario-lab";

// Rendered from the profile in this browser; see `(app)/layout.tsx`.
export const instant = false;

export const metadata: Metadata = {
  title: "Scenario Lab",
  description: "Compare up to three financial decisions on the same simulated futures.",
};

export default function ScenariosPage() {
  return <ScenarioLab />;
}
