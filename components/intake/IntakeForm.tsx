"use client";

import Link from "next/link";
import { useActionState } from "react";
import { draftCanonAction, type DraftResult } from "@/app/actions/intake";

const control =
  "rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-zinc-100 " +
  "placeholder:text-zinc-500 focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-amber-400";

const canonLink =
  "min-h-11 inline-flex w-fit items-center rounded-md bg-amber-500 px-5 font-medium " +
  "text-zinc-950 hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-amber-300";

const inlineCanonLink =
  "rounded text-amber-300 underline underline-offset-2 hover:text-amber-200 " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400";

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-sm font-medium text-zinc-300">{label}</h3>
      <p className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-sm text-zinc-100 whitespace-pre-wrap">
        {value.trim() ? value : <span className="text-zinc-500">(none)</span>}
      </p>
    </div>
  );
}

function RuleList({ label, rules }: { label: string; rules: string[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-sm font-medium text-zinc-300">{label}</h3>
      {rules.length === 0 ? (
        <p className="text-sm text-zinc-500">(none)</p>
      ) : (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-zinc-100">
          {rules.map((rule, i) => (
            <li key={i}>{rule}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Palette({ hexes }: { hexes: string[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-sm font-medium text-zinc-300">Palette</h3>
      {hexes.length === 0 ? (
        <p className="text-sm text-zinc-500">(none)</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {hexes.map((hex, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1.5"
            >
              <span
                aria-hidden
                className="h-5 w-5 rounded border border-zinc-700"
                style={{ backgroundColor: hex }}
              />
              <span className="font-mono text-xs text-zinc-200">{hex}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DraftResultView({ draft }: { draft: NonNullable<DraftResult["draft"]> }) {
  return (
    <section aria-labelledby="draft-heading" className="flex flex-col gap-4">
      <div
        role="status"
        className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-300"
      >
        Drafted. Review the fields below, then carry them into the Canon panel to save.
      </div>
      <h2 id="draft-heading" className="text-xl font-semibold text-zinc-50">
        Drafted canon
      </h2>
      <ReadOnlyField label="Prompt prefix" value={draft.prompt_prefix} />
      <ReadOnlyField label="Prompt suffix" value={draft.prompt_suffix} />
      <ReadOnlyField label="Negative prompt" value={draft.negative_prompt} />
      <RuleList label="Do rules" rules={draft.do_rules} />
      <RuleList label="Never rules" rules={draft.never_rules} />
      <Palette hexes={draft.palette_hexes} />
      <Link href="/canon" className={canonLink}>
        Review &amp; save in Canon panel
      </Link>
    </section>
  );
}

export function IntakeForm() {
  const [state, action, pending] = useActionState<DraftResult | null, FormData>(
    draftCanonAction,
    null,
  );

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="text" className="text-sm font-medium text-zinc-300">
            Art-bible text
          </label>
          <textarea
            id="text"
            name="text"
            required
            rows={12}
            placeholder="Paste your game's art-bible text here…"
            className={`${control} resize-y`}
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="min-h-11 w-fit rounded-md bg-amber-500 px-5 font-medium text-zinc-950 hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Drafting…" : "Draft canon"}
        </button>
      </form>

      {state && !state.ok && state.error && (
        <div role="alert" className="flex flex-col gap-2">
          <p className="text-sm text-rose-300">{state.error}</p>
          <p className="text-sm text-zinc-400">
            You can{" "}
            <Link href="/canon" className={inlineCanonLink}>
              hand-author in the Canon panel
            </Link>{" "}
            instead.
          </p>
        </div>
      )}

      {state?.ok && state.draft && <DraftResultView draft={state.draft} />}
    </div>
  );
}
