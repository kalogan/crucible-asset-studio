"use client";

import Link from "next/link";
import { useActionState } from "react";
import { draftCanonAction, type DraftResult } from "@/app/actions/intake";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const inlineCanonLink =
  "rounded text-primary underline underline-offset-2 hover:opacity-80 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-sm font-medium text-foreground">{label}</h3>
      <p className="rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground whitespace-pre-wrap">
        {value.trim() ? value : <span className="text-muted-foreground">(none)</span>}
      </p>
    </div>
  );
}

function RuleList({ label, rules }: { label: string; rules: string[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-sm font-medium text-foreground">{label}</h3>
      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">(none)</p>
      ) : (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-foreground">
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
      <h3 className="text-sm font-medium text-foreground">Palette</h3>
      {hexes.length === 0 ? (
        <p className="text-sm text-muted-foreground">(none)</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {hexes.map((hex, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5"
            >
              <span
                aria-hidden
                className="h-5 w-5 rounded border border-border"
                style={{ backgroundColor: hex }}
              />
              <span className="font-mono text-xs text-foreground">{hex}</span>
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
        className="rounded-md border border-accent/30 bg-accent/5 p-3 text-sm text-accent"
      >
        Drafted. Review the fields below, then carry them into the Canon panel to save.
      </div>
      <h2 id="draft-heading" className="text-xl font-semibold text-foreground">
        Drafted canon
      </h2>
      <ReadOnlyField label="Prompt prefix" value={draft.prompt_prefix} />
      <ReadOnlyField label="Prompt suffix" value={draft.prompt_suffix} />
      <ReadOnlyField label="Negative prompt" value={draft.negative_prompt} />
      <RuleList label="Do rules" rules={draft.do_rules} />
      <RuleList label="Never rules" rules={draft.never_rules} />
      <Palette hexes={draft.palette_hexes} />
      <Button asChild className="w-fit">
        <Link href="/canon">Review &amp; save in Canon panel</Link>
      </Button>
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
          <Label htmlFor="text">Art-bible text</Label>
          <Textarea
            id="text"
            name="text"
            required
            rows={12}
            placeholder="Paste your game's art-bible text here…"
            className="resize-y"
          />
        </div>

        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "Drafting…" : "Draft canon"}
        </Button>
      </form>

      {state && !state.ok && state.error && (
        <div role="alert" className="flex flex-col gap-2">
          <p className="text-sm text-destructive">{state.error}</p>
          <p className="text-sm text-muted-foreground">
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
