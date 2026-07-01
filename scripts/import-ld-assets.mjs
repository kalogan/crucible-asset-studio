// Import Living Dungeon's assets from its OWN Supabase project into Crucible: copies the
// bytes into Crucible's `assets` bucket and records a `reference_assets` row per file
// (attached to the "living-dungeon" project). Idempotent — deterministic storage paths, so
// re-running skips anything already imported.
//
//   pnpm import-ld-assets            # DRY-RUN: list what would import (no writes) — the default
//   pnpm import-ld-assets --run      # actually copy + insert
//   pnpm import-ld-assets --run --images-all   # also import the images[] variants (not just image_url)
//   pnpm import-ld-assets --run --limit 20     # cap the number of items
//
// Env (.env.local): NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (Crucible, already set)
// and LD_SUPABASE_ANON_KEY (the Living Dungeon project's PUBLIC anon key — it's in
// living-dungeon-asset-forge/src/lib/supabase.js). LD_SUPABASE_URL defaults to the known project.
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const DRY = !args.includes("--run");
const IMAGES_ALL = args.includes("--images-all");
const limitFlag = args.indexOf("--limit");
const LIMIT = limitFlag >= 0 ? Number(args[limitFlag + 1]) : Infinity;

const LD_URL = process.env.LD_SUPABASE_URL || "https://jujasealndkvtugrscmj.supabase.co";
const LD_KEY = process.env.LD_SUPABASE_ANON_KEY;
const CRU_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CRU_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "assets";
const SLUG = "living-dungeon";

if (!LD_KEY) {
  console.error(
    "Set LD_SUPABASE_ANON_KEY in .env.local (the Living Dungeon project's public anon key —\n" +
      "copy it from living-dungeon-asset-forge/src/lib/supabase.js).",
  );
  process.exit(1);
}
if (!CRU_URL || !CRU_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  process.exit(1);
}

const ld = createClient(LD_URL, LD_KEY, { auth: { persistSession: false } });
const cru = createClient(CRU_URL, CRU_KEY, { auth: { persistSession: false } });

// ── extension → { format, contentType } ─────────────────────────────────────────
const EXT = {
  glb: { format: "model", ct: "model/gltf-binary" },
  gltf: { format: "model", ct: "model/gltf+json" },
  png: { format: "image", ct: "image/png" },
  jpg: { format: "image", ct: "image/jpeg" },
  jpeg: { format: "image", ct: "image/jpeg" },
  webp: { format: "image", ct: "image/webp" },
  gif: { format: "image", ct: "image/gif" },
  mp3: { format: "audio", ct: "audio/mpeg" },
  m4a: { format: "audio", ct: "audio/mp4" },
  mp4: { format: "audio", ct: "audio/mp4" }, // LD's audio table stores mp4/mp3 tracks
  wav: { format: "audio", ct: "audio/wav" },
  ogg: { format: "audio", ct: "audio/ogg" },
};

function extOf(url) {
  try {
    const p = new URL(url).pathname;
    const m = p.match(/\.([a-z0-9]+)$/i);
    return m ? m[1].toLowerCase() : "";
  } catch {
    return "";
  }
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

// Deterministic short hash of the source URL → stable Crucible path → idempotent re-runs.
async function hash8(s) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].slice(0, 4).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// LD asset_mode / type → a reference_assets.asset_type bucket.
function assetType(row) {
  const mode = String(row?.asset_mode || "").toLowerCase();
  const type = String(row?.type || "").toLowerCase();
  if (/ui|screen|pause|hud|menu/.test(type)) return "ui";
  if (mode === "enemy" || /enemy|boss|creature/.test(type)) return "creature";
  if (mode === "player" || /player|character|hero/.test(type)) return "character";
  if (/fx|effect|particle/.test(type)) return "fx";
  if (/prop|item|object/.test(type)) return "prop";
  return "other";
}

function labelFor(row, suffix) {
  const base = row?.name || row?.label || row?.title || row?.type || `LD ${String(row?.id ?? "").slice(0, 8)}`;
  return suffix ? `${base} ${suffix}` : String(base);
}

// The LD `assets` rows have no name — the only real identifier is the source filename.
// Derive a readable label from it (cleaned), tagging the render type (2d/3d) + kind.
function labelFromUrl(url, row, kindWord) {
  let stem = "";
  try {
    stem = decodeURIComponent(new URL(url).pathname.split("/").pop() || "").replace(/\.[a-z0-9]+$/i, "");
  } catch {
    /* keep empty */
  }
  const clean = stem.replace(/[-_]+/g, " ").trim();
  const t = row?.type ? `${row.type} ` : "";
  return (clean ? `${clean} (${kindWord})` : `LD ${t}${kindWord}`).slice(0, 80);
}

