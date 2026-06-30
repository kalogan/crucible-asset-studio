import { NextResponse } from "next/server";
import { getProjectBySlug } from "@/lib/db/projects";
import { bakeAudioAsset, type AudioRecipe } from "@/lib/pipeline/audio";

// Bearer-token-authed (matches /api/batch, /api/import): the token is the gate, not the origin.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: CORS });
}

export function OPTIONS(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * A short two-tone "coin pickup" cue — a sensible default so a bake can be triggered with
 * just a project slug. Mirrors the kind of recipe the runtime AudioManager would play.
 */
const SAMPLE_RECIPE: AudioRecipe = {
  sampleRate: 44100,
  masterGain: 0.8,
  events: [
    { type: "tone", wave: "square", freq: 880, startSec: 0, durationSec: 0.08, gain: 0.5 },
    { type: "tone", wave: "square", freq: 1318.5, startSec: 0.08, durationSec: 0.12, gain: 0.5 },
  ],
};

/**
 * Bake a procgen synth recipe to a WAV and store it as a first-class `kind: "audio"` asset.
 *
 * Auth: `Authorization: Bearer <CRUCIBLE_IMPORT_TOKEN>`.
 * Body: { projectSlug, title?, recipe? } — recipe defaults to a sample cue.
 *
 * No cost gate: baking is pure local synthesis (no external/paid call).
 */
export async function POST(req: Request): Promise<NextResponse> {
  const token = process.env.CRUCIBLE_IMPORT_TOKEN;
  if (!token) return json({ error: "Audio bake not configured." }, 503);
  if (req.headers.get("authorization") !== `Bearer ${token}`) {
    return json({ error: "Unauthorized." }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }

  const projectSlug = String(body.projectSlug ?? "");
  if (!projectSlug) return json({ error: "Required: projectSlug." }, 400);
  const title = typeof body.title === "string" && body.title ? body.title : "Coin Pickup";
  const recipe = (body.recipe as AudioRecipe | undefined) ?? SAMPLE_RECIPE;

  const project = await getProjectBySlug(projectSlug);
  if (!project) return json({ error: `No project with slug "${projectSlug}".` }, 404);

  try {
    const asset = await bakeAudioAsset({
      projectId: project.id,
      projectSlug: project.slug,
      title,
      recipe,
    });
    return json({ ok: true, id: asset.id, url: asset.raw_path, title });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Bake failed." }, 500);
  }
}
