"use client";

import { useActionState } from "react";
import { updateProjectAction, type ActionResult } from "@/app/actions/projects";
import { ProjectStatus, type Project } from "@/lib/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// Native <select> isn't a shared primitive yet; match Input's token styling by hand.
const selectControl =
  "min-h-11 rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={project.description ?? ""}
          placeholder="What is this game?"
          className="resize-y"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status">Status</Label>
          <select id="status" name="status" defaultValue={project.status} className={selectControl}>
            {ProjectStatus.options.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="url">Play URL</Label>
          <Input id="url" name="url" defaultValue={project.url ?? ""} placeholder="https://…" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="repo_url">Repo URL</Label>
        <Input id="repo_url" name="repo_url" defaultValue={project.repo_url ?? ""} placeholder="https://github.com/…" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="screenshot">Screenshot URL</Label>
        <Input id="screenshot" name="screenshot" defaultValue={project.screenshot ?? ""} placeholder="https://… (hero image)" />
      </div>

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Save overview"}
      </Button>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm text-primary">
          Saved.
        </p>
      )}
    </form>
  );
}
