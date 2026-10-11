"use client";

import { useSyncExternalStore } from "react";

/**
 * A request to scroll the Overview's upcoming-events list to one event.
 *
 * Lives outside React so it survives the client-side navigation from another
 * page: the bell sets it, then the list picks it up once it mounts and loads.
 */
export interface EventFocusRequest {
  eventId: string;
  requestedAt: number;
}

let current: EventFocusRequest | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function requestEventFocus(eventId: string) {
  current = { eventId, requestedAt: Date.now() };
  emit();
}

export function clearEventFocus(request: EventFocusRequest) {
  if (current !== request) return;
  current = null;
  emit();
}

export function useEventFocusRequest(): EventFocusRequest | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
