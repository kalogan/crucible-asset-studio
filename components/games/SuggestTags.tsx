"use client";

import { useActionState } from "react";
import { suggestTagsFromRepoAction, type ActionResult } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";

/** One-click: derive tech + genres from the linked GitHub repo and save them. */
export function SuggestTags({ projectId, slug }: { projectId: string; slug: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    suggestTagsFromRepoAction,
    null,
  );
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="slug" value={slug} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Reading repo…" : "Suggest tech + genres from GitHub"}
      </Button>
      {state?.ok && (
        <span className="text-xs text-primary">Saved from the repo — reload to edit below.</span>
      )}
      {state?.error && <span className="text-xs text-destructive">{state.error}</span>}
    </form>
  );
}
