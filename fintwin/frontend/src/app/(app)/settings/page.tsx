import type { Metadata } from "next";

import { SettingsView } from "./settings-view";

// Rendered from the profile in this browser; see `(app)/layout.tsx`.
export const instant = false;

export const metadata: Metadata = {
  title: "Settings",
  description:
    "Protected minimum balance, forecast horizon, simulation confidence and theme.",
};

export default function SettingsPage() {
  return <SettingsView />;
}
