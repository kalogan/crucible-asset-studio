"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  runForgeGenerateAction,
  buildForgePrompt,
  getGenerationStatus,
  type GenerationStatus,
} from "@/app/actions/generate";
import type { ActionResult } from "@/app/actions/projects";
import {
  PLAYER_MUTATIONS,
  PLAYER_VARIANTS,
  POSES,
  DEFAULT_MUTATION,
  DEFAULT_VARIANT,
  DEFAULT_POSE,
} from "@/lib/generate/living-dungeon-forge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// Mirror GenerateForm's <select> token classes (no shared primitive).
const selectControl =
  "min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Mode = "image" | "model";
type ForgeMode = "player" | "enemy";

export function LivingDungeonForgeForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    runForgeGenerateAction,
    null,
  );

  const [forgeMode, setForgeMode] = useState<ForgeMode>("player");
  const [mutationId, setMutationId] = useState(DEFAULT_MUTATION.id);
  const [variantId, setVariantId] = useState(DEFAULT_VARIANT.id);
  const [poseId, setPoseId] = useState(DEFAULT_POSE.id);
  const [description, setDescription] = useState("");
  const [forgePrompt, setForgePrompt] = useState("");
  const [buildError, setBuildError] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [mode, setMode] = useState<Mode>("image");
  const [building, startBuild] = useTransition();

  // Poll server in-flight status so the Generate button stays disabled while a run
  // is active (mirrors GenerateForm's guard against double-submits).
  const [serverStatus, setServerStatus] = useState<GenerationStatus | null>(null);
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const s = await getGenerationStatus();
        if (alive) setServerStatus(s);
      } catch {
        // transient
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

  function onBuild() {
    setBuildError(null);
    startBuild(async () => {
      const res = await buildForgePrompt({
        mode: forgeMode,
        poseId,
        mutationId,
        variantId,
        description,
      });
      if (!res.ok || !res.prompt) {
        setBuildError(res.error ?? "Could not build the prompt.");
        return;
      }
      setForgePrompt(res.prompt);
      setUsedFallback(Boolean(res.fallback));
    });
  }

  const radio =
    "flex flex-1 cursor-pointer flex-col gap-1 rounded-md border p-3 text-sm " +
    "focus-within:outline-none focus-within:ring-2 focus-within:ring-ring";

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-accent/30 bg-accent/5 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">Living Dungeon forge</h2>
        <p className="text-xs text-muted-foreground">
          Reproduces the forge&apos;s PLAYER/ENEMY prompt pipeline word-for-word — Claude bakes
          the whole art bible into the FLUX prompt (canon scaffolding is bypassed).
        </p>
      </div>

      {/* Forge mode */}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm font-medium text-foreground">Mode</legend>
        <div className="flex gap-2">
          {(["player", "enemy"] as ForgeMode[]).map((m) => (
            <label
              key={m}
              htmlFor={`forgeMode-${m}`}
              aria-label={m}
              className={`${radio} ${forgeMode === m ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  id={`forgeMode-${m}`}
                  name="forgeMode"
                  value={m}
                  checked={forgeMode === m}
                  onChange={() => setForgeMode(m)}
                  className="accent-primary"
                />
                <span className="font-medium capitalize text-foreground">{m}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {forgeMode === "player" ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="forge-mutation">Mutation</Label>
              <select
                id="forge-mutation"
                value={mutationId}
                onChange={(e) => setMutationId(e.target.value)}
                className={selectControl}
              >
                {PLAYER_MUTATIONS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="forge-variant">Color variant</Label>
              <select
                id="forge-variant"
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                className={selectControl}
              >
                {PLAYER_VARIANTS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="forge-pose">Pose</Label>
            <select
              id="forge-pose"
              value={poseId}
              onChange={(e) => setPoseId(e.target.value)}
              className={selectControl}
            >
              {POSES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              T-pose reference promotes to a cleanly riggable 3D mesh.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="forge-desc">Enemy description</Label>
          <Textarea
            id="forge-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="a swarm of pulsing membrane leeches"
            className="resize-y"
          />
        </div>
      )}

      <div>
        <Button type="button" variant="outline" onClick={onBuild} disabled={building}>
          {building ? "Building…" : "Build prompt"}
        </Button>
      </div>
      {buildError && (
        <p role="alert" className="text-sm text-destructive">
          {buildError}
        </p>
      )}

      {/* The generate form — the editable prompt + title + output feed FLUX verbatim. */}
      <form action={action} className="flex flex-col gap-4">
        {/* Hidden inputs mirror the built state so the server can mark the recipe. */}
        <input type="hidden" name="poseId" value={forgeMode === "player" ? poseId : ""} />
        <input type="hidden" name="provider" value="flux" />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="forge-title">Title</Label>
          <Input
            id="forge-title"
            name="title"
            required
            minLength={2}
            placeholder="e.g. Host — membrane wings"
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="forgePrompt">
            Enriched FLUX prompt {usedFallback && <span className="text-muted-foreground">(fallback — no ANTHROPIC_API_KEY)</span>}
          </Label>
          <Textarea
            id="forgePrompt"
            name="forgePrompt"
            required
            minLength={3}
            rows={8}
            value={forgePrompt}
            onChange={(e) => setForgePrompt(e.target.value)}
            placeholder="Click “Build prompt” to generate the forge prompt, then edit it here. It goes to FLUX verbatim."
            className="resize-y font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Editable — this exact text is sent to FLUX (canon scaffolding is bypassed).
          </p>
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-sm font-medium text-foreground">Output</legend>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label
              htmlFor="forge-mode-image"
              className={`${radio} ${mode === "image" ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  id="forge-mode-image"
                  name="mode"
                  value="image"
                  checked={mode === "image"}
                  onChange={() => setMode("image")}
                  className="accent-primary"
                />
                <span className="font-medium text-foreground">Image only</span>
              </span>
              <span className="pl-6 text-xs text-muted-foreground">
                Review the 2D first, then promote to 3D.
              </span>
            </label>
            <label
              htmlFor="forge-mode-model"
              className={`${radio} ${mode === "model" ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  id="forge-mode-model"
                  name="mode"
                  value="model"
                  checked={mode === "model"}
                  onChange={() => setMode("model")}
                  className="accent-primary"
                />
                <span className="font-medium text-foreground">Straight to 3D</span>
              </span>
              <span className="pl-6 text-xs text-muted-foreground">
                FLUX → TRELLIS (T-pose auto-rigs cleanly).
              </span>
            </label>
          </div>
        </fieldset>

        <Button type="submit" disabled={busy || !forgePrompt.trim()} className="w-fit px-5">
          {busy ? "Generating…" : mode === "image" ? "Generate image" : "Generate 3D"}
        </Button>

        {state?.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
      </form>
    </section>
  );
}
