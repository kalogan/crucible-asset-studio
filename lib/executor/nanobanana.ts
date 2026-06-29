import "server-only";

/**
 * Google Gemini 2.5 Flash Image ("nano banana") image provider.
 *
 * text→image with optional reference-image conditioning (the style-anchor lever).
 * Fails SOFT — mirrors lib/executor/enrich.ts: if GEMINI_API_KEY is unset, or the
 * network call errors in any way, generateImageNanoBanana returns null so callers
 * never hard-depend on this provider.
 */
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.5-flash-image";

export interface NanoBananaImage {
  base64: string;
  mimeType: string;
}

interface InlineDataPart {
  inlineData?: { data?: unknown; mimeType?: unknown };
}

/**
 * Pure, unit-testable: pull the first inline image out of a Gemini
 * generateContent response. Guards defensively for missing
 * candidates/content/parts/inlineData and returns null if none is present.
 */
export function extractImageFromResponse(json: unknown): NanoBananaImage | null {
  if (typeof json !== "object" || json === null) return null;

  const candidates = (json as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return null;

  const first = candidates[0];
  if (typeof first !== "object" || first === null) return null;

  const content = (first as { content?: unknown }).content;
  if (typeof content !== "object" || content === null) return null;

  const parts = (content as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) return null;

  for (const part of parts) {
    if (typeof part !== "object" || part === null) continue;
    const inlineData = (part as InlineDataPart).inlineData;
    if (typeof inlineData !== "object" || inlineData === null) continue;
    const data = inlineData.data;
    if (typeof data !== "string" || data.length === 0) continue;
    const mimeType =
      typeof inlineData.mimeType === "string" ? inlineData.mimeType : "image/png";
    return { base64: data, mimeType };
  }

  return null;
}

interface InlineReferencePart {
  inlineData: { mimeType: string; data: string };
}

async function fetchReferencePart(url: string): Promise<InlineReferencePart | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type") ?? "image/png";
    const bytes = await res.arrayBuffer();
    const data = Buffer.from(bytes).toString("base64");
    return { inlineData: { mimeType, data } };
  } catch {
    return null;
  }
}

/**
 * Fail-soft network call to Gemini generateContent. Returns null if no
 * GEMINI_API_KEY is set or on any error.
 */
export async function generateImageNanoBanana(
  prompt: string,
  opts: { referenceImageUrls?: string[] } = {},
): Promise<NanoBananaImage | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;

  try {
    const referenceParts: InlineReferencePart[] = [];
    for (const url of opts.referenceImageUrls ?? []) {
      const part = await fetchReferencePart(url);
      if (part) referenceParts.push(part); // skip failed references, don't throw
    }

    const endpoint = `${GEMINI_API_BASE}/${model}:generateContent?key=${key}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, ...referenceParts] }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    });
    if (!res.ok) return null;

    const json: unknown = await res.json();
    return extractImageFromResponse(json);
  } catch {
    return null;
  }
}
