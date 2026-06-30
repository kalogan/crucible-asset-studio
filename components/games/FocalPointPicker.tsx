"use client";

import { useActionState, useState } from "react";
import { setScreenshotFocalAction, type ActionResult } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Non-destructive hero framing: click the screenshot to set the focal point; the card/hero
 * frame around it via object-position. Live preview, then save (no re-upload, reversible).
 */
export function FocalPointPicker({
  projectId,
  slug,
  screenshot,
  focalX,
  focalY,
}: {
  projectId: string;
  slug: string;
  screenshot: string;
  focalX: number;
  focalY: number;
}) {
  const [x, setX] = useState(focalX);
  const [y, setY] = useState(focalY);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    setScreenshotFocalAction,
    null,
  );

  return (
    <div className="flex flex-col gap-2">
      <Label>Hero focus — click the image to choose what the card frames</Label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <button
          type="button"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setX(clamp01((e.clientX - r.left) / r.width));
            setY(clamp01((e.clientY - r.top) / r.height));
          }}
          className="relative w-full max-w-sm overflow-hidden rounded-md border border-border"
          aria-label="Set focal point"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={screenshot} alt="" className="block w-full" />
          <span
            className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-primary/30"
            style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
          />
        </button>

        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">Card preview</span>
          <div className="aspect-video w-44 overflow-hidden rounded-md border border-border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screenshot}
              alt=""
              className="h-full w-full object-cover"
              style={{ objectPosition: `${x * 100}% ${y * 100}%` }}
            />
          </div>
          <form action={action} className="flex items-center gap-2">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="focalX" value={x} />
            <input type="hidden" name="focalY" value={y} />
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save focus"}
            </Button>
            {state?.ok && <span className="text-xs text-primary">Saved.</span>}
            {state?.error && <span className="text-xs text-destructive">{state.error}</span>}
          </form>
        </div>
      </div>
    </div>
  );
}
