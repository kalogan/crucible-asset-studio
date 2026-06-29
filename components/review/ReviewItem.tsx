"use client";

import { useActionState } from "react";
import { GLBViewer } from "@/components/viewer/GLBViewer";
import { approveAssetAction, rejectAssetAction, makeAsset3DAction } from "@/app/actions/review";
import type { ActionResult } from "@/app/actions/projects";
import type { Asset } from "@/lib/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <Badge variant="outline">{isImage ? "2D image" : "3D model"}</Badge>
      </div>

      {isImage ? (
        <figure className="flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset.raw_path ?? ""}
            alt={`${title}, isolated on a neutral background`}
            className="aspect-square w-full rounded-lg border border-border bg-muted object-contain"
          />
          <figcaption className="text-xs text-muted-foreground">
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
            <Button type="submit" disabled={making} className="w-full">
              {making ? "Making 3D… (~2 min)" : "Approve → make 3D"}
            </Button>
          </form>
        ) : (
          <form action={approve} className="flex-1">
            <input type="hidden" name="assetId" value={asset.id} />
            <Button type="submit" disabled={approving} className="w-full">
              {approving ? "Approving…" : "Approve"}
            </Button>
          </form>
        )}
        <form action={reject} className="flex-1">
          <input type="hidden" name="assetId" value={asset.id} />
          <Button type="submit" variant="destructive" disabled={rejecting} className="w-full">
            {rejecting ? "Rejecting…" : "Reject"}
          </Button>
        </form>
      </div>

      {making && (
        <p role="status" className="text-sm text-primary">
          Building the 3D model — keep this tab open (~2 minutes).
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}
