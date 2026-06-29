"use client";

import { useActionState, useState } from "react";
import { createAssetSystemAction } from "@/app/actions/asset-systems";
import type { ActionResult } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SystemAssetOption {
  id: string;
  label: string;
  type: string;
}

/**
 * Group selected MODEL library assets into a new system. The checked asset ids
 * are serialized into a hidden `partsJson` field the server action reads.
 */
export function CreateSystemForm({ assets }: { assets: SystemAssetOption[] }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createAssetSystemAction,
    null,
  );
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const selectedIds = assets.map((a) => a.id).filter((id) => checked[id]);

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">System name</Label>
        <Input
          id="name"
          name="name"
          placeholder="e.g. Campfire"
          autoComplete="off"
          required
        />
      </div>

      <input type="hidden" name="partsJson" value={JSON.stringify(selectedIds)} />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-foreground">
          Assets ({selectedIds.length} selected)
        </legend>
        <ul className="flex flex-col gap-1.5">
          {assets.map((a) => {
            const inputId = `asset-${a.id}`;
            return (
              <li key={a.id} className="flex items-center gap-2">
                <input
                  id={inputId}
                  type="checkbox"
                  checked={!!checked[a.id]}
                  onChange={() => toggle(a.id)}
                  className="h-4 w-4 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Label htmlFor={inputId} className="flex-1 cursor-pointer font-normal">
                  <span className="text-foreground">{a.label}</span>
                  {a.type && (
                    <span className="text-muted-foreground"> · {a.type}</span>
                  )}
                </Label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <Button
        type="submit"
        disabled={pending || selectedIds.length === 0}
        className="w-fit"
      >
        {pending ? "Creating…" : "Create system"}
      </Button>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm text-accent">
          System created.
        </p>
      )}
    </form>
  );
}
