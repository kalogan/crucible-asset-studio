import "server-only";
import { createAsset } from "@/lib/db/assets";
import { persistBase64ToStorage } from "@/lib/executor";
import { buildStoragePath, catalogKeyFor } from "./paths";
import type { Asset } from "@/lib/schema";

/**
 * Bake the procgen synth recipe to a WAV — making audio a first-class stored asset.
 *
 * This is the Node/SSR-safe twin of vendor/game-kit's AudioManager: there is NO
 * Web Audio / AudioContext here, so we synthesize sample-by-sample with the SAME
 * math the runtime uses (oscillator waveforms + white noise through a clamped
 * gain product, with a short attack/release envelope so events don't click) and
 * write a 16-bit PCM mono WAV by hand. Pure + dependency-free → unit-testable.
 */

// ── recipe ─────────────────────────────────────────────────────────────────────

/** Oscillator waveforms we can render (matches the Web-Audio OscillatorType subset). */
export type AudioWave = "sine" | "square" | "sawtooth" | "triangle";

/** One scheduled sound: a tone (oscillator) or a burst of white noise. */
export interface AudioEvent {
  type: "tone" | "noise";
  /** Tone frequency in Hz (ignored for noise). */
  freq?: number;
  /** When the event starts, in seconds from t=0. */
  startSec: number;
  /** How long the event lasts, in seconds. */
  durationSec: number;
  /** Per-event linear gain (0..1), layered on the master gain. */
  gain: number;
  /** Tone waveform. Defaults to 'sine'. Ignored for noise. */
  wave?: AudioWave;
}

/** A self-contained, serializable description of a sound — stored in recipe_snapshot. */
export interface AudioRecipe {
  /** Output sample rate in Hz (e.g. 44100). */
  sampleRate: number;
  /** Master linear gain (0..1) applied to the whole mix. Defaults to 1. */
  masterGain?: number;
  /** Scheduled events, mixed additively into one mono track. */
  events: AudioEvent[];
}

// ── pure synthesis (mirrors the AudioManager's per-event math) ──────────────────

/** Clamp into [0, 1]; NaN → 0 (same semantics as the runtime's clamp01). */
function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

const TWO_PI = Math.PI * 2;

/** One cycle of the named waveform at phase `t` (in turns, 0..1). Band-limit-free
 *  (naive), matching a basic OscillatorType — fine for short UI/SFX cues. */
function oscillator(wave: AudioWave, t: number): number {
  // t is the fractional position within the current cycle (0..1).
  const frac = t - Math.floor(t);
  switch (wave) {
    case "square":
      return frac < 0.5 ? 1 : -1;
    case "sawtooth":
      return 2 * frac - 1;
    case "triangle":
      return 4 * Math.abs(frac - 0.5) - 1;
    case "sine":
    default:
      return Math.sin(TWO_PI * frac);
  }
}

/**
 * The same short attack/release the AudioManager applies via linearRampToValueAtTime,
 * computed for a given offset into the event. Ramps 0→peak over `ramp` seconds at the
 * start and peak→0 over `ramp` seconds at the end (ramp is capped at half the duration
 * so very short events still get a symmetric fade). Returns a 0..1 envelope multiplier.
 */
function envelope(offsetSec: number, durationSec: number, peak: number): number {
  if (durationSec <= 0) return 0;
  const ramp = Math.min(0.01, durationSec / 2);
  if (ramp <= 0) return peak;
  if (offsetSec < ramp) return peak * (offsetSec / ramp);
  const release = durationSec - offsetSec;
  if (release < ramp) return peak * Math.max(0, release / ramp);
  return peak;
}

/**
 * PURE: render an AudioRecipe to mono Float32 samples in [-1, 1]. Events are summed
 * additively (then hard-clamped at write time). White-noise uses Math.random, exactly
 * like the runtime's noise buffer. Deterministic for tone-only recipes.
 */
