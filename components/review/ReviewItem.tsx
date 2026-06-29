"use client";

import { useActionState } from "react";
import { GLBViewer } from "@/components/viewer/GLBViewer";
import { approveAssetAction, rejectAssetAction } from "@/app/actions/review";
import type { ActionResult } from "@/app/actions/projects";
import type { Asset } from "@/lib/schema";

const btnBase =
  "min-h-11 flex-1 rounded-md px-4 font-medium focus-visible:outline " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60";

export function ReviewItem({ asset, title }: { asset: Asset; title: string }) {
  const [approveState, approve, approving] = useActionState<ActionResult | null, FormData>(
    approveAssetAction,
    null,
  );
  const [rejectState, reject, rejecting] = useActionState<ActionResult | null, FormData>(
    rejectAssetAction,
    null,
  );
  const error = approveState?.error ?? rejectState?.error;

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
      <GLBViewer url={asset.raw_path} label={`${title} — 3D preview`} />
      <div className="flex gap-2">
        <form action={approve} className="flex-1">
          <input type="hidden" name="assetId" value={asset.id} />
          <button
            type="submit"
            disabled={approving}
            className={`${btnBase} bg-emerald-500 text-zinc-950 hover:bg-emerald-400 focus-visible:outline-emerald-300`}
          >
            {approving ? "Approving…" : "Approve"}
          </button>
        </form>
        <form action={reject} className="flex-1">
          <input type="hidden" name="assetId" value={asset.id} />
          <button
            type="submit"
            disabled={rejecting}
            className={`${btnBase} border border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 focus-visible:outline-zinc-400`}
          >
            {rejecting ? "Rejecting…" : "Reject"}
          </button>
        </form>
      </div>
      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}
    </li>
  );
}
