import type { Metadata } from "next";

import { InsightsView } from "./insights-view";

// Rendered from the profile in this browser; see `(app)/layout.tsx`.
export const instant = false;

export const metadata: Metadata = {
  title: "Financial Insights",
  description:
    "Descriptive analytics calculated from your FinTwin transaction history.",
};

export default function InsightsPage() {
  return <InsightsView />;
}
