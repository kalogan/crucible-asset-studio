import "server-only";
import { createBatch, getBatch, updateBatch } from "@/lib/db/batches";
import {
  claimQueuedJob,
  createJob,
  listJobsByBatch,
  updateJob,
} from "@/lib/db/jobs";
import { getAssetSpec } from "@/lib/db/specs";
import { getProject } from "@/lib/db/projects";
import { getCanonByProject } from "@/lib/db/canons";
import { createAsset } from "@/lib/db/assets";
import { buildStoragePath } from "./paths";
import {
  baseRecipe,
  generate2D,
  generate3D,
  type ImageProvider,
  type PipelineInput,
} from "./generate";
import { FLUX_TEXT2IMG, TRELLIS_DEFAULTS } from "@/lib/executor";
import { PER_RUN_COST_ESTIMATE } from "@/lib/budget";
import type { AssetSpec, Canon, Job, Project } from "@/lib/schema";

/**
 * Resumable batch worker (Phase 3, slice 1). Drains a batch's queued jobs through the
 * EXISTING single-asset generation path (generate2D -> optional generate3D -> persist),
 * advancing each job queued -> generating -> succeeded/failed and rolling the batch status
 * up from those outcomes.
 *
 * Re-entrant: each job is claimed via claimQueuedJob (a guarded queued->generating flip),
 * so re-running a batch after an interruption picks up only the jobs that never finished and
 * NEVER re-runs a `succeeded` one — no double-charge.
 *
 * Cost seam: pass { dryRun: true } (the default for the trigger script) to run the whole
 * loop with MOCK generation — no Replicate/Anthropic call, no storage write, zero spend.
 * The real path exists but is reached only with dryRun: false.
 */

export interface WorkerOptions {
  /** MOCK mode — no external API call, no spend. Default true (safe by default). */
  dryRun?: boolean;
  /** Cap how many jobs to run this pass (the rest stay queued for the next run). */
  limit?: number;
}

export interface JobResult {
  jobId: string;
  status: "succeeded" | "failed" | "skipped";
  cost: number;
  note?: string;
}

export interface BatchRunResult {
  batchId: string;
  dryRun: boolean;
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  costActual: number;
  jobs: JobResult[];
}

/** A spec carries the generation knobs in `params`; read them back with safe defaults. */
function inputFromSpec(spec: AssetSpec, project: Project): { input: PipelineInput; mode: "image" | "model" } {
  const params = spec.params ?? {};
  const mode = params["mode"] === "model" ? "model" : "image";
  const provider: ImageProvider = params["provider"] === "nanobanana" ? "nanobanana" : "flux";
  const assetType =
    typeof params["assetType"] === "string" ? (params["assetType"] as string) : "prop";
  return {
    mode,
    input: {
      projectId: project.id,
      projectSlug: project.slug,
      title: spec.title,
      prompt: spec.prompt,
      assetType,
      provider,
    },
  };
}

/** MOCK generation — deterministic placeholder URLs, no provider call, no persist, no spend. */
function mockOutputs(input: PipelineInput, spec: AssetSpec, canon: Canon | null, mode: "image" | "model") {
  const finalPrompt = `[dry-run] ${input.prompt}`;
  const imageUrl = `mock://${buildStoragePath(input.projectSlug, spec.catalog_key, "png")}`;
  const recipe = {
    ...baseRecipe(input, canon, finalPrompt),
    image_url: imageUrl,
    image_prediction: "dry-run",
    dry_run: true,
  };
  if (mode === "model") {
    const glbUrl = `mock://${buildStoragePath(input.projectSlug, spec.catalog_key, "glb")}`;
    return {
      rawPath: glbUrl,
      kind: "model" as const,
      recipe: { ...recipe, model_3d: "firtoz/trellis", model_prediction: "dry-run", trellis: TRELLIS_DEFAULTS },
    };
  }
  return { rawPath: imageUrl, kind: "image" as const, recipe };
}

/** REAL generation — the existing paid FLUX/(TRELLIS) path. Only reached with dryRun: false. */
async function realOutputs(
  jobId: string,
  input: PipelineInput,
  spec: AssetSpec,
  canon: Canon | null,
  mode: "image" | "model",
) {
  const img = await generate2D(jobId, input, canon, spec.catalog_key);
  if (mode === "model") {
    const { glbUrl, predictionId } = await generate3D(jobId, input.projectSlug, spec.catalog_key, img.imageUrl);
    return {
      rawPath: glbUrl,
      kind: "model" as const,
      providerRef: predictionId,
      cost: 0.09,
      recipe: {
        ...baseRecipe(input, canon, img.finalPrompt),
        model_3d: "firtoz/trellis",
        image_url: img.imageUrl,
        image_prediction: img.predictionId,
        model_prediction: predictionId,
        trellis: TRELLIS_DEFAULTS,
      },
    };
  }
  return {
    rawPath: img.imageUrl,
    kind: "image" as const,
    providerRef: img.predictionId,
    cost: 0.01,
    recipe: { ...baseRecipe(input, canon, img.finalPrompt), image_url: img.imageUrl, image_prediction: img.predictionId },
  };
}

