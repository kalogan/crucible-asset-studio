"use client";

import { useActionState } from "react";
import { runBatchDryRunAction } from "@/app/actions/batch";
import type { ActionResult } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";

/**
 * Per-batch "Run (dry-run)" trigger. Drains the batch in MOCK mode ($0) — never a paid run.
 * Real spend is gated server-side behind CRUCIBLE_ALLOW_PAID_BATCH and is not exposed here.
 */
export function RunDryRunButton({ batchId }: { batchId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    runBatchDryRunAction,
    null,
  );

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="batchId" value={batchId} />
      <Button type="submit" variant="outline" disabled={pending} className="w-fit">
        {pending ? "Running…" : "Run (dry-run)"}
      </Button>
      {state?.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-xs text-accent">
          Dry-run complete ($0).
        </p>
      )}
    </form>
  );
}
