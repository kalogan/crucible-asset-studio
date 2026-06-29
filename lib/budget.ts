/**
 * Cost guardrails (pure helpers). A conservative daily ceiling on generation spend,
 * counted by job COUNT × per-run estimate (counts every attempt — success OR
 * failure — since a failed run still spent on Replicate). The real hard cap is the
 * Replicate dashboard spend limit; this is the in-app belt-and-suspenders.
 */
export const PER_RUN_COST_ESTIMATE = 0.09; // FLUX + bg-removal + TRELLIS, rough
export const DEFAULT_DAILY_COST_CAP = 5; // USD
export const INFLIGHT_WINDOW_MS = 10 * 60 * 1000; // stale-lock guard for crashed jobs

export function getDailyCostCap(): number {
  const raw = process.env.CRUCIBLE_DAILY_COST_CAP;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DAILY_COST_CAP;
}

export function startOfUtcDayIso(now: Date): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}

export function estimatedSpend(jobCount: number): number {
  return jobCount * PER_RUN_COST_ESTIMATE;
}

/** Would the NEXT run push today's estimated spend over the cap? */
export function wouldExceedCap(jobCountToday: number, cap: number): boolean {
  return estimatedSpend(jobCountToday) + PER_RUN_COST_ESTIMATE > cap;
}
