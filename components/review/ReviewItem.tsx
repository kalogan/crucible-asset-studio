"use client";

import { useActionState } from "react";
import { GLBViewer } from "@/components/viewer/GLBViewer";
import { approveAssetAction, rejectAssetAction, makeAsset3DAction } from "@/app/actions/review";
import type { ActionResult } from "@/app/actions/projects";
import type { Asset } from "@/lib/schema";

const btnBase =
  "min-h-11 flex-1 rounded-md px-4 font-medium focus-visible:outline " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60";
const emerald = "bg-emerald-500 text-zinc-950 hover:bg-emerald-400 focus-visible:outline-emerald-300";
const neutral =
  "border border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 focus-visible:outline-zinc-400";

export function ReviewItem({ asset, title }: { asset: Asset; title: string }) {
  const [makeState, makeAction, making] = useActionState<ActionResult | null, FormData>(
    makeAsset3DAction,
    null,
  );
  const [approveState, approve, approving] = useActionState<ActionResult | null, FormData>(
    approveAssetAction,
    null,
  );
  const [rejectState, reject, rejecting] = useActionState<ActionResult | null, FormData>(
    rejectAssetAction,
    null,
  );
  const error = makeState?.error ?? approveState?.error ?? rejectState?.error;
  const isImage = asset.kind === "image";

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
        <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
          {isImage ? "2D image" : "3D model"}
        </span>
      </div>

      {isImage ? (
        <figure className="flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset.raw_path ?? ""}
            alt={`${title}, isolated on a neutral background`}
            className="aspect-square w-full rounded-lg border border-zinc-800 bg-zinc-900 object-contain"
          />
          <figcaption className="text-xs text-zinc-400">
            Review the image — only make it 3D (≈$0.08) if you like it.
          </figcaption>
        </figure>
      ) : (
        <GLBViewer url={asset.raw_path} label={`${title} — 3D preview`} />
      )}

      <div className="flex gap-2">
        {isImage ? (
          <form action={makeAction} className="flex-1">
            <input type="hidden" name="assetId" value={asset.id} />
            <button type="submit" disabled={making} className={`${btnBase} ${emerald}`}>
              {making ? "Making 3D… (~2 min)" : "Approve → make 3D"}
            </button>
          </form>
        ) : (
          <form action={approve} className="flex-1">
            <input type="hidden" name="assetId" value={asset.id} />
            <button type="submit" disabled={approving} className={`${btnBase} ${emerald}`}>
              {approving ? "Approving…" : "Approve"}
            </button>
          </form>
        )}
        <form action={reject} className="flex-1">
          <input type="hidden" name="assetId" value={asset.id} />
          <button type="submit" disabled={rejecting} className={`${btnBase} ${neutral}`}>
            {rejecting ? "Rejecting…" : "Reject"}
          </button>
        </form>
      </div>

      {making && (
        <p role="status" className="text-sm text-amber-300">
          Building the 3D model — keep this tab open (~2 minutes).
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}
    </li>
  );
}
