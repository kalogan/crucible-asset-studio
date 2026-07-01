"use client";

import { useActionState, useEffect, useState } from "react";
import {
  runGenerateAction,
  getGenerationStatus,
  type GenerationStatus,
} from "@/app/actions/generate";
import type { ActionResult } from "@/app/actions/projects";
import { ASSET_TYPE_OPTIONS } from "@/lib/canon/framing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// <select> has no shared primitive — mirror the Input primitive's token classes.
const selectControl =
  "min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Mode = "image" | "model";

const ALL_PHASES: { key: GenerationStatus["phase"]; label: string }[] = [
  { key: "image", label: "Generating image (FLUX)" },
  { key: "cutout", label: "Removing background" },
  { key: "model", label: "Building 3D model (TRELLIS)" },
  { key: "saving", label: "Saving" },
];

function phasesFor(mode: Mode) {
  return mode === "image"
    ? ALL_PHASES.filter((p) => p.key === "image" || p.key === "saving")
    : ALL_PHASES;
}

function StageIndicator({
  phase,
  seconds,
  mode,
}: {
  phase: GenerationStatus["phase"] | null;
  seconds: number;
  mode: Mode;
}) {
  const phases = phasesFor(mode);
  const activeIdx = phase ? phases.findIndex((p) => p.key === phase) : 0;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-2 rounded-md border border-primary/30 bg-primary/5 p-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-primary">Generating…</span>
        <span className="font-mono text-xs text-muted-foreground">{seconds}s</span>
      </div>
      <ol className="flex flex-col gap-1.5">
        {phases.map((p, i) => {
          const state = i < activeIdx ? "done" : i === activeIdx ? "active" : "pending";
          return (
            <li key={p.key} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden
                className={
                  state === "done"
                    ? "text-accent"
                    : state === "active"
                      ? "text-primary"
                      : "text-muted-foreground"
                }
              >
                {state === "done" ? "✓" : state === "active" ? "◌" : "○"}
              </span>
              <span
                className={
                  state === "done"
                    ? "text-muted-foreground line-through"
                    : state === "active"
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                }
              >
                {p.label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted-foreground">
        {mode === "image" ? "~20 seconds" : "~2 minutes total"} — keep this tab open.
      </p>
    </div>
  );
}

export function GenerateForm({
  initialTitle = "",
  initialPrompt = "",
}: {
  initialTitle?: string;
  initialPrompt?: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    runGenerateAction,
    null,
  );
  const [mode, setMode] = useState<Mode>("image");
  const [assetType, setAssetType] = useState("prop");
  // Poll the SERVER's in-flight status (not just this form's `pending`), so the
  // indicator shows — and the submit stays disabled — whenever a generation is
  // running: one you started with a prior click, from another tab, or that
  // outlived a reload. This is what fixes "no feedback, so I clicked again".
  const [serverStatus, setServerStatus] = useState<GenerationStatus | null>(null);
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const s = await getGenerationStatus();
        if (alive) setServerStatus(s);
      } catch {
        // transient — keep last known status
      }
    };
    void poll();
    const id = setInterval(poll, 2500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pending]);

  const busy = pending || serverStatus !== null;
  // The 3D phases only apply once a run reaches cutout/model; otherwise mirror the
  // form's selected mode for the phase list.
  const activeMode: Mode =
    serverStatus?.phase === "cutout" || serverStatus?.phase === "model" ? "model" : mode;
  const seconds = serverStatus ? Math.floor(serverStatus.elapsedMs / 1000) : 0;

  const radio =
    "flex flex-1 cursor-pointer flex-col gap-1 rounded-md border p-3 text-sm " +
    "focus-within:outline-none focus-within:ring-2 focus-within:ring-ring";

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          minLength={2}
          defaultValue={initialTitle}
          placeholder="e.g. Wooden barrel"
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prompt">Prompt</Label>
        <Textarea
          id="prompt"
          name="prompt"
          required
          minLength={3}
          rows={3}
          defaultValue={initialPrompt}
          placeholder="a simple wooden barrel"
          className="resize-y"
        />
        <p className="text-xs text-muted-foreground">
          Describe the subject — the project canon supplies the style.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="assetType">Asset type</Label>
          <select
            id="assetType"
            name="assetType"
            value={assetType}
            onChange={(e) => setAssetType(e.target.value)}
            className={selectControl}
          >
            {ASSET_TYPE_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            {assetType === "character-tpose"
              ? "Full-body T-pose → promote to 3D → auto-rigs cleanly."
              : "Supplies the format (canon supplies the style)."}
          </p>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="provider">Image model</Label>
          <select id="provider" name="provider" defaultValue="flux" className={selectControl}>
            <option value="flux">FLUX (Replicate)</option>
            <option value="nanobanana">Nano Banana (Gemini)</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Nano Banana uses the canon’s reference images as a style anchor (needs GEMINI_API_KEY).
          </p>
        </div>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm font-medium text-foreground">Output</legend>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label
            htmlFor="mode-image"
            className={`${radio} ${mode === "image" ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <span className="flex items-center gap-2">
              <input
                type="radio"
                id="mode-image"
                name="mode"
                value="image"
                checked={mode === "image"}
                onChange={() => setMode("image")}
                className="accent-primary"
              />
              <span className="font-medium text-foreground">Image only (~$0.003)</span>
            </span>
            <span className="pl-6 text-xs text-muted-foreground">
              Review the 2D image first, then make it 3D if you like it.
            </span>
          </label>
          <label
            htmlFor="mode-model"
            className={`${radio} ${mode === "model" ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <span className="flex items-center gap-2">
              <input
                type="radio"
                id="mode-model"
                name="mode"
                value="model"
                checked={mode === "model"}
                onChange={() => setMode("model")}
                className="accent-primary"
              />
              <span className="font-medium text-foreground">Straight to 3D (~$0.09)</span>
            </span>
            <span className="pl-6 text-xs text-muted-foreground">
              FLUX → TRELLIS in one pass. Skips the 2D review.
            </span>
          </label>
        </div>
      </fieldset>

      <Button type="submit" disabled={busy} className="w-fit px-5">
        {busy ? "Generating…" : mode === "image" ? "Generate image" : "Generate 3D"}
      </Button>

      {busy && (
        <StageIndicator phase={serverStatus?.phase ?? null} seconds={seconds} mode={activeMode} />
      )}
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
