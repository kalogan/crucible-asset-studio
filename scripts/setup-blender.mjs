#!/usr/bin/env node
/**
 * setup-blender.mjs — reproducible, idempotent portable-Blender install.
 *
 * If a portable Blender already exists under tools/, does nothing. Otherwise
 * downloads the pinned Blender 4.2.22 LTS Windows build into tools/ and
 * extracts it, so the auto-rig toolchain is one command on a fresh machine.
 *
 * Usage:  node scripts/setup-blender.mjs
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  createWriteStream,
  statSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const TOOLS = join(REPO, "tools");

const BLENDER_VERSION = "4.2.22";
const ZIP_NAME = `blender-${BLENDER_VERSION}-windows-x64.zip`;
const DIR_NAME = `blender-${BLENDER_VERSION}-windows-x64`;
const URL = `https://download.blender.org/release/Blender4.2/${ZIP_NAME}`;

function log(...a) {
  console.log("[setup-blender]", ...a);
}
function die(msg) {
  console.error("[setup-blender] ERROR:", msg);
  process.exit(1);
}

/** Return the portable Blender exe path under tools/ if present, else null. */
function blenderPresent() {
  if (!existsSync(TOOLS)) return null;
  for (const name of readdirSync(TOOLS)) {
    if (!name.startsWith("blender-")) continue;
    for (const exe of ["blender.exe", "blender"]) {
      const p = join(TOOLS, name, exe);
      if (existsSync(p)) return p;
    }
  }
  return null;
}

async function download(url, dest) {
  log("downloading", url);
  const res = await fetch(url);
  if (!res.ok) die(`download failed: HTTP ${res.status} ${res.statusText}`);
  const total = Number(res.headers.get("content-length") || 0);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  const mb = (statSync(dest).size / 1e6).toFixed(1);
  log("downloaded", mb, "MB", total ? `(expected ${(total / 1e6).toFixed(1)} MB)` : "");
}

/** Extract a zip using PowerShell's Expand-Archive (present on Windows). */
function extractZip(zipPath, destDir) {
  log("extracting", zipPath, "->", destDir);
  // Prefer PowerShell on win32; fall back to `unzip` elsewhere.
  if (process.platform === "win32") {
    const ps = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${destDir}' -Force`,
      ],
      { stdio: "inherit" }
    );
    if (ps.status !== 0) die("Expand-Archive failed");
  } else {
    const uz = spawnSync("unzip", ["-o", zipPath, "-d", destDir], {
      stdio: "inherit",
    });
    if (uz.status !== 0) die("unzip failed");
  }
}

async function main() {
  const existing = blenderPresent();
  if (existing) {
    log("already installed:", existing, "(nothing to do)");
    return;
  }

  mkdirSync(TOOLS, { recursive: true });
  const zipPath = join(TOOLS, ZIP_NAME);

  if (!existsSync(zipPath)) {
    await download(URL, zipPath);
  } else {
    log("zip already downloaded:", zipPath);
  }

  extractZip(zipPath, TOOLS);

  const exe = join(TOOLS, DIR_NAME, "blender.exe");
  if (!existsSync(exe) && !existsSync(join(TOOLS, DIR_NAME, "blender"))) {
    die(`extraction did not produce ${exe}`);
  }
  log("installed ->", join(TOOLS, DIR_NAME));
  log("note: tools/ is gitignored — never commit it.");
}

main().catch((e) => die(e.stack || String(e)));
