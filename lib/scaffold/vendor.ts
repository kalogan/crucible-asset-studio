import "server-only";

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { ScaffoldFile } from "./generate";

/**
 * Read the vendored game-kit source (vendor/game-kit/src/**) as scaffold files so a
 * generated starter can carry the kit INLINE — the kit repo is private, so a `github:`
 * dependency wouldn't install. Server-only (filesystem). The starter aliases these via
 * its vite.config + tsconfig.
 */
export function vendorKitFiles(): ScaffoldFile[] {
  const root = join(process.cwd(), "vendor", "game-kit", "src");
  const out: ScaffoldFile[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (/\.tsx?$/.test(name)) {
        const rel = relative(root, full).split(/[\\/]/).join("/");
        out.push({ path: `vendor/game-kit/src/${rel}`, content: readFileSync(full, "utf8") });
      }
    }
  };
  walk(root);
  return out;
}
