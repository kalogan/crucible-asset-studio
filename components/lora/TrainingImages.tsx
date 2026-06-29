"use client";

import { useActionState } from "react";
import {
  uploadTrainingImagesAction,
  removeTrainingImageAction,
} from "@/app/actions/lora";
import type { ActionResult } from "@/app/actions/projects";
import type { TrainingImage } from "@/lib/lora/storage";

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
        <h2 className="text-lg font-semibold text-zinc-100">LoRA training set</h2>
        <p className="text-sm text-zinc-400">
          Path A — upload ~15–40 neutral turntable renders (front / 3-4 / side / back, plain
          background, even lighting). Captioned as{" "}
          <code className="rounded bg-zinc-800 px-1 text-zinc-200">
            {triggerWord ?? "wyfndrstyle"}, &lt;content&gt;
          </code>{" "}
          for training.
        </p>
      </div>

      <form action={upload} className="flex flex-col gap-2">
        <label htmlFor="training-images" className="text-sm font-medium text-zinc-300">
          Add images
        </label>
        <input
          id="training-images"
          name="images"
          type="file"
          accept="image/*"
          multiple
          className="min-h-11 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 file:mr-3 file:rounded file:border-0 file:bg-amber-500 file:px-3 file:py-1.5 file:font-medium file:text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
        />
        <button
          type="submit"
          disabled={uploading}
          className="min-h-11 w-fit rounded-md bg-amber-500 px-5 font-medium text-zinc-950 hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:opacity-60"
        >
          {uploading ? "Uploading…" : "Upload images"}
        </button>
        {upState?.error && (
          <p role="alert" className="text-sm text-rose-300">
            {upState.error}
          </p>
        )}
        {rmState?.error && (
          <p role="alert" className="text-sm text-rose-300">
            {rmState.error}
          </p>
        )}
      </form>

      {images.length === 0 ? (
        <p className="text-sm text-zinc-500">No training images yet.</p>
      ) : (
        <>
          <p className="text-sm text-zinc-400">{images.length} image(s) in the set.</p>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {images.map((img) => (
              <li key={img.name} className="flex flex-col gap-1">
                <div className="aspect-square overflow-hidden rounded-md border border-zinc-800 bg-zinc-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.name} className="h-full w-full object-contain" />
                </div>
                <form action={remove}>
                  <input type="hidden" name="name" value={img.name} />
                  <button
                    type="submit"
                    className="w-full rounded text-xs text-zinc-400 underline underline-offset-2 hover:text-rose-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="rounded-md border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-400">
        Next: training runs on Replicate (~$2–4, ~15–25 min) once you’ve assembled the set and
        configured a destination model. Trigger word: <strong>{triggerWord ?? "—"}</strong>.
      </p>
    </section>
  );
}
