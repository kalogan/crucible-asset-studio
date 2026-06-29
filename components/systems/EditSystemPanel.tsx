"use client";

import { useActionState, useState } from "react";
import { updateAssetSystemManifestAction } from "@/app/actions/asset-systems";
import type { ActionResult } from "@/app/actions/projects";
import type {
  Manifest,
  ManifestFx,
  ManifestLight,
  ManifestSound,
} from "@/lib/asset-system/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LightType = ManifestLight["type"];
const LIGHT_TYPES: LightType[] = ["point", "directional", "ambient"];

// Editable row shapes — strings for number inputs so partial typing doesn't fight
// React; coerced to numbers only when serializing the manifest on submit.
interface LightRow {
  key: string;
  type: LightType;
  color: string;
  intensity: string;
  hasPosition: boolean;
  x: string;
  y: string;
  z: string;
}

interface SoundRow {
  key: string;
  label: string;
  url: string;
}

interface FxRow {
  key: string;
  kind: string;
  // Existing params are carried through untouched (a params editor is a future step).
  params?: Record<string, unknown>;
}

function toLightRows(lights: ManifestLight[] | undefined, seed: number): LightRow[] {
  return (lights ?? []).map((l, i) => ({
    key: `light-${seed}-${i}`,
    type: l.type,
    color: l.color,
    intensity: String(l.intensity),
    hasPosition: l.position !== undefined,
    x: l.position ? String(l.position[0]) : "0",
    y: l.position ? String(l.position[1]) : "0",
    z: l.position ? String(l.position[2]) : "0",
  }));
}

function toSoundRows(sounds: ManifestSound[] | undefined, seed: number): SoundRow[] {
  return (sounds ?? []).map((s, i) => ({
    key: `sound-${seed}-${i}`,
    label: s.label,
    url: s.url ?? "",
  }));
}

function toFxRows(fx: ManifestFx[] | undefined, seed: number): FxRow[] {
  return (fx ?? []).map((f, i) => ({
    key: `fx-${seed}-${i}`,
    kind: f.kind,
    ...(f.params !== undefined ? { params: f.params } : {}),
  }));
}

