// Import LOCAL asset files (from disk — e.g. downloads) into Crucible as reference assets,
// via the running dev server's /api/import. For models/images/audio you have on your machine.
//
//   pnpm dev                                          # in another terminal (serves /api/import)
//   pnpm import-local <file> [<file>...] --project <slug> --type <asset_type> --label "<Label>"
//
//   pnpm import-local "C:\Users\me\Downloads\hero.glb" --project living-dungeon --type character
//
// --project  Crucible project slug to attach to (default: living-dungeon)
// --type     reference asset_type: character|creature|prop|fx|biome|ui|other (default: other)
// --label    display label (default: derived from the filename). With multiple files, each
//            file's label is its filename; --label only applies when importing a single file.
//
// Format is detected from the extension. Needs CRUCIBLE_IMPORT_TOKEN in .env.local. Idempotent
// per file (artKitId = local.<filename>), so re-importing re-syncs instead of duplicating.
import { readFile } from "node:fs/promises";
import path from "node:path";

const argv = process.argv.slice(2);
const flag = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const files = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));
const projectSlug = flag("project", "living-dungeon");
const assetType = flag("type", "other");
const labelArg = flag("label", null);

if (files.length === 0) {
  console.error('Usage: pnpm import-local <file> [...] --project <slug> --type <asset_type> --label "<Label>"');
  process.exit(1);
}

const token = process.env.CRUCIBLE_IMPORT_TOKEN;
if (!token) {
  console.error("Set CRUCIBLE_IMPORT_TOKEN in .env.local (the /api/import bearer token).");
  process.exit(1);
}
const base = process.env.CRUCIBLE_APP_URL || "http://localhost:3000";

const MIME = {
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
};

function labelFromName(file) {
  return path
    .basename(file, path.extname(file))
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

let ok = 0;
let fail = 0;
for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  const mimeType = MIME[ext];
  if (!mimeType) {
    console.warn(`skip  ${file} — unsupported extension "${ext}"`);
    fail++;
    continue;
  }
  const stem = path.basename(file, ext);
  const label = files.length === 1 && labelArg ? labelArg : labelFromName(file);
  let dataBase64;
  try {
    dataBase64 = (await readFile(file)).toString("base64");
  } catch (err) {
    console.warn(`skip  ${file} — ${err.message}`);
    fail++;
    continue;
  }
  try {
    const res = await fetch(`${base}/api/import`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        projectSlug,
        type: assetType,
        label,
        artKitId: `local.${stem}`,
        dataBase64,
        mimeType,
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error ?? `HTTP ${res.status}`);
    console.log(`ok    ${label.padEnd(24)} [${out.format}] → ${out.url}`);
    ok++;
  } catch (err) {
    console.warn(`FAIL  ${label} — ${err.message}`);
    fail++;
  }
}
console.log(`\ndone: ${ok} imported → "${projectSlug}", ${fail} failed.`);
