"use client";

import { useActionState } from "react";
import {
  uploadScreenshotAction,
  setScreenshotUrlAction,
  type ActionResult,
} from "@/app/actions/projects";
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
  const [upState, upAction, upPending] = useActionState<ActionResult | null, FormData>(
    uploadScreenshotAction,
    null,
  );
  const [urlState, urlAction, urlPending] = useActionState<ActionResult | null, FormData>(
    setScreenshotUrlAction,
    null,
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Upload a file */}
      <form action={upAction} className="flex flex-col gap-2">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="slug" value={slug} />
        <Label htmlFor="screenshot-file">Hero image — upload a file (hosted here)</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input id="screenshot-file" name="file" type="file" accept="image/*" className="w-auto" />
          <Button type="submit" variant="outline" disabled={upPending}>
            {upPending ? "Uploading…" : "Upload"}
          </Button>
        </div>
        {upState?.error && (
          <p role="alert" className="text-sm text-destructive">
            {upState.error}
          </p>
        )}
        {upState?.ok && (
          <p role="status" className="text-sm text-primary">
            Screenshot uploaded.
          </p>
        )}
      </form>

      {/* Or paste a URL */}
      <form action={urlAction} className="flex flex-col gap-2">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="slug" value={slug} />
        <Label htmlFor="screenshot-url">…or paste an image URL</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="screenshot-url"
            name="screenshotUrl"
            type="url"
            placeholder="https://… (hero image)"
            className="flex-1"
          />
          <Button type="submit" variant="outline" disabled={urlPending}>
            {urlPending ? "Saving…" : "Use URL"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Setting the hero here won&apos;t be overwritten by &ldquo;Save overview&rdquo;.
        </p>
        {urlState?.error && (
          <p role="alert" className="text-sm text-destructive">
            {urlState.error}
          </p>
        )}
        {urlState?.ok && (
          <p role="status" className="text-sm text-primary">
            Hero image set.
          </p>
        )}
      </form>
    </div>
  );
}
