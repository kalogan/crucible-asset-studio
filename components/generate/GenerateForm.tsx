"use client";

import { useActionState, useEffect, useState } from "react";
import {
  runGenerateAction,
  getGenerationStatus,
  type GenerationStatus,
} from "@/app/actions/generate";
import type { ActionResult } from "@/app/actions/projects";

const control =
  "rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-zinc-100 " +
  "placeholder:text-zinc-500 focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-amber-400";

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
      className="flex flex-col gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-amber-300">Generating…</span>
        <span className="font-mono text-xs text-zinc-400">{seconds}s</span>
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
                    ? "text-emerald-400"
                    : state === "active"
                      ? "text-amber-300"
                      : "text-zinc-600"
                }
              >
                {state === "done" ? "✓" : state === "active" ? "◌" : "○"}
              </span>
              <span
                className={
                  state === "done"
                    ? "text-zinc-400 line-through"
                    : state === "active"
                      ? "font-medium text-zinc-100"
                      : "text-zinc-500"
                }
              >
                {p.label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-zinc-500">
        {mode === "image" ? "~20 seconds" : "~2 minutes total"} — keep this tab open.
      </p>
    </div>
  );
}

export function GenerateForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    runGenerateAction,
    null,
  );
  const [mode, setMode] = useState<Mode>("image");
  const [phase, setPhase] = useState<GenerationStatus["phase"] | null>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!pending) {
      setPhase(null);
      setSeconds(0);
      return;
    }
    const started = Date.now();
    const tick = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    const poll = setInterval(async () => {
      try {
        const s = await getGenerationStatus();
        if (s) setPhase(s.phase);
      } catch {
        // transient — keep last known phase
      }
    }, 2500);
    void getGenerationStatus().then((s) => s && setPhase(s.phase));
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [pending]);

  const radio =
    "flex flex-1 cursor-pointer flex-col gap-1 rounded-md border p-3 text-sm " +
    "focus-within:outline focus-within:outline-2 focus-within:outline-amber-400";

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium text-zinc-300">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          minLength={2}
          placeholder="e.g. Wooden barrel"
          autoComplete="off"
          className={control}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="prompt" className="text-sm font-medium text-zinc-300">
          Prompt
        </label>
        <textarea
          id="prompt"
          name="prompt"
          required
          minLength={3}
          rows={3}
          placeholder="a simple wooden barrel"
          className={`${control} resize-y`}
        />
        <p className="text-xs text-zinc-500">
          Describe the subject — the project canon supplies the style.
        </p>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm font-medium text-zinc-300">Output</legend>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label
            htmlFor="mode-image"
            className={`${radio} ${mode === "image" ? "border-amber-500 bg-amber-500/5" : "border-zinc-700"}`}
          >
            <span className="flex items-center gap-2">
              <input
                type="radio"
                id="mode-image"
                name="mode"
                value="image"
                checked={mode === "image"}
                onChange={() => setMode("image")}
                className="accent-amber-500"
              />
              <span className="font-medium text-zinc-100">Image only (~$0.003)</span>
            </span>
            <span className="pl-6 text-xs text-zinc-400">
              Review the 2D image first, then make it 3D if you like it.
            </span>
          </label>
          <label
            htmlFor="mode-model"
            className={`${radio} ${mode === "model" ? "border-amber-500 bg-amber-500/5" : "border-zinc-700"}`}
          >
            <span className="flex items-center gap-2">
              <input
                type="radio"
                id="mode-model"
                name="mode"
                value="model"
                checked={mode === "model"}
                onChange={() => setMode("model")}
                className="accent-amber-500"
              />
              <span className="font-medium text-zinc-100">Straight to 3D (~$0.09)</span>
            </span>
            <span className="pl-6 text-xs text-zinc-400">
              FLUX → TRELLIS in one pass. Skips the 2D review.
            </span>
          </label>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-fit rounded-md bg-amber-500 px-5 font-medium text-zinc-950 hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Generating…" : mode === "image" ? "Generate image" : "Generate 3D"}
      </button>

      {pending && <StageIndicator phase={phase} seconds={seconds} mode={mode} />}
      {state?.error && (
        <p role="alert" className="text-sm text-rose-300">
          {state.error}
        </p>
      )}
    </form>
  );
}
