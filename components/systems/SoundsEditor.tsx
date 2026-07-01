"use client";

import { useActionState, useState } from "react";
import { bakeSystemSoundAction } from "@/app/actions/asset-systems";
import type { BakeSoundResult } from "@/app/actions/asset-systems";
import type { AudioRecipe, AudioWave, ManifestSound } from "@/lib/asset-system/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const WAVES: AudioWave[] = ["sine", "square", "sawtooth", "triangle"];
type EventType = "tone" | "noise";

const selectClass =
  "min-h-9 rounded-md border border-input bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Editable row shapes — strings for number inputs so partial typing doesn't fight React;
// coerced to numbers only when we serialize the recipe for the bake action.
export interface EventRow {
  key: string;
  type: EventType;
  freq: string;
  startSec: string;
  durationSec: string;
  gain: string;
  wave: AudioWave;
}

export interface SoundRow {
  key: string;
  label: string;
  url: string;
  sampleRate: string;
  masterGain: string;
  events: EventRow[];
}

/** Seed a fresh event with sensible defaults (a short 440 Hz sine blip). */
function newEvent(key: string): EventRow {
  return {
    key,
    type: "tone",
    freq: "440",
    startSec: "0",
    durationSec: "0.2",
    gain: "0.5",
    wave: "sine",
  };
}

/** Convert stored ManifestSounds into editable rows. Persisted sounds carry a url only
 *  (the authored recipe lives client-side per session), so each starts with no events. */
export function toSoundRows(sounds: ManifestSound[] | undefined, seed: number): SoundRow[] {
  return (sounds ?? []).map((s, i) => ({
    key: `sound-${seed}-${i}`,
    label: s.label,
    url: s.url ?? "",
    sampleRate: "44100",
    masterGain: "0.8",
    events: [],
  }));
}

/** Serialize the editor rows back into ManifestSounds (label + optional baked url). */
export function soundRowsToManifest(rows: SoundRow[]): ManifestSound[] {
  return rows.map((s) => {
    const trimmedUrl = s.url.trim();
    const base: ManifestSound = { label: s.label.trim() };
    if (trimmedUrl) base.url = trimmedUrl;
    return base;
  });
}

