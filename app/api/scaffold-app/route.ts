import "server-only";

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import JSZip from "jszip";
import {
  generateAppScaffold,
  type AppScaffoldFile,
} from "@/lib/scaffold/generate-app";
import { slugify } from "@/lib/util/slug";

/**
 * Read the vendored app-kit source (vendor/app-kit/src/**) as scaffold files so a
 * generated app starter carries the kit INLINE — the kit repo is private, so a
 * `github:` dependency wouldn't install. Server-only (filesystem). The starter
 * aliases these via its tsconfig. Mirrors lib/scaffold/vendor.ts (game-kit), kept
 * local so this app-kit route owns its own vendoring.
 */
function vendorAppKitFiles(): AppScaffoldFile[] {
  const root = join(process.cwd(), "vendor", "app-kit", "src");
  const out: AppScaffoldFile[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (/\.tsx?$/.test(name)) {
        const rel = relative(root, full).split(/[\\/]/).join("/");
        out.push({
          path: `vendor/app-kit/src/${rel}`,
          content: readFileSync(full, "utf8"),
        });
      }
    }
  };
  walk(root);
  return out;
}

/**
 * Build the app-starter zip server-side, INCLUDING the vendored app-kit source so
 * the starter is self-contained (the kit repo is private). The client posts the
 * picks and downloads the returned zip. Mirrors app/api/scaffold/route.ts.
 */
export async function POST(req: Request): Promise<Response> {
  let body: {
    name?: unknown;
    moduleIds?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const name =
    typeof body.name === "string" && body.name.trim() ? body.name.trim() : "My App";
  const moduleIds = Array.isArray(body.moduleIds) ? body.moduleIds.map(String) : [];

  const files = generateAppScaffold({ name, moduleIds });
  const zip = new JSZip();
  for (const f of [...files, ...vendorAppKitFiles()]) zip.file(f.path, f.content);
  const bytes = await zip.generateAsync({ type: "uint8array" });

  const slug = slugify(name) || "app";
  // Cast: undici's Response accepts a Uint8Array body at runtime; the mismatch is a
  // TS lib-types artifact (Uint8Array<ArrayBufferLike> vs BodyInit).
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${slug}.zip"`,
    },
  });
}
