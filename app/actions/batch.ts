"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getActiveProject } from "@/lib/active-project";
import { enqueueBatch, runBatch } from "@/lib/pipeline/worker";
import { getBatch } from "@/lib/db/batches";
import type { ActionResult } from "./projects";

/** Enqueue form: a batch name + the chosen spec ids (checkbox group, same field name). */
const EnqueueInput = z.object({
  name: z.string().trim().min(1, "Name the batch first."),
  specIds: z.array(z.string().uuid()).min(1, "Select at least one spec."),
});

/**
 * Producer: create a batch + one QUEUED job per selected spec via the worker's enqueueBatch
 * (no spend — jobs land `queued`, the worker owns queued->generating). The batch is created
 * with dry_run: true, matching the safe-by-default trigger; a paid run is a separate gated path.
 */
export async function enqueueBatchAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const active = await getActiveProject();
    if (!active) return { ok: false, error: "No active project — pick one first." };

    const parsed = EnqueueInput.safeParse({
      name: String(formData.get("name") ?? ""),
      specIds: formData.getAll("specIds").map(String),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid batch." };
    }

    await enqueueBatch({
      projectId: active.id,
      name: parsed.data.name,
      specIds: parsed.data.specIds,
      dryRun: true,
    });

    revalidatePath(`/projects/${active.slug}/batch`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to enqueue batch." };
  }
}

/**
 * Drain a batch in MOCK mode ($0). Calls runBatch with { dryRun: true } so no Replicate/Anthropic
 * call and no storage write happen — real spend is a separate path gated behind
 * CRUCIBLE_ALLOW_PAID_BATCH and is intentionally NOT exposed here.
 */
export async function runBatchDryRunAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const active = await getActiveProject();
    if (!active) return { ok: false, error: "No active project — pick one first." };

    const batchId = String(formData.get("batchId") ?? "").trim();
    if (!batchId) return { ok: false, error: "Missing batch." };

    // Guard: only run a batch that belongs to this project (the action is project-scoped).
    const batch = await getBatch(batchId);
    if (!batch || batch.project_id !== active.id) {
      return { ok: false, error: "Unknown batch." };
    }

    await runBatch(batchId, { dryRun: true });

    revalidatePath(`/projects/${active.slug}/batch`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Dry-run failed." };
  }
}
