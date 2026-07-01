// Re-vendor game-kit: push Crucible's vendored game-kit source — the SOURCE OF TRUTH (it's
// what the scaffolder vendors new games from) — into an existing game's vendor/game-kit/src,
// so games pick up kit improvements instead of freezing a scaffold-time copy.
//
//   pnpm vendor-game-kit --to C:\Users\kevin\web-projects\gyre
//   pnpm vendor-game-kit --to ../gyre --dry     # list what would change, no writes
//
// NOTE on the 3-copy history: the canonical web-projects/game-kit repo is currently STALE — all
// kit work this session landed in THIS repo's vendored copy, and the scaffolder + this script both
// treat it as the source. Canonical should be synced FROM here (or retired) as a follow-up.
import { cp, rm, stat, readdir } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const toIdx = args.indexOf("--to");
const target = toIdx >= 0 ? args[toIdx + 1] : null;
if (!target) {
  console.error("Usage: pnpm vendor-game-kit --to <game-dir> [--dry]");
  process.exit(1);
}

const SRC = path.resolve("vendor/game-kit/src");
const DEST = path.resolve(target, "vendor/game-kit/src");

async function countFiles(dir) {
  let n = 0;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === "node_modules") continue;
    n += e.isDirectory() ? await countFiles(path.join(dir, e.name)) : 1;
  }
  return n;
}

try {
  await stat(SRC);
} catch {
  console.error(`Source not found: ${SRC} (run from the Crucible repo root).`);
  process.exit(1);
}
let destExists = true;
try {
  await stat(DEST);
} catch {
  destExists = false;
}

console.log(`re-vendor game-kit`);
console.log(`  from: ${SRC} (${await countFiles(SRC)} files)`);
console.log(`  to:   ${DEST}${destExists ? "" : "  (new)"}`);

if (dry) {
  console.log("\n[dry] no changes written. Re-run without --dry to sync.");
  process.exit(0);
}

// Replace the target's vendored src wholesale so renamed/removed kit files don't linger.
if (destExists) await rm(DEST, { recursive: true, force: true });
await cp(SRC, DEST, { recursive: true });
console.log(`\ndone: ${await countFiles(DEST)} files vendored into ${target}.`);
console.log("Rebuild the game (pnpm i if peer deps changed) to pick up the fresh kit.");
