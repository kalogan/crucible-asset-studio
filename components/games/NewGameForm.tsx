"use client";

import { useActionState } from "react";
import { createProjectAction, type ActionResult } from "@/app/actions/projects";

export function NewGameForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createProjectAction,
    null,
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="name" className="text-sm font-medium text-zinc-300">
        New game / project
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="name"
          name="name"
          required
          minLength={2}
          placeholder="e.g. Deception Station"
          autoComplete="off"
          className="min-h-11 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-zinc-100 placeholder:text-zinc-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-md bg-amber-500 px-4 font-medium text-zinc-950 hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create"}
        </button>
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-rose-300">
          {state.error}
        </p>
      )}
    </form>
  );
}
