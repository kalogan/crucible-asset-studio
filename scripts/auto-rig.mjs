#!/usr/bin/env node
/**
 * auto-rig.mjs — headless auto-rig driver for GYRE's forge humanoids.
 *
 * Resolves the portable Blender in tools/, downloads the input GLB if a URL is
 * given, then shells out to scripts/rig/humanoid_rig.py to MEASURE the mesh,
 * build a humanoid armature fitted to it, skin it with geometric nearest-bone
 * rigid weights (robust for arbitrary/multi-island generated characters, where
 * heat weights fail), author a CLIP set (idle/cast/guard/strike/hit) and export
 * a rigged + animated GLB.
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
import { loadEnvLocal, ensureMeshUrl, rigWithUniRig, downloadTo } from "./rig/unirig.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const RIG_PY = join(__dirname, "rig", "humanoid_rig.py"); // legacy geometric skinner
const UNIRIG_CLIPS_PY = join(__dirname, "rig", "unirig_clips.py"); // clip-author on a UniRig rig

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
  // engine: "unirig" (default — ML skeleton+skin on Replicate, then world-space clips)
  //         | "geometric" (legacy in-Blender nearest-bone skinner)
  const args = { in: null, out: null, renderDir: null, pose: "adown", targetTris: 0, engine: "unirig" };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--out") args.out = rest[++i];
    else if (a === "--render-dir") args.renderDir = rest[++i];
    else if (a === "--pose") args.pose = rest[++i]; // adown (arms-down) | tpose (geometric only)
    else if (a === "--target-tris") args.targetTris = rest[++i]; // decimate budget (0 = off)
    else if (a === "--engine") args.engine = rest[++i]; // unirig | geometric
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
  log("engine:", args.engine);

  // Which Blender script + input mesh the clip-authoring step runs on:
  let clipPy = RIG_PY;
  let clipInput = inPath;

  if (args.engine === "unirig") {
    // 1) get a fetchable .glb URL, 2) UniRig (skeleton + skin) on Replicate,
    // 3) download the rigged mesh — then unirig_clips.py authors the clips below.
    loadEnvLocal();
    const meshUrl = isUrl ? await ensureMeshUrl(args.in, inPath) : await ensureMeshUrl(inPath, inPath);
    log("UniRig input mesh:", meshUrl);
    const riggedUrl = await rigWithUniRig(meshUrl, {
      onStatus: (s) => process.stdout.write(`\r[auto-rig] UniRig ${s}    `),
    });
    process.stdout.write("\n");
    const tmpRigged = join(tmpdir(), "crucible-autorig", basename(inPath, extname(inPath)) + ".unirig.glb");
    mkdirSync(dirname(tmpRigged), { recursive: true });
    await downloadTo(riggedUrl, tmpRigged);
    log("UniRig rigged mesh:", tmpRigged, `(${(statSync(tmpRigged).size / 1e6).toFixed(2)} MB)`);
    clipPy = UNIRIG_CLIPS_PY;
    clipInput = tmpRigged;
  } else if (args.engine !== "geometric") {
    die(`unknown --engine "${args.engine}" (use "unirig" or "geometric")`);
  }

  // Blender clip-authoring pass (both engines share the export step; only the input +
  // script differ). unirig_clips.py has no --pose (UniRig defines the rest pose).
  const pyArgs = ["--in", clipInput, "--out", outPath];
  if (args.engine === "geometric") pyArgs.push("--pose", args.pose);
  if (Number(args.targetTris) > 0) pyArgs.push("--target-tris", String(args.targetTris));
  if (args.renderDir) pyArgs.push("--render-dir", resolve(args.renderDir));

  const blenderArgs = ["-b", "-P", clipPy, "--", ...pyArgs];
  log("running:", basename(blender), basename(clipPy), pyArgs.join(" "));

  const res = spawnSync(blender, blenderArgs, {
    stdio: "inherit",
    cwd: REPO,
  });
  if (res.error) die(`failed to launch Blender: ${res.error.message}`);
  if (res.status !== 0) die(`Blender exited with code ${res.status}`);

  if (!existsSync(outPath)) die(`expected output not written: ${outPath}`);
  log("done ->", outPath, `(${(statSync(outPath).size / 1e6).toFixed(2)} MB)`);
  log("glTF clips: idle, walk, cast, guard, strike, hit");
}

main().catch((e) => die(e.stack || String(e)));