export function renderSamples(recipe: AudioRecipe): Float32Array {
  const sampleRate = Math.max(1, Math.floor(recipe.sampleRate));
  const master = recipe.masterGain === undefined ? 1 : clamp01(recipe.masterGain);

  // Track length = the latest event end (rounded up to a whole sample). Empty → 0.
  let endSec = 0;
  for (const e of recipe.events) {
    endSec = Math.max(endSec, e.startSec + Math.max(0, e.durationSec));
  }
  const totalFrames = Math.max(0, Math.ceil(endSec * sampleRate));
  const out = new Float32Array(totalFrames);

  for (const e of recipe.events) {
    if (e.durationSec <= 0) continue;
    const peak = clamp01(e.gain) * master; // the AudioManager's master×event product
    if (peak <= 0) continue;
    const startFrame = Math.max(0, Math.floor(e.startSec * sampleRate));
    const frames = Math.floor(e.durationSec * sampleRate);
    const wave = e.wave ?? "sine";
    const freq = e.freq ?? 440;

    for (let i = 0; i < frames; i++) {
      const frame = startFrame + i;
      if (frame >= totalFrames) break;
      const offsetSec = i / sampleRate;
      const env = envelope(offsetSec, e.durationSec, peak);
      const sample =
        e.type === "noise"
          ? Math.random() * 2 - 1
          : oscillator(wave, freq * offsetSec);
      out[frame] = (out[frame] ?? 0) + sample * env;
    }
  }

  // Guard against additive overlap clipping past [-1, 1].
  for (let i = 0; i < out.length; i++) {
    const v = out[i] ?? 0;
    out[i] = v > 1 ? 1 : v < -1 ? -1 : v;
  }
  return out;
}

// ── WAV container (16-bit PCM, mono) ────────────────────────────────────────────

/** Write an ASCII tag into a DataView at `offset`. */
function writeTag(view: DataView, offset: number, tag: string): void {
  for (let i = 0; i < tag.length; i++) view.setUint8(offset + i, tag.charCodeAt(i));
}

/**
 * PURE: encode mono Float32 samples ([-1,1]) as a 16-bit PCM WAV byte stream.
 * Standard 44-byte RIFF/WAVE header followed by little-endian int16 samples.
 */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytesPerSample = 2; // 16-bit
  const numChannels = 1; // mono
  const dataBytes = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  // RIFF header
  writeTag(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true); // file size minus the first 8 bytes
  writeTag(view, 8, "WAVE");
  // fmt chunk
  writeTag(view, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // audio format = 1 (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // byte rate
  view.setUint16(32, numChannels * bytesPerSample, true); // block align
  view.setUint16(34, 8 * bytesPerSample, true); // bits per sample
  // data chunk
  writeTag(view, 36, "data");
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    let s = samples[i] ?? 0;
    if (s > 1) s = 1;
    else if (s < -1) s = -1;
    // Map [-1,1] → int16. Negative range is one larger, matching common encoders.
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += bytesPerSample;
  }
  return new Uint8Array(buffer);
}

/** PURE: render a recipe straight to WAV bytes (renderSamples → encodeWav). */
export function renderWav(recipe: AudioRecipe): Uint8Array {
  return encodeWav(renderSamples(recipe), Math.max(1, Math.floor(recipe.sampleRate)));
}

// ── bake → stored asset ─────────────────────────────────────────────────────────

export interface BakeAudioInput {
  projectId: string;
  projectSlug: string;
  /** Human title — also the catalog key seed (e.g. "Coin Pickup" → audio.coin-pickup). */
  title: string;
  recipe: AudioRecipe;
}

/** Audio catalog key (parallels catalogKeyFor's "prop." with an "audio." namespace). */
function audioCatalogKey(title: string): string {
  return catalogKeyFor(title).replace(/^prop\./, "audio.");
}

/**
 * Bake an AudioRecipe to a WAV, upload it to Storage the SAME way generate.ts persists
 * outputs, and record it as a first-class `kind: "audio"` asset with the recipe captured
 * in recipe_snapshot (so the sound is fully reproducible).
 *
 * NO COST GATE: baking is entirely local + free (pure synthesis, no external/paid call),
 * so unlike the FLUX/TRELLIS pipelines there is nothing to budget here.
 */
export async function bakeAudioAsset(input: BakeAudioInput): Promise<Asset> {
  const catalogKey = audioCatalogKey(input.title);
  const wav = renderWav(input.recipe);
  const path = buildStoragePath(input.projectSlug, catalogKey, "wav");
  // persistBase64ToStorage already encapsulates the service-client upload + public URL;
  // feed it the WAV bytes as base64 with the audio/wav content type.
  const url = await persistBase64ToStorage({
    base64: Buffer.from(wav).toString("base64"),
    mimeType: "audio/wav",
    path,
  });
  const recipe = {
    title: input.title,
    kind: "audio",
    catalog_key: catalogKey,
    synth: "procgen-wav-bake",
    audio_recipe: input.recipe,
    audio_url: url,
  } satisfies Record<string, unknown>;
  return createAsset({
    project_id: input.projectId,
    stage: "in_review",
    kind: "audio",
    raw_path: url,
    recipe_snapshot: recipe,
  });
}
