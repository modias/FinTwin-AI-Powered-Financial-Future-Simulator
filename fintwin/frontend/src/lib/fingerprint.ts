/**
 * Content fingerprints for cache invalidation.
 *
 * Two values with the same fingerprint describe the same inputs, regardless of
 * object key order. Query keys and simulation results carry a fingerprint, so
 * editing a profile can never leave results computed from the old answers on
 * screen. This is not a security hash.
 */

/** `JSON.stringify` with object keys sorted, so key order never changes the output. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`);

  return `{${entries.join(",")}}`;
}

/** 32-bit FNV-1a over the stable serialisation, as 8 hex characters. */
export function fingerprint(value: unknown): string {
  const text = stableStringify(value);
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}
