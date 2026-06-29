"use client";

import { useActionState } from "react";
import { seedCanonAction } from "@/app/actions/canons";
import type { ActionResult } from "@/app/actions/projects";

const button =
  "min-h-11 w-fit rounded-md bg-amber-500 px-5 font-medium text-zinc-950 " +
  "hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-amber-300 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export function SeedCanonButton() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    seedCanonAction,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Seeding…" : "Seed canon from the art bible"}
      </button>
      {state?.error && (
        <p role="alert" className="text-sm text-rose-300">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm text-emerald-300">
          Canon seeded from the art bible.
        </p>
      )}
    </form>
  );
}
