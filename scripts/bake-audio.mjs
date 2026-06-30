// Bake a procgen synth recipe to a WAV and store it as a `kind: "audio"` asset, by POSTing
// the local /api/bake-audio route on the running dev server. Baking is pure + free (no
// external/paid call), so there is no cost gate.
//
//   pnpm dev                                  # in another terminal
//   pnpm bake-audio <projectSlug>             # bakes the default "Coin Pickup" cue
//   pnpm bake-audio <projectSlug> "Door Open" # custom title
//
// Needs CRUCIBLE_IMPORT_TOKEN in .env.local (the route's bearer token). Override the target
// with CRUCIBLE_APP_URL (default http://localhost:3000).
const args = process.argv.slice(2);
const projectSlug = args[0];
const title = args[1];
if (!projectSlug) {
  console.error('Usage: pnpm bake-audio <projectSlug> ["Title"]');
  process.exit(1);
}

const token = process.env.CRUCIBLE_IMPORT_TOKEN;
if (!token) {
  console.error("Set CRUCIBLE_IMPORT_TOKEN in .env.local (the /api/bake-audio bearer token).");
  process.exit(1);
}

const base = process.env.CRUCIBLE_APP_URL || "http://localhost:3000";
const body = { projectSlug };
if (title) body.title = title;

console.log(`baking audio for "${projectSlug}" → ${base}/api/bake-audio`);

let res;
try {
  res = await fetch(`${base}/api/bake-audio`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
} catch (err) {
  console.error(`✗ could not reach ${base} — is \`pnpm dev\` running? (${err.message})`);
  process.exit(1);
}

const out = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`✗ HTTP ${res.status}:`, out.error ?? out);
  process.exit(1);
}

console.log(`✓ baked "${out.title}" → ${out.url}`);