function numOr(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const selectClass =
  "min-h-9 rounded-md border border-input bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Per-system editor for the manifest's `lights` + `sounds` + `fx`. Parts and params
 * are carried through untouched — on submit the FULL manifest (existing parts/params
 * + the edited lights/sounds/fx) is serialized into a hidden `manifestJson` field and
 * validated server-side by the Zod schema.
 *
 * FX v1 edits the `kind` only (a per-fx `params` editor is a future step, and any
 * existing params are carried through). RENDERING fx in the scene is also FUTURE —
 * here fx is stored/edited on the manifest only.
 */
export function EditSystemPanel({
  systemId,
  manifest,
}: {
  systemId: string;
  manifest: Manifest;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    updateAssetSystemManifestAction,
    null,
  );

  // Seed counter keeps row keys unique across "add" clicks within a session.
  const [seed, setSeed] = useState(0);
  const [lights, setLights] = useState<LightRow[]>(() => toLightRows(manifest.lights, 0));
  const [sounds, setSounds] = useState<SoundRow[]>(() => toSoundRows(manifest.sounds, 0));
  const [fx, setFx] = useState<FxRow[]>(() => toFxRows(manifest.fx, 0));

  function nextKey(prefix: string): string {
    const k = seed + 1;
    setSeed(k);
    return `${prefix}-new-${k}`;
  }

  function addLight() {
    setLights((prev) => [
      ...prev,
      {
        key: nextKey("light"),
        type: "point",
        color: "#ffffff",
        intensity: "1",
        hasPosition: false,
        x: "0",
        y: "0",
        z: "0",
      },
    ]);
  }

  function updateLight(key: string, patch: Partial<LightRow>) {
    setLights((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLight(key: string) {
    setLights((prev) => prev.filter((l) => l.key !== key));
  }

  function addSound() {
    setSounds((prev) => [...prev, { key: nextKey("sound"), label: "", url: "" }]);
  }

  function updateSound(key: string, patch: Partial<SoundRow>) {
    setSounds((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function removeSound(key: string) {
    setSounds((prev) => prev.filter((s) => s.key !== key));
  }

  function addFx() {
    setFx((prev) => [...prev, { key: nextKey("fx"), kind: "" }]);
  }

  function updateFx(key: string, patch: Partial<FxRow>) {
    setFx((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  function removeFx(key: string) {
    setFx((prev) => prev.filter((f) => f.key !== key));
  }

  // Build the FULL manifest: keep parts + params, replace lights + sounds.
  const nextLights: ManifestLight[] = lights.map((l) => {
    const base: ManifestLight = {
      type: l.type,
      color: l.color,
      intensity: numOr(l.intensity, 1),
    };
    if (l.hasPosition) {
      base.position = [numOr(l.x, 0), numOr(l.y, 0), numOr(l.z, 0)];
    }
    return base;
  });
  const nextSounds: ManifestSound[] = sounds.map((s) => {
    const trimmedUrl = s.url.trim();
    const base: ManifestSound = { label: s.label.trim() };
    if (trimmedUrl) base.url = trimmedUrl;
    return base;
  });
  const nextFx: ManifestFx[] = fx.map((f) => {
    const base: ManifestFx = { kind: f.kind.trim() };
    if (f.params !== undefined) base.params = f.params;
    return base;
  });
  const nextManifest: Manifest = {
    parts: manifest.parts,
    lights: nextLights,
    sounds: nextSounds,
    fx: nextFx,
    ...(manifest.params !== undefined ? { params: manifest.params } : {}),
  };

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-expanded={false}
        onClick={() => setOpen(true)}
      >
        Edit
      </Button>
    );
  }

  return (
    <div className="w-full">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-expanded={true}
        onClick={() => setOpen(false)}
        className="mb-3"
      >
        Close
      </Button>

      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="systemId" value={systemId} />
        <input type="hidden" name="manifestJson" value={JSON.stringify(nextManifest)} />

        {/* Lights */}
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium text-foreground">
            Lights ({lights.length})
          </legend>
          {lights.length === 0 ? (
            <p className="text-xs text-muted-foreground">No lights.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {lights.map((l) => (
                <li
                  key={l.key}
                  className="flex flex-wrap items-end gap-3 rounded-md border border-border p-3"
                >
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${l.key}-type`}>Type</Label>
                    <select
                      id={`${l.key}-type`}
                      value={l.type}
                      onChange={(e) =>
                        updateLight(l.key, { type: e.target.value as LightType })
                      }
                      className={selectClass}
                    >
                      {LIGHT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${l.key}-color`}>Color</Label>
                    <input
                      id={`${l.key}-color`}
                      type="color"
                      value={l.color}
                      onChange={(e) => updateLight(l.key, { color: e.target.value })}
                      aria-label="Light color"
                      className="h-9 w-16 cursor-pointer rounded-md border border-input bg-card p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>

                  <div className="flex w-24 flex-col gap-1.5">
                    <Label htmlFor={`${l.key}-intensity`}>Intensity</Label>
                    <Input
                      id={`${l.key}-intensity`}
                      type="number"
                      step="0.1"
                      value={l.intensity}
                      onChange={(e) => updateLight(l.key, { intensity: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Position</span>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={l.hasPosition}
                        onChange={(e) => updateLight(l.key, { hasPosition: e.target.checked })}
                        className="h-4 w-4 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      Set position
                    </label>
                  </div>

                  {l.hasPosition && (
                    <div className="flex items-end gap-2">
                      {(["x", "y", "z"] as const).map((axis) => (
                        <div key={axis} className="flex w-16 flex-col gap-1.5">
                          <Label htmlFor={`${l.key}-${axis}`} className="uppercase">
                            {axis}
                          </Label>
                          <Input
                            id={`${l.key}-${axis}`}
                            type="number"
                            step="0.1"
                            value={l[axis]}
                            onChange={(e) =>
                              updateLight(l.key, { [axis]: e.target.value })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeLight(l.key)}
                    aria-label="Remove this light"
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addLight}>
            Add light
          </Button>
        </fieldset>

        {/* Sounds */}
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium text-foreground">
            Sounds ({sounds.length})
          </legend>
          {sounds.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sounds.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {sounds.map((s) => (
                <li
                  key={s.key}
                  className="flex flex-wrap items-end gap-3 rounded-md border border-border p-3"
                >
                  <div className="flex min-w-40 flex-1 flex-col gap-1.5">
                    <Label htmlFor={`${s.key}-label`}>Label</Label>
                    <Input
                      id={`${s.key}-label`}
                      value={s.label}
                      placeholder="e.g. Crackle"
                      autoComplete="off"
                      onChange={(e) => updateSound(s.key, { label: e.target.value })}
                    />
                  </div>
                  <div className="flex min-w-40 flex-1 flex-col gap-1.5">
                    <Label htmlFor={`${s.key}-url`}>URL (optional)</Label>
                    <Input
                      id={`${s.key}-url`}
                      value={s.url}
                      placeholder="https://…"
                      autoComplete="off"
                      onChange={(e) => updateSound(s.key, { url: e.target.value })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeSound(s.key)}
                    aria-label="Remove this sound"
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addSound}>
            Add sound
          </Button>
        </fieldset>

        {/* FX */}
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium text-foreground">FX ({fx.length})</legend>
          {/* NOTE: fx is stored/edited only — rendering fx in the scene is a future step. */}
          <p className="text-xs text-muted-foreground">
            Named effects stored on the manifest. v1 edits the kind only; a params
            editor and scene rendering are future steps.
          </p>
          {fx.length === 0 ? (
            <p className="text-xs text-muted-foreground">No fx.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {fx.map((f) => (
                <li
                  key={f.key}
                  className="flex flex-wrap items-end gap-3 rounded-md border border-border p-3"
                >
                  <div className="flex min-w-40 flex-1 flex-col gap-1.5">
                    <Label htmlFor={`${f.key}-kind`}>Kind</Label>
                    <Input
                      id={`${f.key}-kind`}
                      value={f.kind}
                      placeholder="e.g. fire, smoke, sparks"
                      autoComplete="off"
                      onChange={(e) => updateFx(f.key, { kind: e.target.value })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeFx(f.key)}
                    aria-label="Remove this fx"
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addFx}>
            Add fx
          </Button>
        </fieldset>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? "Saving…" : "Save lights, sounds & fx"}
          </Button>
          {state?.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          {state?.ok && (
            <p role="status" className="text-sm text-accent">
              Saved.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
