import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { ProfileGate } from "@/components/layout/profile-gate";

// Every page here is built from the profile saved in this browser, which the
// server cannot see, so the gate renders a loader in place of the page until
// hydration. That wait is intended; opt these routes out of instant-navigation
// validation rather than have it report the page as a dropped segment.
export const instant = false;

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ProfileGate>
      <AppShell>{children}</AppShell>
    </ProfileGate>
  );
}
