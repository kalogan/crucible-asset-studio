"use client";

import { useActionState } from "react";
import { updateProjectAction, type ActionResult } from "@/app/actions/projects";
import { ProjectStatus, type Project } from "@/lib/schema";

const control =
  "min-h-11 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 " +
  "placeholder:text-zinc-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400";

export function ProjectOverviewForm({ project }: { project: Project }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    updateProjectAction,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="projectId" value={project.id} />
      <input type="hidden" name="slug" value={project.slug} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium text-zinc-300">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={project.description ?? ""}
          placeholder="What is this game?"
          className={`${control} resize-y`}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-sm font-medium text-zinc-300">
            Status
          </label>
          <select id="status" name="status" defaultValue={project.status} className={control}>
            {ProjectStatus.options.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="url" className="text-sm font-medium text-zinc-300">
            Play URL
          </label>
          <input id="url" name="url" defaultValue={project.url ?? ""} placeholder="https://…" className={control} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="repo_url" className="text-sm font-medium text-zinc-300">
          Repo URL
        </label>
        <input id="repo_url" name="repo_url" defaultValue={project.repo_url ?? ""} placeholder="https://github.com/…" className={control} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="screenshot" className="text-sm font-medium text-zinc-300">
          Screenshot URL
        </label>
        <input id="screenshot" name="screenshot" defaultValue={project.screenshot ?? ""} placeholder="https://… (hero image)" className={control} />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-fit rounded-md bg-amber-500 px-5 font-medium text-zinc-950 hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save overview"}
      </button>
      {state?.error && (
        <p role="alert" className="text-sm text-rose-300">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm text-emerald-300">
          Saved.
        </p>
      )}
    </form>
  );
}
