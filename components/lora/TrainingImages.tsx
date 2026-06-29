"use client";

import { useActionState } from "react";
import {
  uploadTrainingImagesAction,
  removeTrainingImageAction,
} from "@/app/actions/lora";
import type { ActionResult } from "@/app/actions/projects";
import type { TrainingImage } from "@/lib/lora/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TrainingImages({
  images,
  triggerWord,
}: {
  images: TrainingImage[];
  triggerWord: string | null;
}) {
  const [upState, upload, uploading] = useActionState<ActionResult | null, FormData>(
    uploadTrainingImagesAction,
    null,
  );
  const [rmState, remove] = useActionState<ActionResult | null, FormData>(
    removeTrainingImageAction,
    null,
  );

  return (
    <section aria-label="LoRA training set" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">LoRA training set</h2>
        <p className="text-sm text-muted-foreground">
          Path A — upload ~15–40 neutral turntable renders (front / 3-4 / side / back, plain
          background, even lighting). Captioned as{" "}
          <code className="rounded bg-muted px-1 text-foreground">
            {triggerWord ?? "wyfndrstyle"}, &lt;content&gt;
          </code>{" "}
          for training.
        </p>
      </div>

      <form action={upload} className="flex flex-col gap-2">
        <Label htmlFor="training-images">Add images</Label>
        <Input
          id="training-images"
          name="images"
          type="file"
          accept="image/*"
          multiple
        />
        <Button type="submit" disabled={uploading} className="w-fit">
          {uploading ? "Uploading…" : "Upload images"}
        </Button>
        {upState?.error && (
          <p role="alert" className="text-sm text-destructive">
            {upState.error}
          </p>
        )}
        {rmState?.error && (
          <p role="alert" className="text-sm text-destructive">
            {rmState.error}
          </p>
        )}
      </form>

      {images.length === 0 ? (
        <p className="text-sm text-muted-foreground">No training images yet.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{images.length} image(s) in the set.</p>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {images.map((img) => (
              <li key={img.name} className="flex flex-col gap-1">
                <div className="aspect-square overflow-hidden rounded-md border border-border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.name} className="h-full w-full object-contain" />
                </div>
                <form action={remove}>
                  <input type="hidden" name="name" value={img.name} />
                  <Button type="submit" variant="destructive" size="sm" className="w-full">
                    Remove
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        Next: training runs on Replicate (~$2–4, ~15–25 min) once you’ve assembled the set and
        configured a destination model. Trigger word: <strong>{triggerWord ?? "—"}</strong>.
      </p>
    </section>
  );
}
