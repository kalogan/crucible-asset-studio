/**
 * KERNEL_LESSONS §2: Replicate rejects null/undefined fields in a request body
 * (e.g. `version: null` 422s). Strip them before serializing — never hand-spread
 * inputs at call sites.
 */
export function stripNullish<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((v) => v !== null && v !== undefined)
      .map((v) => stripNullish(v)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === null || v === undefined) continue;
      out[k] = stripNullish(v);
    }
    return out as T;
  }
  return value;
}
