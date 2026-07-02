/**
 * unirig.mjs — CLI-side UniRig helpers (upload → predict → download).
 *
 * This is the node/CLI twin of the server-only `lib/rig/unirig.ts` (which uses the
 * Next executor infra). Kept separate because `scripts/auto-rig.mjs` runs as a plain
 * ESM CLI outside Next and can't import the server module. Behaviour must stay in sync.
 */
import { readFileSync, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..", "..");

/** UniRig on Replicate — pinned (mirror of lib/executor/models.ts). */
export const UNIRIG_VERSION = "9ee496eafcc6ab9789a110a6357e43e5ee8b93cee9ab653bdc6f06a29341ee86";
const STORAGE_BUCKET = "assets";

/** Load KEY=VALUE lines from repo/.env.local into process.env (without clobbering). */
export function loadEnvLocal() {
  let text;
  try {
    text = readFileSync(join(REPO, ".env.local"), "utf8");
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim().replace(/^['"]|['"]$/g, "");
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

/**
 * Ensure `input` is a fetchable URL whose PATH ends in `.glb` (UniRig sniffs the file
 * type from the download filename — a Replicate files-API URL fails; a Supabase public
 * `.glb` URL works). If `input` is already such a URL, return it; otherwise upload the
 * local file to Supabase Storage under `_rigtmp/` and return its public URL.
 */
export async function ensureMeshUrl(input, localBytesPath) {
  if (/^https?:\/\//i.test(input) && /\.glb($|\?)/i.test(input)) return input;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "UniRig needs a public .glb URL. Set NEXT_PUBLIC_SUPABASE_URL + " +
        "SUPABASE_SERVICE_ROLE_KEY (in .env.local) so a local file can be uploaded.",
    );
  }
  const sb = createClient(url, key);
  const bytes = readFileSync(localBytesPath);
  // deterministic-ish path from the filename; upsert keeps re-runs idempotent
  const name = localBytesPath.split(/[\\/]/).pop().replace(/[^a-z0-9._-]/gi, "_");
  const path = `_rigtmp/${name.endsWith(".glb") ? name : name + ".glb"}`;
  const { error } = await sb.storage
    .from(STORAGE_BUCKET)
    .upload(path, bytes, { upsert: true, contentType: "model/gltf-binary" });
  if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  return sb.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Run UniRig on a mesh URL, poll to completion, return the rigged GLB URL. */
export async function rigWithUniRig(meshUrl, { onStatus } = {}) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN is not set (put it in .env.local).");
  const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const start = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: H,
    body: JSON.stringify({ version: UNIRIG_VERSION, input: { input_mesh: meshUrl } }),
  });
  if (!start.ok) throw new Error(`UniRig start failed ${start.status}: ${await start.text()}`);
  let pred = await start.json();

  const deadline = Date.now() + 15 * 60 * 1000;
  while (!["succeeded", "failed", "canceled"].includes(pred.status)) {
    if (Date.now() > deadline) throw new Error("UniRig timed out");
    await new Promise((r) => setTimeout(r, 4000));
    const res = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    pred = await res.json();
    onStatus?.(pred.status);
  }
  if (pred.status !== "succeeded") throw new Error(pred.error || "UniRig failed");
  const out = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  if (!out) throw new Error("UniRig returned no output URL");
  return out;
}

/** Download a URL to a local path. */
export async function downloadTo(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  return dest;
}
