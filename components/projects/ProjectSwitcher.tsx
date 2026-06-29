"use client";

import { useActionState } from "react";
import {
  createProjectAction,
  setActiveProjectAction,
  type ActionResult,
} from "@/app/actions/projects";
import type { Project } from "@/lib/schema";

const control =
  "min-h-11 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-zinc-100 " +
  "placeholder:text-zinc-500 focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-amber-400";
const button =
  "min-h-11 rounded-md bg-amber-500 px-4 font-medium text-zinc-950 " +
  "hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-amber-300 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export function ProjectSwitcher({
  projects,
  activeId,
}: {
  projects: Project[];
  activeId: string | null;
}) {
  const [switchState, switchAction, switching] = useActionState<ActionResult | null, FormData>(
    setActiveProjectAction,
    null,
  );
  const [createState, createAction, creating] = useActionState<ActionResult | null, FormData>(
    createProjectAction,
    null,
  );

  return (
    <section aria-label="Project switcher" className="flex flex-col gap-6">
      {projects.length > 0 && (
        <form action={switchAction} className="flex flex-col gap-2">
          <label htmlFor="projectId" className="text-sm font-medium text-zinc-300">
            Active project
          </label>
          <div className="flex flex-wrap gap-2">
            <select
              id="projectId"
              name="projectId"
              defaultValue={activeId ?? ""}
              className={`${control} flex-1`}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.slug})
                </option>
              ))}
            </select>
            <button type="submit" className={button} disabled={switching}>
              {switching ? "Switching…" : "Switch"}
            </button>
          </div>
          {switchState?.error && (
            <p role="alert" className="text-sm text-rose-300">
              {switchState.error}
            </p>
          )}
        </form>
      )}

      <form action={createAction} className="flex flex-col gap-2">
        <label htmlFor="name" className="text-sm font-medium text-zinc-300">
          New project
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="name"
            name="name"
            required
            minLength={2}
            placeholder="e.g. Wayfinders"
            autoComplete="off"
            className={`${control} flex-1`}
          />
          <button type="submit" className={button} disabled={creating}>
            {creating ? "Creating…" : "Create"}
          </button>
        </div>
        {createState?.error && (
          <p role="alert" className="text-sm text-rose-300">
            {createState.error}
          </p>
        )}
      </form>
    </section>
  );
}
