"use client";

import { useSyncExternalStore } from "react";

import { localIsoDate } from "@/lib/dates";

const subscribe = () => () => {};

/**
 * The viewer's local calendar day, or `null` during server rendering and
 * hydration. Read through `useSyncExternalStore` so the server markup never
 * depends on the clock.
 */
export function useToday(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => localIsoDate(new Date()),
    () => null,
  );
}
