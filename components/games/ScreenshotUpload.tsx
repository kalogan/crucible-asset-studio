"use client";

import { useActionState } from "react";
import { uploadScreenshotAction, type ActionResult } from "@/app/actions/projects";

export function ScreenshotUpload({
  projectId,
  slug,
}: {
  projectId: string;
  slug: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    uploadScreenshotAction,
    null,
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="slug" value={slug} />
      <label htmlFor="screenshot-file" className="text-sm font-medium text-zinc-300">
        Upload a screenshot (hosted here)
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="screenshot-file"
          name="file"
          type="file"
          accept="image/*"
          className="min-h-11 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 file:mr-3 file:rounded file:border-0 file:bg-amber-500 file:px-3 file:py-1.5 file:font-medium file:text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-md border border-zinc-700 px-4 font-medium text-zinc-100 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:opacity-60"
        >
          {pending ? "Uploading…" : "Upload"}
        </button>
      </div>
      <p className="text-xs text-zinc-500">Easiest path — no external hosting. Or paste a URL below.</p>
      {state?.error && (
        <p role="alert" className="text-sm text-rose-300">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm text-emerald-300">
          Screenshot uploaded.
        </p>
      )}
    </form>
  );
}
