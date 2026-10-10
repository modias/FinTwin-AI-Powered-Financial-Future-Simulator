"use client";

import { useSyncExternalStore } from "react";

export type Daypart = "morning" | "afternoon" | "evening";

export function resolveDaypart(hour: number): Daypart {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";

  return "evening";
}

const greetings: Record<Daypart, string> = {
  morning: "Good morning",
  afternoon: "Good afternoon",
  evening: "Good evening",
};

/** The clock never notifies us; a daypart change is not worth polling for. */
function subscribe(): () => void {
  return () => {};
}

function getSnapshot(): Daypart {
  return resolveDaypart(new Date().getHours());
}

function getServerSnapshot(): Daypart {
  return "afternoon";
}

/**
 * The greeting for the viewer's local time of day.
 *
 * The clock is only read on the client: server-rendered HTML always says
 * "Good afternoon", and the real value is applied on mount. Without this the
 * server's timezone would leak into the markup and cause a hydration mismatch.
 */
export function useGreeting(): { greeting: string; daypart: Daypart } {
  const daypart = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  return { greeting: greetings[daypart], daypart };
}
