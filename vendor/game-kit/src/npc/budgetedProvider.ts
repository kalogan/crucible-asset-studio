/**
 * NPC reasoning — the BUDGET FIREWALL.
 *
 * `createBudgetedProvider` wraps ANY `ReasoningProvider` and guarantees the NPC never
 * breaks or hangs:
 *   (a) a per-interaction TIMEOUT (abort a slow inner call),
 *   (b) a GLOBAL + PER-PLAYER budget/rate-limit (cap calls so cost is bounded),
 *   (c) a SCRIPTED FALLBACK — the NPC's authored `fallbackLines` returned as a `say`
 *       intent whenever the inner provider throws, times out, is over budget, or
 *       returns nothing.
 *
 * So an outage / slow call / quota-exhaustion degrades GRACEFULLY to the exact scripted
 * line — never an error, never a hang, never a runaway bill. Server-side only.
 */

import { parseReasoningResponse } from './schema.js';
import type { ReasoningRequest, ReasoningResponse } from './schema.js';
import type { ReasoningProvider } from './provider.js';

export interface BudgetedProviderOptions {
  /** Per-interaction timeout in ms (the inner call is aborted past this). Default 8000. */
  timeoutMs?: number;
  /** Max interactions allowed GLOBALLY in the rolling window (cost cap). Default 1000. */
  globalBudget?: number;
  /** Max interactions allowed PER PLAYER in the rolling window. Default 30. */
  perPlayerBudget?: number;
  /** The rolling window length in ms over which the budgets apply. Default 60_000. */
  windowMs?: number;
  /** Injected clock (testability/determinism on the budget window). Default Date.now. */
  now?: () => number;
}

/** Context the caller passes per interaction: who's asking + the scripted fallback. */
export interface BudgetedInteraction {
  /** Stable per-player key for the per-player budget (e.g. sessionId / accountId). */
  playerKey: string;
  /** The NPC's authored scripted lines — the graceful-degrade output. */
  fallbackLines: readonly string[];
}

/** Context the agent passes per decision: who's asking + the safe-default decision. */
export interface BudgetedCompletion {
  /** Stable per-agent key for the per-"player" budget. */
  playerKey: string;
  /** The decision string returned on any failure (over-budget/timeout/throw/empty/no-key). */
  safeDefault: string;
}

/** A provider wrapped by the budget + timeout + scripted-fallback firewall. */
export interface BudgetedProvider {
  readonly name: string;
  respond(req: ReasoningRequest, ctx: BudgetedInteraction): Promise<ReasoningResponse>;
  complete(systemPrompt: string, userPrompt: string, ctx: BudgetedCompletion): Promise<string>;
}

const DEFAULTS = {
  timeoutMs: 8_000,
  globalBudget: 1_000,
  perPlayerBudget: 30,
  windowMs: 60_000,
} as const;

/** Drop timestamps older than the cutoff (rolling window). Returns a new bounded array. */
function prune(hits: number[], cutoff: number): number[] {
  let i = 0;
  while (i < hits.length && (hits[i] as number) <= cutoff) i++;
  return i === 0 ? hits : hits.slice(i);
}

/** Build the scripted-fallback response (the authored lines as a single `say` intent). */
function scriptedFallback(lines: readonly string[]): ReasoningResponse {
  const text = (lines[0] ?? '').trim();
  if (text.length === 0) return { intents: [] };
  // Route through the firewall so even the fallback obeys the intent contract (caps text).
  return { intents: parseReasoningResponse({ intents: [{ kind: 'say', text }] }) };
}

/**
 * Wrap a provider with the budget + timeout + scripted-fallback firewall. NEVER throws:
 * on ANY failure it degrades to the scripted line (respond) or the safe default (complete).
 */
export function createBudgetedProvider(
  inner: ReasoningProvider,
  options: BudgetedProviderOptions = {},
): BudgetedProvider {
  const now = options.now ?? Date.now;
  const opts = {
    timeoutMs: options.timeoutMs ?? DEFAULTS.timeoutMs,
    globalBudget: options.globalBudget ?? DEFAULTS.globalBudget,
    perPlayerBudget: options.perPlayerBudget ?? DEFAULTS.perPlayerBudget,
    windowMs: options.windowMs ?? DEFAULTS.windowMs,
  };

  // Rolling-window counters: timestamps of recent interactions (global + per player).
  let globalHits: number[] = [];
  const perPlayerHits = new Map<string, number[]>();

  function tryConsumeBudget(playerKey: string): boolean {
    const t = now();
    const cutoff = t - opts.windowMs;

    globalHits = prune(globalHits, cutoff);
    const playerHits = prune(perPlayerHits.get(playerKey) ?? [], cutoff);

    if (globalHits.length >= opts.globalBudget) return false;
    if (playerHits.length >= opts.perPlayerBudget) return false;

    globalHits.push(t);
    playerHits.push(t);
    perPlayerHits.set(playerKey, playerHits);
    return true;
  }

  return {
    name: `budgeted(${inner.name})`,

    async respond(req: ReasoningRequest, ctx: BudgetedInteraction): Promise<ReasoningResponse> {
      // (b) Budget gate — over budget ⇒ scripted fallback (no inner call, no cost).
      if (!tryConsumeBudget(ctx.playerKey)) {
        return scriptedFallback(ctx.fallbackLines);
      }

      // (a) Timeout gate — abort the inner call if it's slow.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
      try {
        const result = await inner.respond(req, controller.signal);
        // (c) Empty / nothing-to-say ⇒ scripted fallback (the NPC always speaks).
        if (!result || result.intents.length === 0) {
          return scriptedFallback(ctx.fallbackLines);
        }
        return result;
      } catch {
        // Inner threw OR timed out (abort surfaces as an error) ⇒ scripted fallback.
        return scriptedFallback(ctx.fallbackLines);
      } finally {
        clearTimeout(timer);
      }
    },

    async complete(
      systemPrompt: string,
      userPrompt: string,
      ctx: BudgetedCompletion,
    ): Promise<string> {
      if (!tryConsumeBudget(ctx.playerKey)) {
        return ctx.safeDefault;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
      try {
        const text = await inner.complete(systemPrompt, userPrompt, controller.signal);
        if (typeof text !== 'string' || text.trim().length === 0) {
          return ctx.safeDefault;
        }
        return text;
      } catch {
        return ctx.safeDefault;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
