import { NextResponse } from "next/server";
import { getProjectBySlug } from "@/lib/db/projects";
import { createReferenceAsset } from "@/lib/db/reference-assets";
import { persistBase64ToStorage, extForContentType } from "@/lib/executor";
import { ReferenceAssetType } from "@/lib/schema";

// Bearer-token-authed, so allow any origin (the harness pushes cross-origin from its
// own dev server / build). The token is the gate, not the origin.
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
 * Import a rendered reference asset (e.g. a procgen turntable/GLB from a game's
 * preview harness). Auth: `Authorization: Bearer <CRUCIBLE_IMPORT_TOKEN>`.
 * Body: { projectSlug, type, label, artKitId?, dataBase64 (or imageBase64), mimeType? }.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const token = process.env.CRUCIBLE_IMPORT_TOKEN;
  if (!token) return json({ error: "Import not configured." }, 503);
  if (req.headers.get("authorization") !== `Bearer ${token}`) {
    return json({ error: "Unauthorized." }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }

  const slug = String(body.projectSlug ?? "");
  const label = String(body.label ?? "");
  const typeParsed = ReferenceAssetType.safeParse(body.type);
  const dataBase64 = String(body.dataBase64 ?? body.imageBase64 ?? "");
  const mimeType = String(body.mimeType ?? "image/png");
  const artKitId = body.artKitId ? String(body.artKitId) : null;
  const format = mimeType.includes("gltf") || mimeType.includes("glb") ? "model" : "image";

  if (!slug || !label || !typeParsed.success || !dataBase64) {
    return json({ error: "Required: projectSlug, type, label, dataBase64 (or imageBase64)." }, 400);
  }

  const project = await getProjectBySlug(slug);
  if (!project) return json({ error: `Unknown project: ${slug}` }, 404);

  try {
    const safe = (artKitId ?? label).replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${slug}/reference/${typeParsed.data}/${safe}.${extForContentType(mimeType)}`;
    const url = await persistBase64ToStorage({ base64: dataBase64, mimeType, path });
    const ref = await createReferenceAsset({
      project_id: project.id,
      asset_type: typeParsed.data,
      label,
      source: "procgen",
      format,
      image_path: url,
      art_kit_id: artKitId,
    });
    return json({ ok: true, id: ref.id, url, format });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Import failed." }, 500);
  }
}