function numOr(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Build the AudioRecipe the bake action validates from a single sound's rows. */
function toRecipe(sound: SoundRow): AudioRecipe {
  return {
    sampleRate: Math.max(1, Math.floor(numOr(sound.sampleRate, 44100))),
    masterGain: numOr(sound.masterGain, 0.8),
    events: sound.events.map((e) => {
      const base: AudioRecipe["events"][number] = {
        type: e.type,
        startSec: numOr(e.startSec, 0),
        durationSec: numOr(e.durationSec, 0),
        gain: numOr(e.gain, 0.5),
      };
      if (e.type === "tone") {
        base.freq = numOr(e.freq, 440);
        base.wave = e.wave;
      }
      return base;
    }),
  };
}

/**
 * Per-sound authoring card: name it, author tone/noise events (freq/duration/gain/wave),
 * bake to a stored WAV, and preview the baked result inline. Baking runs its own server
 * action (one useActionState per card, since the hook is one-per-form); on success it
 * calls `onBaked` so the parent stamps the returned url onto this sound's row.
 */
function SoundCard({
  sound,
  onPatch,
  onRemove,
  onBaked,
}: {
  sound: SoundRow;
  onPatch: (patch: Partial<SoundRow>) => void;
  onRemove: () => void;
  onBaked: (url: string) => void;
}) {
  const [state, dispatch, pending] = useActionState<BakeSoundResult | null, FormData>(
    async (prev, formData) => {
      const result = await bakeSystemSoundAction(prev, formData);
      if (result.ok && result.url) onBaked(result.url);
      return result;
    },
    null,
  );

  // Bake is fired programmatically (not via a nested <form>, which would be invalid HTML
  // inside the outer manifest-save form): build the FormData the action reads by hand.
  function bake() {
    const fd = new FormData();
    fd.set("label", sound.label);
    fd.set("recipeJson", JSON.stringify(toRecipe(sound)));
    dispatch(fd);
  }

  // Event key counter, local to this card, keeps keys unique across "add" clicks.
  const [eventSeed, setEventSeed] = useState(0);

  function addEvent() {
    const k = eventSeed + 1;
    setEventSeed(k);
    onPatch({ events: [...sound.events, newEvent(`${sound.key}-ev-${k}`)] });
  }

  function updateEvent(key: string, patch: Partial<EventRow>) {
    onPatch({
      events: sound.events.map((e) => (e.key === key ? { ...e, ...patch } : e)),
    });
  }

  function removeEvent(key: string) {
    onPatch({ events: sound.events.filter((e) => e.key !== key) });
  }

  return (
    <li className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-40 flex-1 flex-col gap-1.5">
          <Label htmlFor={`${sound.key}-label`}>Label</Label>
          <Input
            id={`${sound.key}-label`}
            value={sound.label}
            placeholder="e.g. Crackle"
            autoComplete="off"
            onChange={(e) => onPatch({ label: e.target.value })}
          />
        </div>
        <div className="flex w-28 flex-col gap-1.5">
          <Label htmlFor={`${sound.key}-rate`}>Sample rate</Label>
          <Input
            id={`${sound.key}-rate`}
            type="number"
            step="1"
            value={sound.sampleRate}
            onChange={(e) => onPatch({ sampleRate: e.target.value })}
          />
        </div>
        <div className="flex w-24 flex-col gap-1.5">
          <Label htmlFor={`${sound.key}-master`}>Master gain</Label>
          <Input
            id={`${sound.key}-master`}
            type="number"
            step="0.05"
            value={sound.masterGain}
            onChange={(e) => onPatch({ masterGain: e.target.value })}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRemove}
          aria-label="Remove this sound"
        >
          Remove
        </Button>
      </div>

      {/* Events */}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-xs font-medium text-foreground">
          Events ({sound.events.length})
        </legend>
        {sound.events.length === 0 ? (
          <p className="text-xs text-muted-foreground">No events. Add a tone or noise burst.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {sound.events.map((ev) => (
              <li
                key={ev.key}
                className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/30 p-3"
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${ev.key}-type`}>Type</Label>
                  <select
                    id={`${ev.key}-type`}
                    value={ev.type}
                    onChange={(e) =>
                      updateEvent(ev.key, { type: e.target.value as EventType })
                    }
                    className={selectClass}
                  >
                    <option value="tone">tone</option>
                    <option value="noise">noise</option>
                  </select>
                </div>

                {ev.type === "tone" && (
                  <>
                    <div className="flex w-24 flex-col gap-1.5">
                      <Label htmlFor={`${ev.key}-freq`}>Freq (Hz)</Label>
                      <Input
                        id={`${ev.key}-freq`}
                        type="number"
                        step="1"
                        value={ev.freq}
                        onChange={(e) => updateEvent(ev.key, { freq: e.target.value })}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`${ev.key}-wave`}>Wave</Label>
                      <select
                        id={`${ev.key}-wave`}
                        value={ev.wave}
                        onChange={(e) =>
                          updateEvent(ev.key, { wave: e.target.value as AudioWave })
                        }
                        className={selectClass}
                      >
                        {WAVES.map((w) => (
                          <option key={w} value={w}>
                            {w}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div className="flex w-20 flex-col gap-1.5">
                  <Label htmlFor={`${ev.key}-start`}>Start (s)</Label>
                  <Input
                    id={`${ev.key}-start`}
                    type="number"
                    step="0.05"
                    value={ev.startSec}
                    onChange={(e) => updateEvent(ev.key, { startSec: e.target.value })}
                  />
                </div>
                <div className="flex w-24 flex-col gap-1.5">
                  <Label htmlFor={`${ev.key}-dur`}>Duration (s)</Label>
                  <Input
                    id={`${ev.key}-dur`}
                    type="number"
                    step="0.05"
                    value={ev.durationSec}
                    onChange={(e) => updateEvent(ev.key, { durationSec: e.target.value })}
                  />
                </div>
                <div className="flex w-20 flex-col gap-1.5">
                  <Label htmlFor={`${ev.key}-gain`}>Gain</Label>
                  <Input
                    id={`${ev.key}-gain`}
                    type="number"
                    step="0.05"
                    value={ev.gain}
                    onChange={(e) => updateEvent(ev.key, { gain: e.target.value })}
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeEvent(ev.key)}
                  aria-label="Remove this event"
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addEvent}>
          Add event
        </Button>
      </fieldset>

      {/* Bake — fired programmatically (see `bake` above) so no nested <form> is needed
          inside the outer manifest-save form. On success the returned url is attached. */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending || sound.events.length === 0 || !sound.label.trim()}
          className="w-fit"
          onClick={bake}
        >
          {pending ? "Baking…" : "Bake sound"}
        </Button>
        {state?.error && (
          <p role="alert" className="text-xs text-destructive">
            {state.error}
          </p>
        )}
        {state?.ok && (
          <p role="status" className="text-xs text-accent">
            Baked & attached.
          </p>
        )}
      </div>

      {sound.url ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Baked audio</span>
          <audio
            controls
            preload="none"
            src={sound.url}
            aria-label={`Baked audio: ${sound.label || "sound"}`}
            className="w-full max-w-md"
          >
            <track kind="captions" />
          </audio>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Not baked yet — author events and bake to attach a URL.
        </p>
      )}
    </li>
  );
}

/**
 * The sounds editor for the asset-system flow: author one or more AudioRecipes (each a list
 * of tone/noise events), bake each to a stored WAV, and preview the result inline. The parent
 * owns the `sounds` state (so it can fold these into the full manifest on save) and passes it
 * down; this component just renders the authoring UI and calls back on every change.
 */
export function SoundsEditor({
  sounds,
  onChange,
  onAdd,
}: {
  sounds: SoundRow[];
  onChange: (rows: SoundRow[]) => void;
  onAdd: () => void;
}) {
  function patchSound(key: string, patch: Partial<SoundRow>) {
    onChange(sounds.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function removeSound(key: string) {
    onChange(sounds.filter((s) => s.key !== key));
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium text-foreground">
        Sounds ({sounds.length})
      </legend>
      <p className="text-xs text-muted-foreground">
        Author a synth recipe (tone / noise events), bake it to a stored WAV, and the resulting
        URL is attached to the sound. Save below to persist onto the system.
      </p>
      {sounds.length === 0 ? (
        <p className="text-xs text-muted-foreground">No sounds.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sounds.map((s) => (
            <SoundCard
              key={s.key}
              sound={s}
              onPatch={(patch) => patchSound(s.key, patch)}
              onRemove={() => removeSound(s.key)}
              onBaked={(url) => patchSound(s.key, { url })}
            />
          ))}
        </ul>
      )}
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={onAdd}>
        Add sound
      </Button>
    </fieldset>
  );
}
