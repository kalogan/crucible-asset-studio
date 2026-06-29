"use client";

import { useActionState } from "react";
import { saveCanonAction } from "@/app/actions/canons";
import type { ActionResult } from "@/app/actions/projects";
import type { Canon } from "@/lib/schema";

const control =
  "min-h-11 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-zinc-100 " +
  "placeholder:text-zinc-500 focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-amber-400";
const button =
  "min-h-11 w-fit rounded-md bg-amber-500 px-5 font-medium text-zinc-950 " +
  "hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-amber-300 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

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

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium text-zinc-300">
          Canon name
        </label>
        <input
          id="name"
          name="name"
          defaultValue={canon?.name ?? ""}
          placeholder="e.g. Wayfinders canon"
          autoComplete="off"
          className={control}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="prompt_prefix" className="text-sm font-medium text-zinc-300">
          Prompt prefix
        </label>
        <textarea
          id="prompt_prefix"
          name="prompt_prefix"
          rows={2}
          defaultValue={canon?.prompt_prefix ?? ""}
          placeholder="Style cues prepended to every prompt"
          className={`${control} resize-y`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="prompt_suffix" className="text-sm font-medium text-zinc-300">
          Prompt suffix
        </label>
        <textarea
          id="prompt_suffix"
          name="prompt_suffix"
          rows={2}
          defaultValue={canon?.prompt_suffix ?? ""}
          placeholder="Appended to every prompt"
          className={`${control} resize-y`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="negative_prompt" className="text-sm font-medium text-zinc-300">
          Negative prompt
        </label>
        <textarea
          id="negative_prompt"
          name="negative_prompt"
          rows={2}
          defaultValue={canon?.negative_prompt ?? ""}
          placeholder="What to avoid"
          className={`${control} resize-y`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="palette" className="text-sm font-medium text-zinc-300">
          Palette
        </label>
        <input
          id="palette"
          name="palette"
          defaultValue={palette}
          placeholder="#ffb24d, #ff8c42"
          autoComplete="off"
          className={control}
        />
        <p className="text-xs text-zinc-500">Comma- or space-separated hex values.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="do_rules" className="text-sm font-medium text-zinc-300">
          Do rules
        </label>
        <textarea
          id="do_rules"
          name="do_rules"
          rows={4}
          defaultValue={doRules}
          placeholder="One rule per line"
          className={`${control} resize-y`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="never_rules" className="text-sm font-medium text-zinc-300">
          Never rules
        </label>
        <textarea
          id="never_rules"
          name="never_rules"
          rows={4}
          defaultValue={neverRules}
          placeholder="One rule per line"
          className={`${control} resize-y`}
        />
      </div>

      {(canon?.lora_trigger || canon) && (
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex gap-1.5">
            <dt className="text-zinc-500">LoRA trigger:</dt>
            <dd className="text-zinc-300">{canon?.lora_trigger ?? "—"}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-zinc-500">LoRA status:</dt>
            <dd className="text-zinc-300">{canon?.lora_status ?? "none"}</dd>
          </div>
        </dl>
      )}

      <button type="submit" disabled={pending} className={button}>
        {pending ? "Saving…" : "Save canon"}
      </button>

      {state?.error && (
        <p role="alert" className="text-sm text-rose-300">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm text-emerald-300">
          Canon saved.
        </p>
      )}
    </form>
  );
}
