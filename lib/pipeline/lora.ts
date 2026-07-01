import type { Canon } from "@/lib/schema";

/**
 * LoRA enforcer — the precision gate for canon STYLE FIDELITY in the batch worker.
 *
 * This is a VALIDATION gate, not LoRA training: it never trains, never calls a paid
 * path. Its only job is to refuse to generate an off-style asset once a canon's LoRA
 * is trained and marked `ready`.
 *
 * The contract:
 *   - lora_status "none" | "training"  → no gate (behave exactly as pre-LoRA).
 *   - lora_status "ready"              → the trained LoRA MUST be applied: `lora_ref`
 *                                        is required (and by convention `lora_trigger`,
 *                                        the token that activates the LoRA in the
 *                                        prompt). If either is missing, the job FAILS
 *                                        loudly rather than silently generating
 *                                        canon-free, off-style output.
 *
 * Mirrors the shape of `canonReadiness` (lib/canon/precision.ts): a pure function
 * returning a structured result, so the worker (and tests) can gate without side effects.
 */
export interface LoraEnforcement {
  /** True when generation is allowed to proceed for this canon. */
  ok: boolean;
  /** True when a trained LoRA is ready and MUST be threaded into the recipe. */
  enforced: boolean;
  /** Present only when ok === false: a loud, actionable reason. */
  error?: string;
  /** The applied ref/trigger when enforced — thread these into the recipe snapshot. */
  loraRef?: string;
  loraTrigger?: string;
}

function nonEmpty(v: string | null | undefined): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Decide whether a generation may run for this canon, and — when a trained LoRA is
 * ready — what ref/trigger must be applied. No canon => canon-free generation is
 * allowed (nothing to enforce yet), same as the pre-LoRA behavior.
 */
export function enforceLoraReadiness(canon: Canon | null): LoraEnforcement {
  // No canon, or LoRA not trained yet: nothing to enforce — behave as today.
  if (!canon || canon.lora_status !== "ready") {
    return { ok: true, enforced: false };
  }

  // LoRA is READY — the trained model MUST be applied. Require the ref (and trigger).
  const missing: string[] = [];
  if (!nonEmpty(canon.lora_ref)) missing.push("lora_ref");
  if (!nonEmpty(canon.lora_trigger)) missing.push("lora_trigger");

  if (missing.length > 0) {
    return {
      ok: false,
      enforced: true,
      error:
        `Canon "${canon.name}" has lora_status "ready" but is missing ${missing.join(", ")} — ` +
        `refusing to generate off-style (canon-free) output. Attach the trained LoRA ` +
        `(and its trigger token) to the canon before running this batch.`,
    };
  }

  return {
    ok: true,
    enforced: true,
    // Narrowed to string by the nonEmpty checks above.
    loraRef: canon.lora_ref as string,
    loraTrigger: canon.lora_trigger as string,
  };
}
