import { NextResponse } from "next/server";
import { runBatch } from "@/lib/pipeline/worker";

// Bearer-token-authed (matches /api/import): the token is the gate, not the origin.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: CORS });
}

export function OPTIONS(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * Trigger the resumable batch worker for a batch. Re-entrant: POSTing the same batchId again
 * resumes where it left off (succeeded jobs are skipped, never re-charged).
 *
 * Auth: `Authorization: Bearer <CRUCIBLE_IMPORT_TOKEN>`.
 * Body: { batchId, dryRun?, limit? }.
 *
 * COST GATE: dryRun defaults to true (mock, $0). A real (paid) run requires BOTH
 * `dryRun: false` in the body AND `CRUCIBLE_ALLOW_PAID_BATCH=1` in the env — so a real
 * generation can never be triggered by accident or by the request alone.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const token = process.env.CRUCIBLE_IMPORT_TOKEN;
  if (!token) return json({ error: "Batch worker not configured." }, 503);
  if (req.headers.get("authorization") !== `Bearer ${token}`) {
    return json({ error: "Unauthorized." }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }

  const batchId = String(body.batchId ?? "");
  if (!batchId) return json({ error: "Required: batchId." }, 400);
  const limit = typeof body.limit === "number" ? body.limit : undefined;

  // Default to mock. A real run needs the explicit flag AND the server-side env gate.
  const wantsPaid = body.dryRun === false;
  const paidAllowed = process.env.CRUCIBLE_ALLOW_PAID_BATCH === "1";
  if (wantsPaid && !paidAllowed) {
    return json(
      { error: "Paid batch runs are disabled. Set CRUCIBLE_ALLOW_PAID_BATCH=1 to enable." },
      403,
    );
  }
  const dryRun = !(wantsPaid && paidAllowed);

  try {
    const result = await runBatch(batchId, { dryRun, limit });
    return json({ ok: true, ...result });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Batch run failed." }, 500);
  }
}
