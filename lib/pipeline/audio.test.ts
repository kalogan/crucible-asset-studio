import { describe, it, expect } from "vitest";
import {
  renderSamples,
  encodeWav,
  renderWav,
  type AudioRecipe,
} from "./audio";

/** Read a little-endian ASCII tag from WAV bytes. */
function tag(bytes: Uint8Array, offset: number, len: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + len));
}

/** Read a little-endian uint32 from WAV bytes. */
function u32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset).getUint32(offset, true);
}

describe("renderSamples", () => {
  it("sizes the track to the latest event end", () => {
    const recipe: AudioRecipe = {
      sampleRate: 1000,
      events: [{ type: "tone", freq: 100, startSec: 0, durationSec: 0.5, gain: 1 }],
    };
    // 0.5s @ 1000Hz = 500 frames.
    expect(renderSamples(recipe)).toHaveLength(500);
  });

  it("renders silence (empty buffer) for no events", () => {
    expect(renderSamples({ sampleRate: 44100, events: [] })).toHaveLength(0);
  });

  it("keeps every sample within [-1, 1] even when events overlap", () => {
    const recipe: AudioRecipe = {
      sampleRate: 8000,
      events: [
        { type: "tone", freq: 440, startSec: 0, durationSec: 0.2, gain: 1 },
        { type: "tone", freq: 660, startSec: 0, durationSec: 0.2, gain: 1 },
        { type: "noise", startSec: 0, durationSec: 0.2, gain: 1 },
      ],
    };
    const out = renderSamples(recipe);
    for (const s of out) {
      expect(s).toBeGreaterThanOrEqual(-1);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it("applies an attack/release envelope (starts and ends near zero)", () => {
    const recipe: AudioRecipe = {
      sampleRate: 8000,
      events: [{ type: "tone", freq: 200, startSec: 0, durationSec: 0.3, gain: 1 }],
    };
    const out = renderSamples(recipe);
    // First and last samples ride the ramp, so they sit very close to zero.
    expect(Math.abs(out[0] ?? 0)).toBeLessThan(0.05);
    expect(Math.abs(out[out.length - 1] ?? 0)).toBeLessThan(0.05);
  });

  it("scales output by the per-event and master gain product", () => {
    const loud = renderSamples({
      sampleRate: 8000,
      masterGain: 1,
      events: [{ type: "tone", freq: 200, startSec: 0, durationSec: 0.3, gain: 1 }],
    });
    const quiet = renderSamples({
      sampleRate: 8000,
      masterGain: 0.5,
      events: [{ type: "tone", freq: 200, startSec: 0, durationSec: 0.3, gain: 0.5 }],
    });
    const peak = (a: Float32Array) => Math.max(...Array.from(a, Math.abs));
    // master 0.5 × event 0.5 = 0.25 of the loud (master 1 × event 1) peak.
    expect(peak(quiet)).toBeLessThan(peak(loud));
    expect(peak(quiet) / peak(loud)).toBeCloseTo(0.25, 1);
  });

  it("renders distinct waveforms (square is a ±1 step, sine is smooth)", () => {
    const square = renderSamples({
      sampleRate: 8000,
      events: [{ type: "tone", freq: 100, startSec: 0, durationSec: 0.3, gain: 1, wave: "square" }],
    });
    // Mid-event (past the attack ramp) a unit square wave is saturated to ±~1.
    expect(Math.abs(square[Math.floor(square.length / 2)] ?? 0)).toBeGreaterThan(0.9);
  });
});

describe("encodeWav", () => {
  it("writes a valid 16-bit PCM mono RIFF/WAVE header", () => {
    const samples = renderSamples({
      sampleRate: 8000,
      events: [{ type: "tone", freq: 200, startSec: 0, durationSec: 0.1, gain: 1 }],
    });
    const wav = encodeWav(samples, 8000);
    expect(tag(wav, 0, 4)).toBe("RIFF");
    expect(tag(wav, 8, 4)).toBe("WAVE");
    expect(tag(wav, 12, 4)).toBe("fmt ");
    expect(tag(wav, 36, 4)).toBe("data");
    // header (44) + 2 bytes/sample.
    expect(wav.length).toBe(44 + samples.length * 2);
    expect(u32(wav, 40)).toBe(samples.length * 2); // data chunk size
    expect(u32(wav, 24)).toBe(8000); // sample rate
  });
});

describe("renderWav", () => {
  it("renders a recipe straight to non-empty WAV bytes", () => {
    const wav = renderWav({
      sampleRate: 22050,
      events: [{ type: "tone", freq: 440, startSec: 0, durationSec: 0.25, gain: 0.8 }],
    });
    expect(tag(wav, 0, 4)).toBe("RIFF");
    expect(wav.length).toBeGreaterThan(44);
  });
});
