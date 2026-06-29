"use client";

import { useActionState } from "react";
import { createProjectAction, type ActionResult } from "@/app/actions/projects";
import { ProjectStatus } from "@/lib/schema";

const control =
  "min-h-11 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 " +
  "placeholder:text-zinc-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400";

export function CreateGameForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createProjectAction,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium text-zinc-300">
          Name <span className="text-rose-400">*</span>
        </label>
        <input id="name" name="name" required minLength={2} placeholder="e.g. Deception Station" autoComplete="off" className={control} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium text-zinc-300">
          Description
        </label>
        <textarea id="description" name="description" rows={2} placeholder="What is this game?" className={`${control} resize-y`} />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-sm font-medium text-zinc-300">Status</label>
          <select id="status" name="status" defaultValue="prototype" className={control}>
            {ProjectStatus.options.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="url" className="text-sm font-medium text-zinc-300">Play URL</label>
          <input id="url" name="url" placeholder="https://…" className={control} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="repo_url" className="text-sm font-medium text-zinc-300">Repo URL</label>
        <input id="repo_url" name="repo_url" placeholder="https://github.com/…" className={control} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="screenshot" className="text-sm font-medium text-zinc-300">Screenshot URL</label>
        <input id="screenshot" name="screenshot" placeholder="https://… (or upload one after creating)" className={control} />
        <p className="text-xs text-zinc-500">Optional now — you can upload a screenshot on the next screen.</p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-fit rounded-md bg-amber-500 px-5 font-medium text-zinc-950 hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create game"}
      </button>
      {state?.error && (
        <p role="alert" className="text-sm text-rose-300">
          {state.error}
        </p>
      )}
    </form>
  );
}
