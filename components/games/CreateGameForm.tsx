"use client";

import { useActionState } from "react";
import { createProjectAction, type ActionResult } from "@/app/actions/projects";
import { ProjectStatus } from "@/lib/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// Native <select> isn't a shared primitive yet; match Input's token styling by hand.
const selectControl =
  "min-h-11 rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CreateGameForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createProjectAction,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input id="name" name="name" required minLength={2} placeholder="e.g. Deception Station" autoComplete="off" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={2} placeholder="What is this?" className="resize-y" />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="kind">Kind</Label>
          <select id="kind" name="kind" defaultValue="game" className={selectControl}>
            <option value="game">Game</option>
            <option value="app">App</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status">Status</Label>
          <select id="status" name="status" defaultValue="prototype" className={selectControl}>
            {ProjectStatus.options.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="url">Play URL</Label>
          <Input id="url" name="url" placeholder="https://…" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="repo_url">Repo URL</Label>
        <Input id="repo_url" name="repo_url" placeholder="https://github.com/…" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="screenshot">Screenshot URL</Label>
        <Input id="screenshot" name="screenshot" placeholder="https://… (or upload one after creating)" />
        <p className="text-xs text-muted-foreground">Optional now — you can upload a screenshot on the next screen.</p>
      </div>

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Creating…" : "Create project"}
      </Button>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
