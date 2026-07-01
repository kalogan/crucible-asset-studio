/**
 * Pure normalization helpers for the asset-import endpoint (`/api/import`). Extracted so
 * the request-shaping logic is unit-testable without spinning up the route handler.
 */

/** Max tags kept per asset (origin/hierarchy labels — guards against junk payloads). */
export const MAX_TAGS = 12;

/**
 * Coerce an arbitrary `tags` payload into a clean string[]: strings only, trimmed,
 * empties dropped, deduped (order-preserving), capped at MAX_TAGS. Non-arrays → [].
 */
export function sanitizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const t = String(raw).trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

/**
 * The reference-asset format from a mime type: a live 3D `model` for glTF, `audio` for any
 * audio/* (WAV/MP3/…), else an `image` (PNG/JPEG capture). Case-insensitive.
 */
export function formatForMime(mimeType: string): "image" | "model" | "audio" {
  const m = mimeType.toLowerCase();
  if (m.includes("gltf") || m.includes("glb")) return "model";
  if (m.startsWith("audio/")) return "audio";
  return "image";
}
