import JSZip from "jszip";
import {
  generateScaffold,
  type ScaffoldTarget,
  type ScaffoldTemplate,
} from "@/lib/scaffold/generate";
import { vendorKitFiles } from "@/lib/scaffold/vendor";
import { slugify } from "@/lib/util/slug";

const TEMPLATES = new Set<ScaffoldTemplate>(["blank", "multiplayer", "procgen-world", "moody-explorer"]);

/**
 * Build the scaffold zip server-side, INCLUDING the vendored game-kit source so the
 * starter is self-contained (the kit repo is private). The client posts the picks and
 * downloads the returned zip.
 */
export async function POST(req: Request): Promise<Response> {
  let body: {
    name?: unknown;
    target?: unknown;
    template?: unknown;
    systemIds?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "My Game";
  const target: ScaffoldTarget = body.target === "vanilla" ? "vanilla" : "r3f";
  const template: ScaffoldTemplate = TEMPLATES.has(body.template as ScaffoldTemplate)
    ? (body.template as ScaffoldTemplate)
    : "blank";
  const systemIds = Array.isArray(body.systemIds) ? body.systemIds.map(String) : [];

  const files = generateScaffold({ name, target, template, systemIds });
  const zip = new JSZip();
  for (const f of [...files, ...vendorKitFiles()]) zip.file(f.path, f.content);
  const bytes = await zip.generateAsync({ type: "uint8array" });

  const slug = slugify(name) || "game";
  // Cast: undici's Response accepts a Uint8Array body at runtime; the mismatch is a
  // TS lib-types artifact (Uint8Array<ArrayBufferLike> vs BodyInit).
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${slug}.zip"`,
    },
  });
}
