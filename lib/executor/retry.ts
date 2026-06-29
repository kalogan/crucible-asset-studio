/**
 * KERNEL_LESSONS §3: the reference had only partial rate-limit handling and NO real
 * Replicate 429 retry. This closes the gap — one backoff wrapper for all provider
 * calls: exponential backoff + jitter, honoring Retry-After, retrying 429/503/529.
 * Clock + RNG are injectable (deterministic core; ARCHITECT_BUILDER_PIPELINE §5).
 */

export class HttpError extends Error {
  readonly status: number;
  readonly retryAfterMs?: number;
  readonly body?: string;
  constructor(status: number, message: string, opts?: { retryAfterMs?: number; body?: string }) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.retryAfterMs = opts?.retryAfterMs;
    this.body = opts?.body;
  }
}

const DEFAULT_RETRYABLE = new Set([429, 503, 529]);

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** test seam: defaults to setTimeout */
  sleep?: (ms: number) => Promise<void>;
  /** test seam: defaults to Math.random */
  random?: () => number;
  isRetryable?: (err: unknown) => boolean;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function defaultIsRetryable(err: unknown): boolean {
  return err instanceof HttpError && DEFAULT_RETRYABLE.has(err.status);
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const retries = opts.retries ?? 4;
  const base = opts.baseDelayMs ?? 500;
  const max = opts.maxDelayMs ?? 20_000;
  const sleep = opts.sleep ?? defaultSleep;
  const random = opts.random ?? Math.random;
  const isRetryable = opts.isRetryable ?? defaultIsRetryable;

  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !isRetryable(err)) throw err;
      const backoff = Math.min(max, base * 2 ** attempt);
      const jitter = backoff * 0.5 * random();
      const retryAfter = err instanceof HttpError ? err.retryAfterMs : undefined;
      const delay = retryAfter ?? backoff * 0.5 + jitter;
      await sleep(delay);
      attempt++;
    }
  }
}

/** Parse a Retry-After header (seconds or HTTP-date) into ms, relative to `now`. */
export function parseRetryAfter(header: string | null, now: number): number | undefined {
  if (!header) return undefined;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.max(0, date - now);
  return undefined;
}
