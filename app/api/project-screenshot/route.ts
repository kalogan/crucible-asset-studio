import { NextResponse } from "next/server";
import { getProjectBySlug, updateProject } from "@/lib/db/projects";
import { uploadProjectScreenshot } from "@/lib/projects/screenshot";

// Bearer-token-authed (same token as /api/import) — origin-open via CORS so a game
// harness can push a captured hero image (e.g. a render of its splash world) and set
// it as the project's portfolio screenshot.
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
 * Set a project's portfolio hero image from a base64 PNG/JPEG.
 * Body: { projectSlug, dataBase64 (or imageBase64), mimeType? }.
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
  const dataBase64 = String(body.dataBase64 ?? body.imageBase64 ?? "");
  const mimeType = String(body.mimeType ?? "image/png");
  if (!slug || !dataBase64) {
    return json({ error: "Required: projectSlug, dataBase64 (or imageBase64)." }, 400);
  }

  const project = await getProjectBySlug(slug);
  if (!project) return json({ error: `Unknown project: ${slug}` }, 404);

  try {
    const bytes = new Uint8Array(Buffer.from(dataBase64, "base64"));
    const url = await uploadProjectScreenshot(slug, bytes, mimeType, Date.now());
    await updateProject(project.id, { screenshot: url });
    return json({ ok: true, url });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Upload failed." }, 500);
  }
}
