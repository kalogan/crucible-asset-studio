"use client";

import { useActionState } from "react";
import { uploadScreenshotAction, type ActionResult } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ScreenshotUpload({
  projectId,
  slug,
}: {
  projectId: string;
  slug: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    uploadScreenshotAction,
    null,
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="slug" value={slug} />
      <Label htmlFor="screenshot-file">Upload a screenshot (hosted here)</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id="screenshot-file"
          name="file"
          type="file"
          accept="image/*"
          className="w-auto"
        />
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Uploading…" : "Upload"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Easiest path — no external hosting. Or paste a URL below.</p>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm text-primary">
          Screenshot uploaded.
        </p>
      )}
    </form>
  );
}
