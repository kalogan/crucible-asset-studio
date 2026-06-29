"use client";

import { useActionState } from "react";
import { seedCanonAction } from "@/app/actions/canons";
import type { ActionResult } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";

export function SeedCanonButton() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    seedCanonAction,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Seeding…" : "Seed canon from the art bible"}
      </Button>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm text-accent">
          Canon seeded from the art bible.
        </p>
      )}
    </form>
  );
}
