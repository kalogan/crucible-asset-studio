import { NextResponse } from "next/server";
import { getProjectBySlug } from "@/lib/db/projects";
import { createReferenceAsset } from "@/lib/db/reference-assets";
import { persistBase64ToStorage, extForContentType } from "@/lib/executor";
import { ReferenceAssetType } from "@/lib/schema";

/**
 * Import a rendered reference asset (e.g. a procgen turntable captured from a game's
 * preview harness). Auth: `Authorization: Bearer <CRUCIBLE_IMPORT_TOKEN>`.
 * Body: { projectSlug, type, label, artKitId?, imageBase64, mimeType? }.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const token = process.env.CRUCIBLE_IMPORT_TOKEN;
  if (!token) return NextResponse.json({ error: "Import not configured." }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const slug = String(body.projectSlug ?? "");
  const label = String(body.label ?? "");
  const typeParsed = ReferenceAssetType.safeParse(body.type);
  // Accept a PNG capture (imageBase64) or a GLB exported via GLTFExporter (dataBase64).
  const dataBase64 = String(body.dataBase64 ?? body.imageBase64 ?? "");
  const mimeType = String(body.mimeType ?? "image/png");
  const artKitId = body.artKitId ? String(body.artKitId) : null;
  const format =
    mimeType.includes("gltf") || mimeType.includes("glb") ? "model" : "image";

  if (!slug || !label || !typeParsed.success || !dataBase64) {
    return NextResponse.json(
      { error: "Required: projectSlug, type, label, dataBase64 (or imageBase64)." },
      { status: 400 },
    );
  }

  const project = await getProjectBySlug(slug);
  if (!project) return NextResponse.json({ error: `Unknown project: ${slug}` }, { status: 404 });

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
    return NextResponse.json({ ok: true, id: ref.id, url, format });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed." },
      { status: 500 },
    );
  }
}
