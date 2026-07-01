// Import LOCAL asset files (from disk — e.g. a Downloads/Desktop folder) into Crucible as
// reference assets, via the running dev server's /api/import. Point it at files OR a folder.
//
//   pnpm dev                                          # in another terminal (serves /api/import)
//   pnpm import-local <path> [<path>...] --project <slug> [--type <asset_type>] [--label "<Label>"]
//
//   # a single file:
//   pnpm import-local "C:\Users\me\Downloads\hero.glb" --project gyre --type character
//   # a WHOLE FOLDER (recurses; imports every supported file — no need to move anything):
//   pnpm import-local "C:\Users\me\Desktop\my-models" --project gyre
//
// --project  Crucible project slug to attach to (default: living-dungeon)
// --type     reference asset_type: character|creature|prop|fx|biome|ui|other.
//            If OMITTED, each file's type is inferred from its parent folder name when that
//            name is a known type (e.g. .../characters/x.glb → character), else "other".
// --label    single-file only: overrides the filename-derived label.
//
// Supported: .glb .gltf .png .jpg .jpeg .webp .wav .mp3 .m4a .ogg. Idempotent per file
// (artKitId = local.<filename> ⇒ re-import re-syncs). Your originals are never moved/deleted.
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const argv = process.argv.slice(2);
const flagIdx = (name) => argv.indexOf(`--${name}`);
const flag = (name, def) => {
  const i = flagIdx(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
// Positional args = everything that isn't a flag or a flag's value.
const inputs = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));
const projectSlug = flag("project", "living-dungeon");
const explicitType = flagIdx("type") >= 0 ? flag("type", "other") : null;
const labelArg = flag("label", null);

const KNOWN_TYPES = new Set(["character", "creature", "prop", "fx", "biome", "ui", "other"]);
const MIME = {
  ".glb": "model/gltf-binary", ".gltf": "model/gltf+json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".ogg": "audio/ogg",
};

if (inputs.length === 0) {
  console.error('Usage: pnpm import-local <path> [...] --project <slug> [--type <asset_type>] [--label "<Label>"]');
  process.exit(1);
}
const token = process.env.CRUCIBLE_IMPORT_TOKEN;
if (!token) {
  console.error("Set CRUCIBLE_IMPORT_TOKEN in .env.local (the /api/import bearer token).");
  process.exit(1);
}
const base = process.env.CRUCIBLE_APP_URL || "http://localhost:3000";

/** Recursively collect supported files under a directory (or return the file itself). */
async function collect(p) {
  const s = await stat(p);
  if (!s.isDirectory()) return MIME[path.extname(p).toLowerCase()] ? [p] : [];
  const out = [];
  for (const entry of await readdir(p, { withFileTypes: true })) {
    const full = path.join(p, entry.name);
    if (entry.isDirectory()) out.push(...(await collect(full)));
    else if (MIME[path.extname(entry.name).toLowerCase()]) out.push(full);
  }
  return out;
}

/** Type for a file: explicit --type wins; else the parent-folder name if it's a known type. */
function typeFor(file) {
  if (explicitType) return explicitType;
  const parent = path.basename(path.dirname(file)).toLowerCase().replace(/s$/, "");
  return KNOWN_TYPES.has(parent) ? parent : "other";
}

function labelFromName(file) {
  return path.basename(file, path.extname(file)).replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

// Expand inputs → the full flat file list.
const files = [];
for (const inp of inputs) {
  try {
    files.push(...(await collect(inp)));
  } catch (err) {
    console.warn(`skip  ${inp} — ${err.message}`);
  }
}
if (files.length === 0) {
  console.error("No supported files found.");
  process.exit(1);
}
console.log(`${files.length} file(s) → project "${projectSlug}"\n`);

let ok = 0, fail = 0;
for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  const mimeType = MIME[ext];
  const stem = path.basename(file, ext);
  const label = files.length === 1 && labelArg ? labelArg : labelFromName(file);
  const type = typeFor(file);
  let dataBase64;
  try {
    dataBase64 = (await readFile(file)).toString("base64");
  } catch (err) {
    console.warn(`FAIL  ${label} — ${err.message}`);
    fail++;
    continue;
  }
  try {
    const res = await fetch(`${base}/api/import`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ projectSlug, type, label, artKitId: `local.${stem}`, dataBase64, mimeType }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error ?? `HTTP ${res.status}`);
    console.log(`ok    ${label.padEnd(28)} [${out.format}/${type}]`);
    ok++;
  } catch (err) {
    console.warn(`FAIL  ${label} — ${err.message}`);
    fail++;
  }
}
console.log(`\ndone: ${ok} imported → "${projectSlug}", ${fail} failed.`);
