"use client";

import { useActionState } from "react";
import { enqueueBatchAction } from "@/app/actions/batch";
import type { ActionResult } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SpecOption {
  id: string;
  title: string;
  prompt: string;
}

/**
 * Producer form: name a batch, tick the specs to include, enqueue. Enqueue creates one
 * QUEUED job per spec (no spend) — the worker drains them later. useActionState mirrors
 * the canon/notes forms.
 */
export function EnqueueBatchForm({ specs }: { specs: SpecOption[] }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    enqueueBatchAction,
    null,
  );

  if (specs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No asset specs yet — generate an asset (which records a spec) and it’ll appear here to
        batch.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="batch-name">Batch name</Label>
        <Input
          id="batch-name"
          name="name"
          placeholder="e.g. Tavern props — first pass"
          autoComplete="off"
          required
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-foreground">
          Specs to include ({specs.length})
        </legend>
        <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto rounded-md border border-border p-2">
          {specs.map((s) => {
            const inputId = `spec-${s.id}`;
            return (
              <li key={s.id}>
                <label
                  htmlFor={inputId}
                  className="grid cursor-pointer grid-cols-[auto_1fr] items-start gap-x-3 gap-y-0.5 rounded-md px-2 py-1.5 hover:bg-muted"
                >
                  <input
                    id={inputId}
                    type="checkbox"
                    name="specIds"
                    value={s.id}
                    className="row-span-2 mt-1 size-4 shrink-0 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <span className="min-w-0 font-medium text-foreground">{s.title}</span>
                  <span className="line-clamp-1 text-xs text-muted-foreground">{s.prompt}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Enqueuing…" : "Enqueue batch"}
      </Button>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm text-accent">
          Batch enqueued — jobs are queued, nothing charged yet. Run a dry-run below.
        </p>
      )}
    </form>
  );
}
