"use client";

import { useActionState } from "react";
import { importProjectFromGithubAction } from "@/app/actions/projects";
import type { ActionResult } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Import a game as a project straight from its GitHub repo — auto-fills
 * name/description/url from the repo metadata. Public repos work as-is; private
 * repos need GITHUB_TOKEN set on the server.
 */
export function GithubImportForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    importProjectFromGithubAction,
    null,
  );

  return (
    <section
      aria-labelledby="gh-import-heading"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 id="gh-import-heading" className="font-serif text-lg text-foreground">
          Import from GitHub
        </h2>
        <p className="text-sm text-muted-foreground">
          Paste a repo URL (or <code className="rounded bg-muted px-1 py-0.5">owner/repo</code>) —
          Crucible reads its metadata and fills the rest.
        </p>
      </div>
      <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="repoUrl">Repository</Label>
          <Input
            id="repoUrl"
            name="repoUrl"
            required
            placeholder="https://github.com/kalogan/meteor"
            autoComplete="off"
          />
        </div>
        <Button type="submit" disabled={pending} className="shrink-0">
          {pending ? "Importing…" : "Import"}
        </Button>
      </form>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </section>
  );
}
