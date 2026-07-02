"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  generateScaffold,
  TEMPLATES,
  type ScaffoldFile,
  type ScaffoldTarget,
  type ScaffoldTemplate,
} from "@/lib/scaffold/generate";
import { generateAppScaffold } from "@/lib/scaffold/generate-app";
import type { Tier } from "@/lib/kit/catalog";
import type { ProjectKind } from "@/lib/schema";

export type ScaffoldSystem = {
  id: string;
  name: string;
  tier: Tier;
  description: string;
  /** Kit family this piece belongs to — drives the kind filter. Defaults to "game". */
  kind?: ProjectKind;
};

const KIND_OPTIONS: readonly { value: ProjectKind; label: string }[] = [
  { value: "game", label: "Game kit" },
  { value: "app", label: "App kit" },
];

/**
 * MOVEMENT-GATED, default-OFF pieces (Track B5). These widen a safety firewall (they let
 * the model drive NPC movement), so they must NEVER be pre-selected — opting in has to be a
 * deliberate click, never an accident of "select all". Excluded from every default/select-all
 * set below; the user can still tick them on manually.
 */
const DEFAULT_OFF_SYSTEM_IDS: ReadonlySet<string> = new Set([
  "npc-reasoning-movement",
]);

/** All ids in `systems` for `kind`, minus the default-OFF (gated) pieces. */
function defaultSelectableIds(
  systems: readonly ScaffoldSystem[],
  kind: ProjectKind,
): string[] {
  return systems
    .filter((s) => (s.kind ?? "game") === kind && !DEFAULT_OFF_SYSTEM_IDS.has(s.id))
    .map((s) => s.id);
}

const TIER_LABELS: Record<Tier, string> = {
  atom: "Atoms",
  system: "Systems",
  kit: "Kits",
};

const TIER_ORDER: readonly Tier[] = ["atom", "system", "kit"];

/** Group the built systems by tier, preserving the incoming (sorted) order. */
function groupByTier(systems: readonly ScaffoldSystem[]) {
  return TIER_ORDER.map((tier) => ({
    tier,
    items: systems.filter((s) => s.tier === tier),
  })).filter((g) => g.items.length > 0);
}

/** Set of system ids that a given template implies (and pre-checks). */
function templateSystemIds(template: ScaffoldTemplate): ReadonlySet<string> {
  return new Set(TEMPLATES.find((t) => t.id === template)?.systemIds ?? []);
}

