#!/usr/bin/env node
/**
 * auto-rig.mjs — headless auto-rig driver for GYRE's forge humanoids.
 *
 * Resolves the portable Blender in tools/, downloads the input GLB if a URL is
 * given, then shells out to scripts/rig/humanoid_rig.py to build a humanoid
 * armature, skin the mesh with automatic (heat) weights, author a CLIP set
 * (idle/cast/guard/strike/hit) and export a rigged + animated GLB.
 *
 * Usage:
 *   node scripts/auto-rig.mjs <input.glb-or-url> [--out <path>] [--render-dir <dir>]
 *
 * Examples:
 *   node scripts/auto-rig.mjs ./char.glb --out ./char.rigged.glb
 *   node scripts/auto-rig.mjs https://.../local.ld-player-85-26r.glb --out out.glb
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, createWriteStream, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, basename, extname } from "node:path";
import { tmpdir } from "node:os";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const RIG_PY = join(__dirname, "rig", "humanoid_rig.py");

function log(...a) {
  console.log("[auto-rig]", ...a);
}
function die(msg) {
  console.error("[auto-rig] ERROR:", msg);
  process.exit(1);
}

/** Find the portable Blender exe under tools/ (or unix `blender`). */
function resolveBlender() {
  const toolsDir = join(REPO, "tools");
  if (existsSync(toolsDir)) {
    for (const name of readdirSync(toolsDir)) {
      if (!name.startsWith("blender-")) continue;
      for (const exe of ["blender.exe", "blender"]) {
        const p = join(toolsDir, name, exe);
        if (existsSync(p)) return p;
      }
    }
  }
  return null;
}

/** Download a URL to a local temp file. */
async function download(url) {
  const outDir = join(tmpdir(), "crucible-autorig");
  mkdirSync(outDir, { recursive: true });
  let name = basename(new URL(url).pathname) || "input.glb";
  if (!extname(name)) name += ".glb";
  const dest = join(outDir, name);
  log("downloading", url, "->", dest);
  const res = await fetch(url);
  if (!res.ok) die(`download failed: HTTP ${res.status} ${res.statusText}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  log("downloaded", (statSync(dest).size / 1e6).toFixed(2), "MB");
  return dest;
}

function parseArgs(argv) {
  const args = { in: null, out: null, renderDir: null, pose: "adown" };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--out") args.out = rest[++i];
    else if (a === "--render-dir") args.renderDir = rest[++i];
    else if (a === "--pose") args.pose = rest[++i]; // adown (arms-down) | tpose
    else if (!a.startsWith("--") && !args.in) args.in = a;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.in) {
    die("usage: node scripts/auto-rig.mjs <input.glb-or-url> [--out <path>] [--render-dir <dir>]");
  }

  const blender = resolveBlender();
  if (!blender) {
    die(
      "no Blender found in tools/. Run `node scripts/setup-blender.mjs` first " +
        "(or `npm run setup-blender`)."
    );
  }
  log("blender:", blender);

  // resolve input (download if URL)
  const isUrl = /^https?:\/\//i.test(args.in);
  const inPath = isUrl ? await download(args.in) : resolve(args.in);
  if (!existsSync(inPath)) die(`input not found: ${inPath}`);
  log("input:", inPath);

  // default out: alongside input, "<name>.rigged.glb"
  const outPath = args.out
    ? resolve(args.out)
    : join(dirname(inPath), basename(inPath, extname(inPath)) + ".rigged.glb");
  log("output:", outPath);

  const pyArgs = ["--in", inPath, "--out", outPath, "--pose", args.pose];
  if (args.renderDir) {
    pyArgs.push("--render-dir", resolve(args.renderDir));
  }

  const blenderArgs = ["-b", "-P", RIG_PY, "--", ...pyArgs];
  log("running:", basename(blender), blenderArgs.join(" "));

  const res = spawnSync(blender, blenderArgs, {
    stdio: "inherit",
    cwd: REPO,
  });
  if (res.error) die(`failed to launch Blender: ${res.error.message}`);
  if (res.status !== 0) die(`Blender exited with code ${res.status}`);

  if (!existsSync(outPath)) die(`expected output not written: ${outPath}`);
  log("done ->", outPath, `(${(statSync(outPath).size / 1e6).toFixed(2)} MB)`);
  log("glTF clips: idle, cast, guard, strike, hit");
}

main().catch((e) => die(e.stack || String(e)));
