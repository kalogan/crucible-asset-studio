"use client";

import { useActionState } from "react";
import { runGenerateAction } from "@/app/actions/generate";
import type { ActionResult } from "@/app/actions/projects";

const control =
  "rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-zinc-100 " +
  "placeholder:text-zinc-500 focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-amber-400";

export function GenerateForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    runGenerateAction,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium text-zinc-300">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          minLength={2}
          placeholder="e.g. Wooden barrel"
          autoComplete="off"
          className={control}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="prompt" className="text-sm font-medium text-zinc-300">
          Prompt
        </label>
        <textarea
          id="prompt"
          name="prompt"
          required
          minLength={3}
          rows={3}
          placeholder="a simple wooden barrel"
          className={`${control} resize-y`}
        />
        <p className="text-xs text-zinc-500">
          Phase 1 is canon-free — no LoRA yet. We append “isolated object, neutral
          background” for a clean mesh.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        aria-describedby={pending ? "gen-status" : undefined}
        className="min-h-11 w-fit rounded-md bg-amber-500 px-5 font-medium text-zinc-950 hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Generating…" : "Generate"}
      </button>

      {pending && (
        <p id="gen-status" role="status" className="text-sm text-amber-300">
          Running FLUX → cutout → TRELLIS. This takes ~2 minutes — keep this tab open.
        </p>
      )}
      {state?.error && (
        <p role="alert" className="text-sm text-rose-300">
          {state.error}
        </p>
      )}
    </form>
  );
}
