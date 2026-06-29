"use client";

import { useActionState } from "react";
import { saveCanonAction } from "@/app/actions/canons";
import type { ActionResult } from "@/app/actions/projects";
import type { Canon } from "@/lib/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Defensive readers — style_guide is jsonb (Record<string, unknown>). */
function stringArray(sg: Record<string, unknown>, key: string): string[] {
  const v = sg[key];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function paletteHexes(sg: Record<string, unknown>): string[] {
  const p = sg.palette;
  if (!p || typeof p !== "object") return [];
  const hexes = (p as Record<string, unknown>).hexes;
  if (!Array.isArray(hexes)) return [];
  return hexes.filter((x): x is string => typeof x === "string");
}

export function CanonForm({ canon }: { canon: Canon | null }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    saveCanonAction,
    null,
  );

  const sg: Record<string, unknown> = canon?.style_guide ?? {};
  const doRules = stringArray(sg, "do").join("\n");
  const neverRules = stringArray(sg, "never").join("\n");
  const palette = paletteHexes(sg).join(", ");
  const referenceImgs = Array.isArray(canon?.reference_imgs)
    ? canon.reference_imgs.filter((x): x is string => typeof x === "string").join("\n")
    : "";

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Canon name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={canon?.name ?? ""}
          placeholder="e.g. Wayfinders canon"
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prompt_prefix">Prompt prefix</Label>
        <Textarea
          id="prompt_prefix"
          name="prompt_prefix"
          rows={2}
          defaultValue={canon?.prompt_prefix ?? ""}
          placeholder="Style cues prepended to every prompt"
          className="resize-y"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prompt_suffix">Prompt suffix</Label>
        <Textarea
          id="prompt_suffix"
          name="prompt_suffix"
          rows={2}
          defaultValue={canon?.prompt_suffix ?? ""}
          placeholder="Appended to every prompt"
          className="resize-y"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="negative_prompt">Negative prompt</Label>
        <Textarea
          id="negative_prompt"
          name="negative_prompt"
          rows={2}
          defaultValue={canon?.negative_prompt ?? ""}
          placeholder="What to avoid"
          className="resize-y"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="palette">Palette</Label>
        <Input
          id="palette"
          name="palette"
          defaultValue={palette}
          placeholder="#ffb24d, #ff8c42"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">Comma- or space-separated hex values.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="do_rules">Do rules</Label>
        <Textarea
          id="do_rules"
          name="do_rules"
          rows={4}
          defaultValue={doRules}
          placeholder="One rule per line"
          className="resize-y"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="never_rules">Never rules</Label>
        <Textarea
          id="never_rules"
          name="never_rules"
          rows={4}
          defaultValue={neverRules}
          placeholder="One rule per line"
          className="resize-y"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reference_imgs">Reference image URLs</Label>
        <Textarea
          id="reference_imgs"
          name="reference_imgs"
          rows={3}
          defaultValue={referenceImgs}
          placeholder="https://… (one per line) — used as a style anchor by Nano Banana"
          className="resize-y"
        />
        <p className="text-xs text-muted-foreground">
          One image URL per line. Nano Banana conditions on these to match your game’s look.
        </p>
      </div>

      {(canon?.lora_trigger || canon) && (
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">LoRA trigger:</dt>
            <dd className="text-foreground">{canon?.lora_trigger ?? "—"}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">LoRA status:</dt>
            <dd className="text-foreground">{canon?.lora_status ?? "none"}</dd>
          </div>
        </dl>
      )}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Save canon"}
      </Button>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm text-accent">
          Canon saved.
        </p>
      )}
    </form>
  );
}
