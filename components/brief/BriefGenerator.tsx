"use client";

import { useActionState } from "react";
import Link from "next/link";
import { generateBriefAction, type BriefActionState } from "@/app/actions/brief";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

function scaffoldHref(picks: {
  name: string;
  target: string;
  systemIds: string[];
  identityToken: string;
}): string {
  const params = new URLSearchParams({
    name: picks.name,
    target: picks.target,
    systems: picks.systemIds.join(","),
    identity: picks.identityToken,
  });
  return `/kit/scaffold?${params.toString()}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

export function BriefGenerator() {
  const [state, formAction, pending] = useActionState<BriefActionState | null, FormData>(
    generateBriefAction,
    null,
  );
  const brief = state?.ok ? state.result?.brief : undefined;
  const picks = state?.ok ? state.result?.picks : undefined;

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your idea</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="idea">Game idea (one line is enough)</Label>
              <textarea
                id="idea"
                name="idea"
                rows={2}
                required
                placeholder="A cozy roguelike where you befriend a shopkeeper before the storm."
                className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">Constraints (optional)</Label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                placeholder="Solo dev, must run in the browser, multiplayer later."
                className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={pending}>
                {pending ? "Drafting brief…" : "Generate brief"}
              </Button>
              {state && !state.ok && (
                <span className="text-sm text-destructive">{state.error}</span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {brief && picks && (
        <section className="flex flex-col gap-4" aria-labelledby="brief-output">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="brief-output" className="font-serif text-2xl font-semibold">
              {brief.title}
            </h2>
            <Button asChild>
              <Link href={scaffoldHref(picks)}>Scaffold this →</Link>
            </Button>
          </div>

          <Card>
            <CardContent className="flex flex-col gap-5 pt-6">
              {brief.logline && <p className="text-base italic text-foreground">{brief.logline}</p>}

              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                {brief.genre && <Badge variant="outline">{brief.genre}</Badge>}
                {brief.perspective && <Badge variant="outline">{brief.perspective}</Badge>}
                <Badge variant="outline">target: {brief.target}</Badge>
              </div>

              {brief.pillars.length > 0 && (
                <Section title="Pillars">
                  <ul className="flex flex-wrap gap-2">
                    {brief.pillars.map((p) => (
                      <li key={p}>
                        <Badge>{p}</Badge>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {brief.coreLoop && (
                <Section title="Core loop">
                  <p className="text-sm text-foreground">{brief.coreLoop}</p>
                </Section>
              )}

              {brief.firstSlice && (
                <Section title="First slice (build this first)">
                  <p className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm text-foreground">
                    {brief.firstSlice}
                  </p>
                </Section>
              )}

              <Section title="Kit systems">
                {picks.systemIds.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {picks.systemIds.map((id) => (
                      <li key={id}>
                        <Badge variant="accent">{id}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No matching kit systems — start from a blank scaffold.
                  </p>
                )}
              </Section>

              {brief.npcs.length > 0 && (
                <Section title="NPCs">
                  <ul className="flex flex-col gap-1.5">
                    {brief.npcs.map((n, i) => (
                      <li key={`${n.name}-${i}`} className="text-sm text-foreground">
                        <span className="font-medium">{n.name || "(unnamed)"}</span>
                        {n.role && <span className="text-muted-foreground"> — {n.role}</span>}
                        {n.persona && (
                          <span className="text-muted-foreground"> · {n.persona}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {(brief.artDirection.mood ||
                brief.artDirection.palette.length > 0 ||
                brief.artDirection.references.length > 0) && (
                <Section title="Art direction">
                  <div className="flex flex-col gap-2">
                    {brief.artDirection.mood && (
                      <p className="text-sm text-foreground">{brief.artDirection.mood}</p>
                    )}
                    {brief.artDirection.palette.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        {brief.artDirection.palette.map((hex) => (
                          <span key={hex} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span
                              className="inline-block h-4 w-4 rounded border border-border"
                              style={{ backgroundColor: hex }}
                            />
                            {hex}
                          </span>
                        ))}
                      </div>
                    )}
                    {brief.artDirection.references.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Refs: {brief.artDirection.references.join(", ")}
                      </p>
                    )}
                  </div>
                </Section>
              )}

              {brief.risks.length > 0 && (
                <Section title="Risks">
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">
                    {brief.risks.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </Section>
              )}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
