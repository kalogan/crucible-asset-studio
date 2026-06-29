import "server-only";
import { getServerEnv } from "@/lib/env";
import { resolveModelRequest } from "./models";
import { stripNullish } from "./body";
import { withRetry, HttpError, parseRetryAfter } from "./retry";

/**
 * Server-side Replicate driver. Unlike the March browser app, the Next server can
 * call api.replicate.com directly (no CORS), so there is no proxy — but the token
 * stays SERVER-ONLY (KERNEL_LESSONS §9).
 */

export interface Prediction {
  id: string;
  status: string;
  output?: unknown;
  error?: string | null;
  urls?: { get?: string; cancel?: string };
}

function authHeaders(): Record<string, string> {
  const { REPLICATE_API_TOKEN } = getServerEnv();
  return {
    Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

async function toHttpError(res: Response): Promise<HttpError> {
  const body = await res.text().catch(() => "");
  const retryAfterMs = parseRetryAfter(res.headers.get("retry-after"), Date.now());
  return new HttpError(res.status, `Replicate ${res.status}: ${body.slice(0, 300)}`, {
    retryAfterMs,
    body,
  });
}

/** Start a prediction. `model` routes via the registry; pass `version` to force a hash. */
export async function startPrediction(
  model: string | null,
  input: Record<string, unknown>,
  opts: { version?: string | null } = {},
): Promise<Prediction> {
  const { endpoint, body, useWait } = resolveModelRequest(
    model,
    stripNullish(input),
    opts.version,
  );
  const headers = authHeaders();
  if (useWait) headers["Prefer"] = "wait";

  return withRetry(async () => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(stripNullish(body)),
    });
    if (!res.ok) throw await toHttpError(res);
    return (await res.json()) as Prediction;
  });
}

export interface PollOptions {
  /** total budget before giving up; TRELLIS needs minutes, flux seconds */
  timeoutMs?: number;
  signal?: AbortSignal;
  onStatus?: (status: string) => void;
}

const POLL_DELAYS = [2000, 2500, 3000];

/**
 * Poll a prediction to terminal state and return its raw output. Per-model timeout
 * (KERNEL_LESSONS §5 — the reference's fixed "3 minute" cap was both wrong and
 * one-size-fits-all). Honors an AbortSignal.
 */
export async function pollPrediction(
  predictionId: string,
  opts: PollOptions = {},
): Promise<unknown> {
  const timeoutMs = opts.timeoutMs ?? 180_000;
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;

  for (;;) {
    if (opts.signal?.aborted) throw new Error("CANCELLED");
    const delay = POLL_DELAYS[Math.min(attempt, POLL_DELAYS.length - 1)]!;
    await new Promise((r) => setTimeout(r, delay));
    if (opts.signal?.aborted) throw new Error("CANCELLED");
    if (Date.now() > deadline) {
      throw new Error(`Prediction ${predictionId} timed out after ${timeoutMs}ms`);
    }

    const pred = await withRetry(async () => {
      const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        method: "GET",
        headers: authHeaders(),
      });
      if (!res.ok) throw await toHttpError(res);
      return (await res.json()) as Prediction;
    });

    opts.onStatus?.(pred.status);
    if (pred.status === "succeeded") return pred.output;
    if (pred.status === "failed") throw new Error(pred.error || "Prediction failed");
    if (pred.status === "canceled") throw new Error("CANCELLED");
    attempt++;
  }
}

export async function cancelPrediction(predictionId: string): Promise<void> {
  await fetch(`https://api.replicate.com/v1/predictions/${predictionId}/cancel`, {
    method: "POST",
    headers: authHeaders(),
  }).catch(() => {}); // fire-and-forget
}

/** First output for array-shaped outputs (e.g. FLUX returns [url]); else the value. */
export function firstOutput(output: unknown): unknown {
  return Array.isArray(output) ? output[0] : output;
}