export function Scaffolder({
  systems,
  initialName,
  initialTarget,
  initialSystemIds,
  initialIdentityToken,
}: {
  systems: readonly ScaffoldSystem[];
  /** Prefill from the design brief (/brief → "Scaffold this"). */
  initialName?: string;
  initialTarget?: ScaffoldTarget;
  initialSystemIds?: readonly string[];
  /** Prefill the identity seed/token (/brief derives one from the title/mood). */
  initialIdentityToken?: string;
}) {
  // Kit family. Game-kit drives the runnable Vite generator; app-kit drives the
  // Next.js/Supabase app-starter generator (auth/layout/deploy).
  const [kind, setKind] = useState<ProjectKind>("game");
  const [name, setName] = useState(initialName || "My Game");
  const [target, setTarget] = useState<ScaffoldTarget>(initialTarget ?? "r3f");
  const [template, setTemplate] = useState<ScaffoldTemplate>("blank");
  // The anti-sameness knob: blank derives a token from the project name at
  // generate-time (see resolveIdentityToken) so it's still deterministic.
  const [identityToken, setIdentityToken] = useState(initialIdentityToken ?? "");
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => {
    // Prefilled picks (intersected with known systems) win; otherwise select all
    // of the initial family (game-kit) — app-kit pieces are added on family switch.
    if (initialSystemIds && initialSystemIds.length > 0) {
      // Honour an explicit prefill verbatim (the user/brief asked for these) — but a
      // gated piece is opt-in even here only if explicitly named.
      const known = new Set(systems.map((s) => s.id));
      return new Set(initialSystemIds.filter((id) => known.has(id)));
    }
    return new Set(defaultSelectableIds(systems, "game"));
  });
  const [files, setFiles] = useState<ScaffoldFile[] | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // The pieces visible for the active family (a piece with no kind is game-kit).
  const familySystems = useMemo(
    () => systems.filter((s) => (s.kind ?? "game") === kind),
    [systems, kind],
  );
  const groups = useMemo(() => groupByTier(familySystems), [familySystems]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Switching family resets to a free pick (all of that family's pieces) and
  // clears any prior output, since templates/targets are game-kit-only.
  const onKind = useCallback(
    (next: ProjectKind) => {
      setKind(next);
      setTemplate("blank");
      setFiles(null);
      setSelected(new Set(defaultSelectableIds(systems, next)));
    },
    [systems],
  );

  // Picking a template (other than blank) narrows the selection to exactly the
  // pieces it needs, so the preview matches what the template wires. "Blank"
  // restores the full set so you're back to a free pick.
  const onTemplate = useCallback(
    (next: ScaffoldTemplate) => {
      setTemplate(next);
      setSelected(
        next === "blank"
          ? new Set(
              familySystems
                .filter((s) => !DEFAULT_OFF_SYSTEM_IDS.has(s.id))
                .map((s) => s.id),
            )
          : templateSystemIds(next),
      );
    },
    [familySystems],
  );

  const onGenerate = useCallback(() => {
    if (kind === "app") {
      setFiles(
        generateAppScaffold({ name: name.trim() || "My App", moduleIds: [...selected] }),
      );
      return;
    }
    setFiles(
      generateScaffold({
        name: name.trim() || "My Game",
        target,
        template,
        systemIds: [...selected],
        identityToken,
      }),
    );
  }, [kind, name, target, template, selected, identityToken]);

  const onCopy = useCallback(async (file: ScaffoldFile) => {
    try {
      await navigator.clipboard.writeText(file.content);
      setCopiedPath(file.path);
      window.setTimeout(() => setCopiedPath(null), 1500);
    } catch {
      // Clipboard unavailable (insecure context / no permission) — no-op.
    }
  }, []);

  const onDownloadZip = useCallback(async () => {
    if (!files) return;
    const isApp = kind === "app";
    // Server builds the zip so it can include the vendored kit source (private kits).
    const res = await fetch(isApp ? "/api/scaffold-app" : "/api/scaffold", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        isApp
          ? { name: name.trim() || "My App", moduleIds: [...selected] }
          : {
              name: name.trim() || "My Game",
              target,
              template,
              systemIds: [...selected],
              identityToken,
            },
      ),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || (isApp ? "app" : "game");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [files, kind, name, target, template, selected, identityToken]);

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configure</CardTitle>
          <p className="text-sm text-muted-foreground">
            Name, starter target, and the kit pieces to wire in.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {/* Kit family — game-kit (three.js) vs app-kit (Next.js/React/Supabase). */}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-foreground">
              Kit family
            </legend>
            <div className="flex flex-wrap gap-4">
              {KIND_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
                >
                  <input
                    type="radio"
                    name="scaffold-kind"
                    value={opt.value}
                    checked={kind === opt.value}
                    onChange={() => onKind(opt.value)}
                    className="h-4 w-4 accent-primary"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="scaffold-name">Project name</Label>
            <Input
              id="scaffold-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Game"
              autoComplete="off"
            />
          </div>

          {/* Identity seed/token — game-kit only (the anti-sameness knob). */}
          {kind === "game" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scaffold-identity-token">
                Identity seed/token (optional)
              </Label>
              <Input
                id="scaffold-identity-token"
                value={identityToken}
                onChange={(e) => setIdentityToken(e.target.value)}
                placeholder="blank = derived from project name"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                One seed/token → one coherent palette + lighting + postfx + audio
                bundle, baked live into the generated{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  src/identity.ts
                </code>
                . Leave blank to derive it from the project name.
              </p>
            </div>
          )}

          {/* Template — game-kit only (the runnable Vite generator). */}
          {kind === "game" && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-foreground">
              Template
            </legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {TEMPLATES.map((t) => {
                const active = template === t.id;
                return (
                  <label
                    key={t.id}
                    className={`flex cursor-pointer flex-col gap-1 rounded-md border px-3 py-2 text-sm ${
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card"
                    }`}
                  >
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <input
                        type="radio"
                        name="scaffold-template"
                        value={t.id}
                        checked={active}
                        onChange={() => onTemplate(t.id)}
                        className="h-4 w-4 accent-primary"
                      />
                      {t.label}
                    </span>
                    <span className="text-xs leading-snug text-muted-foreground">
                      {t.description}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          )}

          {/* Target — game-kit only. */}
          {kind === "game" && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-foreground">
              Starter target
            </legend>
            <div className="flex flex-wrap gap-4">
              {(
                [
                  { value: "r3f", label: "React Three Fiber" },
                  { value: "vanilla", label: "Vanilla three.js" },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
                >
                  <input
                    type="radio"
                    name="scaffold-target"
                    value={opt.value}
                    checked={target === opt.value}
                    onChange={() => setTarget(opt.value)}
                    className="h-4 w-4 accent-primary"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>
          )}

          {/* Systems */}
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-foreground">
              Kit pieces ({selected.size} selected)
            </legend>
            <div className="flex flex-col gap-4">
              {groups.map((group) => (
                <div key={group.tier} className="flex flex-col gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {TIER_LABELS[group.tier]}
                  </span>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {group.items.map((sys) => {
                      const checked = selected.has(sys.id);
                      return (
                        <label
                          key={sys.id}
                          title={sys.description}
                          className="grid cursor-help grid-cols-[auto_1fr] items-start gap-x-2 gap-y-0.5 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(sys.id)}
                            className="row-span-2 mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
                          />
                          <span className="font-medium">{sys.name}</span>
                          <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                            {sys.description}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={onGenerate}>
              Generate scaffold
            </Button>
            {files && (
              <Button type="button" variant="outline" onClick={onDownloadZip}>
                Download .zip
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {files && (
        <section
          className="flex flex-col gap-4"
          aria-labelledby="scaffold-output"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2
              id="scaffold-output"
              className="font-serif text-lg font-semibold"
            >
              Generated files
            </h2>
            <Badge variant="outline" className="tabular-nums">
              {files.length} files
            </Badge>
          </div>

          <p className="text-sm text-muted-foreground">
            Download the{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">.zip</code>,
            then turn it into a GitHub repo with{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              sh create-repo.sh
            </code>{" "}
            (uses your local{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">gh</code> auth
            — no tokens). See the generated{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">README.md</code>.
          </p>

          {files.map((file) => (
            <Card key={file.path}>
              <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-sm font-medium">
                  <code>{file.path}</code>
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onCopy(file)}
                  aria-label={`Copy ${file.path}`}
                >
                  {copiedPath === file.path ? "Copied" : "Copy"}
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto rounded-md border border-border bg-muted p-3 text-xs leading-relaxed">
                  <code>{file.content}</code>
                </pre>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
