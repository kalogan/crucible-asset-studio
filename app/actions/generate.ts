"use server";

import { redirect } from "next/navigation";
import { getActiveProject } from "@/lib/active-project";
import { runGenerationPipeline, runImagePipeline } from "@/lib/pipeline/generate";
import { enrichPrompt } from "@/lib/executor";
import {
  artBibleFromCanon,
  buildSystemPlayer,
  buildSystemEnemies,
  buildPlayerUserMessage,
  buildEnemyUserMessage,
  assembleFallbackPrompt,
  forgeOptionsForProject,
  mutationInOptions,
  variantInOptions,
  poseById,
  type ForgeMode,
} from "@/lib/generate/living-dungeon-forge";
import { getCanonByProject } from "@/lib/db/canons";
import { canonReadiness } from "@/lib/canon/precision";
import {
  countJobsSince,
  countActiveJobsSince,
  getLatestGeneratingJob,
} from "@/lib/db/jobs";
import {
  getDailyCostCap,
  startOfUtcDayIso,
  wouldExceedCap,
  estimatedSpend,
  INFLIGHT_WINDOW_MS,
} from "@/lib/budget";
import type { ActionResult } from "./projects";

export async function runGenerateAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const active = await getActiveProject();
  if (!active) return { ok: false, error: "No active project — pick one first." };

  const title = String(formData.get("title") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();
  if (title.length < 2) return { ok: false, error: "Title is required." };
  if (prompt.length < 3) return { ok: false, error: "Prompt is required." };

  // ── Canon precision gate: if a canon exists it must be ready (CANON_INTAKE §6).
  // No canon = canon-free generation is allowed (output won't be on-style).
  const canon = await getCanonByProject(active.id);
  if (canon) {
    const { ready, missing } = canonReadiness(canon);
    if (!ready) {
      return {
        ok: false,
        error: `Canon "${canon.name}" isn't ready — missing: ${missing.join(", ")}. Finish it in the Canon panel.`,
      };
    }
  }

  // ── Cost guardrails (before any spend) ──
  const now = new Date();
  const inflight = await countActiveJobsSince(
    new Date(now.getTime() - INFLIGHT_WINDOW_MS).toISOString(),
  );
  if (inflight > 0) {
    return {
      ok: false,
      error: "A generation is already running — wait for it to finish before starting another.",
    };
  }
  const jobsToday = await countJobsSince(startOfUtcDayIso(now));
  const cap = getDailyCostCap();
  if (wouldExceedCap(jobsToday, cap)) {
    return {
      ok: false,
      error: `Daily cost cap reached (~$${estimatedSpend(jobsToday).toFixed(2)} of $${cap.toFixed(2)}). Raise CRUCIBLE_DAILY_COST_CAP in .env.local to continue.`,
    };
  }

  const mode = String(formData.get("mode") ?? "image") === "model" ? "model" : "image";
  const run = mode === "model" ? runGenerationPipeline : runImagePipeline;
  const assetType = String(formData.get("assetType") ?? "prop");
  const provider =
    String(formData.get("provider") ?? "flux") === "nanobanana" ? "nanobanana" : "flux";

  try {
    await run({
      projectId: active.id,
      projectSlug: active.slug,
      title,
      prompt,
      assetType,
      provider,
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Generation failed.",
    };
  }
  redirect("/review");
}

// ── Living Dungeon forge ─────────────────────────────────────────────────────

// The forge pinned "claude-sonnet-4-20250514", but that dated id 404s on this account.
// Use the live Sonnet-4 alias (same tier, Crucible's default enrich model) for parity.
const FORGE_MODEL = "claude-sonnet-4-6";
const FORGE_MAX_TOKENS = 400;

export interface ForgePromptResult {
  ok: boolean;
  prompt?: string;
  /** True when the deterministic fallback was used (no ANTHROPIC_API_KEY / call failed). */
  fallback?: boolean;
  error?: string;
}

/**
 * Compose the forge's verbatim user message, run it through Claude (sonnet-4 + the
 * mode's exact art-bible system prompt), and return the enriched FLUX prompt. The art
 * bible is now DERIVED FROM THE ACTIVE PROJECT'S CANON (`artBibleFromCanon`) so every
 * game forges in its own style; mutations/variants are per-project (empty for a project
 * that has none). Fail-soft: with no key (or on error) enrichPrompt returns its input
 * unchanged — we detect that and fall back to a deterministic assembled prompt that
 * still carries theme + palette + forbidden + pose.
 */
export async function buildForgePrompt(input: {
  mode: string;
  poseId: string;
  mutationId: string;
  variantId: string;
  description: string;
}): Promise<ForgePromptResult> {
  const mode: ForgeMode = input.mode === "enemy" ? "enemy" : "player";
  const label = input.description.trim();

  const active = await getActiveProject();
  if (!active) return { ok: false, error: "No active project — pick one first." };
  const canon = await getCanonByProject(active.id);
  const bible = artBibleFromCanon(canon);
  const options = forgeOptionsForProject(active.slug);

  if (mode === "player") {
    const pose = poseById(input.poseId);
    const mutation = mutationInOptions(options, input.mutationId);
    const variant = variantInOptions(options, input.variantId);
    const system = buildSystemPlayer(bible);
    const userMessage = buildPlayerUserMessage({ poseLabel: pose.poseLabel, mutation, variant });
    const fallback = assembleFallbackPrompt({
      mode: "player",
      P: bible,
      poseLabel: pose.poseLabel,
      mutation,
      variant,
    });
    const enriched = await enrichPrompt(userMessage, {
      system,
      model: FORGE_MODEL,
      maxTokens: FORGE_MAX_TOKENS,
      userMessage,
    });
    // enrichPrompt returns its input verbatim when the key is missing / the call fails.
    const usedFallback = enriched === userMessage;
    return { ok: true, prompt: usedFallback ? fallback : enriched, fallback: usedFallback };
  }

  // enemy
  if (label.length < 3) return { ok: false, error: "Describe the enemy first." };
  const system = buildSystemEnemies(bible);
  const userMessage = buildEnemyUserMessage({ label, userDescription: label });
  const fallback = assembleFallbackPrompt({
    mode: "enemy",
    P: bible,
    label,
    userDescription: label,
  });
  const enriched = await enrichPrompt(userMessage, {
    system,
    model: FORGE_MODEL,
    maxTokens: FORGE_MAX_TOKENS,
    userMessage,
  });
  const usedFallback = enriched === userMessage;
  return { ok: true, prompt: usedFallback ? fallback : enriched, fallback: usedFallback };
}

/**
 * Run a Living Dungeon forge generation. The (possibly Director-edited) enriched prompt
 * is passed to FLUX VERBATIM via `finalPromptOverride`, bypassing canon scaffolding.
 * When the pose is the rig-ready T-pose, the recipe is marked character-tpose so
 * promote-to-3D keeps the 0.88 mesh_simplify. Same cost guardrails as the normal path.
 */
export async function runForgeGenerateAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const active = await getActiveProject();
  if (!active) return { ok: false, error: "No active project — pick one first." };

  const title = String(formData.get("title") ?? "").trim();
  const finalPrompt = String(formData.get("forgePrompt") ?? "").trim();
  if (title.length < 2) return { ok: false, error: "Title is required." };
  if (finalPrompt.length < 3) {
    return { ok: false, error: "Build the prompt first, then generate." };
  }

  // ── Cost guardrails (before any spend) — mirror runGenerateAction ──
  const now = new Date();
  const inflight = await countActiveJobsSince(
    new Date(now.getTime() - INFLIGHT_WINDOW_MS).toISOString(),
  );
  if (inflight > 0) {
    return {
      ok: false,
      error: "A generation is already running — wait for it to finish before starting another.",
    };
  }
  const jobsToday = await countJobsSince(startOfUtcDayIso(now));
  const cap = getDailyCostCap();
  if (wouldExceedCap(jobsToday, cap)) {
    return {
      ok: false,
      error: `Daily cost cap reached (~$${estimatedSpend(jobsToday).toFixed(2)} of $${cap.toFixed(2)}). Raise CRUCIBLE_DAILY_COST_CAP in .env.local to continue.`,
    };
  }

  const mode = String(formData.get("mode") ?? "image") === "model" ? "model" : "image";
  const run = mode === "model" ? runGenerationPipeline : runImagePipeline;
  // Rig-ready poses (A-pose = recommended default, or T-pose) map to their character-*pose
  // framing key → promote-to-3D keeps the geometry budget high. Non-rig poses → "character".
  const selectedPose = poseById(String(formData.get("poseId") ?? ""));
  const assetType = selectedPose.rigReadyKey ?? "character";
  const provider =
    String(formData.get("provider") ?? "flux") === "nanobanana" ? "nanobanana" : "flux";

  try {
    await run({
      projectId: active.id,
      projectSlug: active.slug,
      title,
      // The override is what actually reaches FLUX; `prompt` is retained for the spec record.
      prompt: finalPrompt,
      assetType,
      provider,
      finalPromptOverride: finalPrompt,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Generation failed." };
  }
  redirect("/review");
}

export interface GenerationStatus {
  phase: "image" | "cutout" | "model" | "saving";
  elapsedMs: number;
}

/** Polled by the form while a generation runs, to drive the live stage indicator. */
export async function getGenerationStatus(): Promise<GenerationStatus | null> {
  const job = await getLatestGeneratingJob();
  if (!job) return null;
  const phase = (job.phase ?? "image") as GenerationStatus["phase"];
  return { phase, elapsedMs: Date.now() - new Date(job.created_at).getTime() };
}