/** Run ONE already-claimed job to terminal state (succeeded/failed). Tolerant: never throws. */
async function runClaimedJob(job: Job, dryRun: boolean): Promise<JobResult> {
  try {
    const spec = await getAssetSpec(job.spec_id);
    if (!spec) throw new Error(`spec ${job.spec_id} not found`);
    const project = await getProject(spec.project_id);
    if (!project) throw new Error(`project ${spec.project_id} not found`);
    const canon = await getCanonByProject(project.id);
    const { input, mode } = inputFromSpec(spec, project);

    if (dryRun) {
      const out = mockOutputs(input, spec, canon, mode);
      await updateJob(job.id, {
        status: "succeeded",
        phase: "saving",
        provider_ref: "dry-run",
        recipe_snapshot: out.recipe,
        cost: 0,
      });
      await createAsset({
        project_id: project.id,
        spec_id: spec.id,
        job_id: job.id,
        stage: "in_review",
        kind: out.kind,
        raw_path: out.rawPath,
        recipe_snapshot: out.recipe,
      });
      return { jobId: job.id, status: "succeeded", cost: 0, note: "dry-run" };
    }

    const out = await realOutputs(job.id, input, spec, canon, mode);
    await updateJob(job.id, {
      status: "succeeded",
      provider_ref: out.providerRef,
      recipe_snapshot: out.recipe,
      cost: out.cost,
    });
    await createAsset({
      project_id: project.id,
      spec_id: spec.id,
      job_id: job.id,
      stage: "in_review",
      kind: out.kind,
      raw_path: out.rawPath,
      recipe_snapshot: out.recipe,
    });
    return { jobId: job.id, status: "succeeded", cost: out.cost };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateJob(job.id, { status: "failed", error: message }).catch(() => {});
    return { jobId: job.id, status: "failed", cost: 0, note: message };
  }
}

/**
 * Drain (or resume) a batch. Marks it `running`, claims and runs each queued/stale job in
 * order, then rolls the batch up to `done` (all jobs terminal, none failed) or `failed`
 * (at least one job failed). Already-succeeded jobs are skipped, not re-run.
 */
export async function runBatch(batchId: string, opts: WorkerOptions = {}): Promise<BatchRunResult> {
  const dryRun = opts.dryRun ?? true;
  const batch = await getBatch(batchId);
  if (!batch) throw new Error(`runBatch: batch ${batchId} not found`);

  await updateBatch(batchId, { status: "running" });

  const jobs = await listJobsByBatch(batchId);
  const results: JobResult[] = [];
  let costActual = 0;
  let ran = 0;

  for (const job of jobs) {
    if (opts.limit != null && ran >= opts.limit) break;
    // Idempotent skip: anything already terminal stays put (no re-charge).
    if (job.status === "succeeded" || job.status === "canceled") {
      results.push({ jobId: job.id, status: "skipped", cost: 0, note: job.status });
      continue;
    }
    const claimed = await claimQueuedJob(job.id);
    if (!claimed) {
      // Lost the race / not claimable — treat as skipped this pass.
      results.push({ jobId: job.id, status: "skipped", cost: 0, note: "not claimable" });
      continue;
    }
    const r = await runClaimedJob(claimed, dryRun);
    results.push(r);
    costActual += r.cost;
    ran++;
  }

  const succeeded = results.filter((r) => r.status === "succeeded").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;

  // Re-read to settle final status against the WHOLE batch, not just this pass: the batch is
  // only `done` when no job remains queued/generating and none failed.
  const after = await listJobsByBatch(batchId);
  const anyFailed = after.some((j) => j.status === "failed");
  const anyUnfinished = after.some((j) => j.status === "queued" || j.status === "generating");
  const finalStatus = anyFailed ? "failed" : anyUnfinished ? "running" : "done";

  // Accumulate real spend across resume passes. Mock runs add 0, so the ledger stays clean.
  await updateBatch(batchId, { status: finalStatus, cost_actual: batch.cost_actual + costActual });

  return {
    batchId,
    dryRun,
    total: jobs.length,
    succeeded,
    failed,
    skipped,
    costActual,
    jobs: results,
  };
}

/** Rough cost estimate for a batch of N jobs (the cap proxy used elsewhere). */
export function estimateBatchCost(jobCount: number): number {
  return jobCount * PER_RUN_COST_ESTIMATE;
}

/**
 * Create a batch + one QUEUED job per spec. This is the producer side: the worker
 * (runBatch) is the consumer that drains the queue. Jobs land `queued` (not `generating`)
 * so the worker owns the queued->generating transition and nothing is charged at enqueue.
 */
export async function enqueueBatch(args: {
  projectId: string;
  name: string;
  specIds: string[];
  dryRun?: boolean;
}): Promise<{ batchId: string; jobIds: string[] }> {
  const dryRun = args.dryRun ?? true;
  const batch = await createBatch({
    project_id: args.projectId,
    name: args.name,
    status: "queued",
    cost_estimate: estimateBatchCost(args.specIds.length),
    dry_run: dryRun,
  });
  const jobIds: string[] = [];
  for (const specId of args.specIds) {
    const job = await createJob({ spec_id: specId, batch_id: batch.id, status: "queued" });
    jobIds.push(job.id);
  }
  return { batchId: batch.id, jobIds };
}