// ── resolve (or create) the Crucible project ────────────────────────────────────
async function resolveProject() {
  const { data, error } = await cru.from("projects").select("id, slug, name").eq("slug", SLUG).maybeSingle();
  if (error) throw new Error(`projects lookup: ${error.message}`);
  if (data) return data;
  if (DRY) {
    console.log(`(dry) project "${SLUG}" not found — would create it.`);
    return { id: "(new)", slug: SLUG, name: "Living Dungeon" };
  }
  const { data: created, error: insErr } = await cru
    .from("projects")
    .insert({ slug: SLUG, name: "Living Dungeon", kind: "game", status: "active" })
    .select("id, slug, name")
    .single();
  if (insErr) throw new Error(`create project: ${insErr.message}`);
  console.log(`created project "${SLUG}" (${created.id})`);
  return created;
}

// ── gather source items ──────────────────────────────────────────────────────────
async function gatherItems() {
  const items = []; // { url, format, assetType, label, tags }
  const push = (url, meta) => {
    if (url && typeof url === "string" && /^https?:\/\//.test(url)) items.push({ url, ...meta });
  };

  const { data: assets, error: aErr } = await ld.from("assets").select("*");
  if (aErr) throw new Error(`LD assets: ${aErr.message}`);
  for (const row of assets ?? []) {
    const at = assetType(row);
    const tags = [row?.type, row?.asset_mode, "living-dungeon"].filter(Boolean).map(String);
    if (row?.model_url) push(row.model_url, { format: "model", assetType: at, label: labelFromUrl(row.model_url, row, "model"), tags });
    if (row?.image_url) push(row.image_url, { format: "image", assetType: at, label: labelFromUrl(row.image_url, row, "sprite"), tags });
    if (IMAGES_ALL && Array.isArray(row?.images)) {
      for (const im of row.images) {
        const u = typeof im === "string" ? im : im?.url || im?.image_url;
        if (u && u !== row.image_url) push(u, { format: "image", assetType: at, label: labelFromUrl(u, row, "variant"), tags });
      }
    }
  }

  const { data: audio, error: auErr } = await ld.from("audio").select("id, name, url");
  if (auErr) console.warn(`LD audio table: ${auErr.message} (skipping audio)`);
  for (const row of audio ?? []) {
    push(row?.url, { format: "audio", assetType: "other", label: labelFor(row), tags: ["audio", "living-dungeon"] });
  }
  // Dedup by source URL — the LD `assets` table has multiple rows pointing at the same file.
  const seen = new Set();
  return items.filter((it) => (seen.has(it.url) ? false : (seen.add(it.url), true)));
}

// ── main ──────────────────────────────────────────────────────────────────────────
const project = await resolveProject();
const items = (await gatherItems()).slice(0, LIMIT === Infinity ? undefined : LIMIT);
console.log(`${DRY ? "[dry-run] " : ""}${items.length} source files for "${SLUG}" (project ${project.id})`);

// Existing reference_assets image_paths (skip re-imports).
const existing = new Set();
if (project.id !== "(new)") {
  const { data: refs } = await cru.from("reference_assets").select("image_path").eq("project_id", project.id);
  for (const r of refs ?? []) existing.add(r.image_path);
}

let ok = 0, skip = 0, fail = 0;
for (const it of items) {
  const ext = extOf(it.url) || (it.format === "model" ? "glb" : it.format === "audio" ? "mp3" : "png");
  const meta = EXT[ext] || { format: it.format, ct: "application/octet-stream" };
  const path = `${SLUG}/${slugify(it.label)}-${await hash8(it.url)}.${ext}`;
  const publicUrl = cru.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  if (existing.has(publicUrl)) { skip++; continue; }

  if (DRY) {
    console.log(`  would import  ${meta.format.padEnd(5)} ${it.assetType.padEnd(9)} ${it.label}`);
    ok++;
    continue;
  }

  try {
    const res = await fetch(it.url);
    if (!res.ok) throw new Error(`GET ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const up = await cru.storage.from(BUCKET).upload(path, bytes, { contentType: meta.ct, upsert: true });
    if (up.error) throw new Error(`upload: ${up.error.message}`);
    const ins = await cru.from("reference_assets").insert({
      project_id: project.id,
      asset_type: it.assetType,
      label: it.label,
      source: "external",
      format: meta.format,
      image_path: publicUrl,
      tags: it.tags,
      notes: `imported from Living Dungeon (${it.url})`,
    });
    if (ins.error) throw new Error(`insert: ${ins.error.message}`);
    console.log(`  ok  ${meta.format.padEnd(5)} ${it.label}`);
    ok++;
  } catch (err) {
    console.warn(`  FAIL ${it.label} — ${err.message}`);
    fail++;
  }
}

console.log(`\n${DRY ? "[dry-run] " : ""}done: ${ok} ${DRY ? "to import" : "imported"}, ${skip} already present, ${fail} failed.`);
if (DRY) console.log("Re-run with --run to copy the bytes + write reference_assets.");
