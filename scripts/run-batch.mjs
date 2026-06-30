// Trigger (or resume) the resumable batch worker for a batch, by POSTing the local
// /api/batch route on the running dev server. Re-entrant: re-running the same batch picks
// up where it left off (succeeded jobs are skipped, never re-charged).
//
//   pnpm dev                                   # in another terminal
//   pnpm run-batch <batchId>                   # DRY-RUN (mock, $0) — the default
//   pnpm run-batch <batchId> --limit 5         # only run the next 5 queued jobs
//   pnpm run-batch <batchId> --paid            # REAL spend — also needs the server env gate
//
// A real (paid) run requires BOTH `--paid` here AND CRUCIBLE_ALLOW_PAID_BATCH=1 in the
// server's env — by design you cannot trigger real generation by accident.
//
// Needs CRUCIBLE_IMPORT_TOKEN in .env.local (the route's bearer token). Override the target
// with CRUCIBLE_APP_URL (default http://localhost:3000).
const args = process.argv.slice(2);
const batchId = args.find((a) => !a.startsWith("--"));
if (!batchId) {
  console.error("Usage: pnpm run-batch <batchId> [--limit N] [--paid]");
  process.exit(1);
}

const token = process.env.CRUCIBLE_IMPORT_TOKEN;
if (!token) {
  console.error("Set CRUCIBLE_IMPORT_TOKEN in .env.local (the /api/batch bearer token).");
  process.exit(1);
}

const base = process.env.CRUCIBLE_APP_URL || "http://localhost:3000";
const paid = args.includes("--paid");
const limitFlag = args.indexOf("--limit");
const limit = limitFlag >= 0 ? Number(args[limitFlag + 1]) : undefined;

const body = { batchId, dryRun: !paid };
if (Number.isFinite(limit)) body.limit = limit;

console.log(`${paid ? "PAID" : "dry-run"} batch ${batchId} → ${base}/api/batch`);

let res;
try {
  res = await fetch(`${base}/api/batch`, {
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

console.log(
  `✓ ${out.dryRun ? "[mock] " : ""}${out.succeeded}/${out.total} succeeded, ` +
    `${out.failed} failed, ${out.skipped} skipped · cost $${Number(out.costActual ?? 0).toFixed(4)}`,
);
