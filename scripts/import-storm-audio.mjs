// Import Storm-Break Hockey's SYNTHESIZED sounds into Crucible as AUDIO reference assets.
//
// Storm-Break has NO audio files — its sounds are Web-Audio synth defined in code
// (src/logic/SoundManager.js + src/logic/AudioController.js). This script translates each
// sound into a Crucible AudioRecipe (tones + noise + envelope), renders it to a 16-bit PCM
// mono WAV with the SAME pure renderSamples/encodeWav math as lib/pipeline/audio.ts
// (reimplemented INLINE below — the renderer is dependency-free), base64-encodes it, and
// POSTs it to /api/import as a reference_asset on project "storm-break-hockey".
//
//   pnpm import-storm-audio            # DRY-RUN: list what would import (no writes) — the default
//   pnpm import-storm-audio --run      # actually render + POST each WAV
//
// Idempotent: the endpoint re-syncs by artKitId (upsert on the storage path), so re-running
// --run overwrites the same assets rather than duplicating them.
//
// Env (.env.local): CRUCIBLE_IMPORT_TOKEN (the /api/import bearer). Target overridable with
// CRUCIBLE_APP_URL (default http://localhost:3000).
//
// ── FIDELITY NOTE ────────────────────────────────────────────────────────────────
// Crucible's renderer is deliberately simple: naive oscillators + RAW white noise, a fixed
// ~10 ms attack/release envelope (flat sustain between), and NO biquad filters, frequency
// ramps, LFOs, delay/feedback, or looping. Storm-Break's sounds use all of those. So these
// recipes are APPROXIMATIONS of the game's cues, not bit-exact captures:
//   • Frequency sweeps (freq → freqEnd)  → approximated as a short chain of stepped tones.
//   • Exponential gain decays            → approximated as a short chain of gain-stepped events.
//   • Bandpass/lowpass-filtered noise     → rendered as raw white-noise bursts (unfiltered);
//                                           the burst's gain/duration convey the "shape", not
//                                           the timbre. Good enough for a reference cue.
// Sounds that lean HARD on filtering/LFO/delay for their identity are SKIPPED and listed at
// the end — those would need an in-browser export harness in Storm-Break (see report).

const args = process.argv.slice(2);
const DRY = !args.includes("--run");

const token = process.env.CRUCIBLE_IMPORT_TOKEN;
if (!token) {
  console.error("Set CRUCIBLE_IMPORT_TOKEN in .env.local (the /api/import bearer token).");
  process.exit(1);
}
const base = process.env.CRUCIBLE_APP_URL || "http://localhost:3000";
const SLUG = "storm-break-hockey";
const SAMPLE_RATE = 44100;

// ── PURE RENDERER (inlined twin of lib/pipeline/audio.ts) ────────────────────────
function clamp01(n) {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
const TWO_PI = Math.PI * 2;
function oscillator(wave, t) {
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
function envelope(offsetSec, durationSec, peak) {
  if (durationSec <= 0) return 0;
  const ramp = Math.min(0.01, durationSec / 2);
  if (ramp <= 0) return peak;
  if (offsetSec < ramp) return peak * (offsetSec / ramp);
  const release = durationSec - offsetSec;
  if (release < ramp) return peak * Math.max(0, release / ramp);
  return peak;
}
function renderSamples(recipe) {
  const sampleRate = Math.max(1, Math.floor(recipe.sampleRate));
  const master = recipe.masterGain === undefined ? 1 : clamp01(recipe.masterGain);
  let endSec = 0;
  for (const e of recipe.events) endSec = Math.max(endSec, e.startSec + Math.max(0, e.durationSec));
  const totalFrames = Math.max(0, Math.ceil(endSec * sampleRate));
  const out = new Float32Array(totalFrames);
  for (const e of recipe.events) {
    if (e.durationSec <= 0) continue;
    const peak = clamp01(e.gain) * master;
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
      const sample = e.type === "noise" ? Math.random() * 2 - 1 : oscillator(wave, freq * offsetSec);
      out[frame] = (out[frame] ?? 0) + sample * env;
    }
  }
  for (let i = 0; i < out.length; i++) {
    const v = out[i] ?? 0;
    out[i] = v > 1 ? 1 : v < -1 ? -1 : v;
  }
  return out;
}
function writeTag(view, offset, tag) {
  for (let i = 0; i < tag.length; i++) view.setUint8(offset + i, tag.charCodeAt(i));
}
function encodeWav(samples, sampleRate) {
  const bytesPerSample = 2;
  const numChannels = 1;
  const dataBytes = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  writeTag(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeTag(view, 8, "WAVE");
  writeTag(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeTag(view, 36, "data");
  view.setUint32(40, dataBytes, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    let s = samples[i] ?? 0;
    if (s > 1) s = 1;
    else if (s < -1) s = -1;
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += bytesPerSample;
  }
  return new Uint8Array(buffer);
}
function renderWav(recipe) {
  return encodeWav(renderSamples(recipe), Math.max(1, Math.floor(recipe.sampleRate)));
}

// ── recipe-builder helpers ───────────────────────────────────────────────────────
// Storm-Break's _synth/_noise use exponential freq ramps + exponential gain decays, which the
// Crucible renderer can't express directly. We decompose them into a chain of short stepped
// events that trace the same curve. STEPS controls resolution (higher = smoother, bigger WAV).

const STEPS = 12;

/** Geometric interpolation start→end across n steps (matches exponentialRampTo). */
function geom(start, end, i, n) {
  const s = Math.max(start, 1e-4);
  const e = Math.max(end, 1e-4);
  return s * Math.pow(e / s, i / Math.max(1, n));
}

/**
 * A tone with an exponential freq sweep (freq→freqEnd) and an exponential gain decay from
 * `peak` to ~0 over `dur`, approximated as STEPS contiguous flat sub-events. `startSec` offsets
 * the whole chain. Mirrors AudioController._synth's decay shape (peak reached ~instantly).
 */
function sweepTone({ wave, freq, freqEnd = freq, peak, dur, startSec = 0 }, events) {
  const step = dur / STEPS;
  for (let i = 0; i < STEPS; i++) {
    const f = geom(freq, freqEnd, i, STEPS);
    const g = peak * Math.pow(0.0001 / 1, i / STEPS); // exp decay to ~-80 dB
    if (g <= 0.001) break;
    events.push({ type: "tone", wave, freq: f, startSec: startSec + i * step, durationSec: step, gain: g });
  }
}

/** A sustained tone that rises linearly to `peak` then holds — used for chord/pad notes. */
function tone({ wave, freq, peak, dur, startSec = 0 }, events) {
  events.push({ type: "tone", wave, freq, startSec, durationSec: dur, gain: peak });
}

/** A white-noise burst with an exponential gain decay (raw noise — filter not reproduced). */
function noiseBurst({ peak, dur, startSec = 0 }, events) {
  const step = dur / STEPS;
  for (let i = 0; i < STEPS; i++) {
    const g = peak * Math.pow(0.0001 / 1, i / STEPS);
    if (g <= 0.001) break;
    events.push({ type: "noise", startSec: startSec + i * step, durationSec: step, gain: g });
  }
}

// ── the Storm-Break sound catalog → Crucible recipes ─────────────────────────────
// Each entry: { name, source, note, build(events) }. `vol`/`speed`-scaled sounds are baked at
// their nominal full-intensity value (i=1, vol=1) so the reference asset is the "loudest" form.

const CATALOG = [];
function addSound(name, source, note, build) {
  const events = [];
  build(events);
  CATALOG.push({ name, source, note, recipe: { sampleRate: SAMPLE_RATE, masterGain: 0.9, events } });
}

// ── SoundManager.js ──────────────────────────────────────────────────────────────

// IMPACT_WALL: bandpass(180Hz) white-noise thud, 80ms exp decay. Filter dropped → raw burst.
addSound("IMPACT_WALL", "SoundManager", "bandpass-noise thud (filter approximated as raw burst)", (e) => {
  noiseBurst({ peak: 0.7, dur: 0.08 }, e);
});

// IMPACT_PUCK: 520→200Hz sine click + highpass noise tick. Sine sweep + short raw-noise tick.
addSound("IMPACT_PUCK", "SoundManager", "sine 520→200Hz + metallic noise tick", (e) => {
  sweepTone({ wave: "sine", freq: 520, freqEnd: 200, peak: 0.55, dur: 0.07 }, e);
  noiseBurst({ peak: 0.4, dur: 0.012 }, e);
});

// GOAL_SCORED: two lowpass-swept sawtooth notes (A3+C#4) octave-up ramp + sub sines + 80→25Hz
// boom. Filter dropped; freq sweeps + sustain approximated.
addSound("GOAL_SCORED", "SoundManager", "two sawtooth notes octave-sweep + sub sines + 80→25Hz boom", (e) => {
  // Root A3 + major third C#4, each swept up an octave over 0.55s, sustained ~1.1s total.
  [220, 277.18].forEach((freq, idx) => {
    const peak = idx === 0 ? 0.35 : 0.25;
    // rising portion (swept, first 0.55s)
    const sweepSteps = 8;
    for (let i = 0; i < sweepSteps; i++) {
      const f = geom(freq, freq * 2, i, sweepSteps);
      e.push({ type: "tone", wave: "sawtooth", freq: f, startSec: (i * 0.55) / sweepSteps, durationSec: 0.55 / sweepSteps, gain: peak });
    }
    // sustain + release tail (0.55 → 1.1s), gain decays to ~0
    sweepTone({ wave: "sawtooth", freq: freq * 2, freqEnd: freq * 2, peak, dur: 0.55, startSec: 0.55 }, e);
    // sub-harmonic sine warmth (freq*0.5, ~0.6s decay)
    sweepTone({ wave: "sine", freq: freq * 0.5, freqEnd: freq * 0.5, peak: 0.12, dur: 0.6 }, e);
  });
  // impact boom 80→25Hz
  sweepTone({ wave: "sine", freq: 80, freqEnd: 25, peak: 0.65, dur: 0.45 }, e);
});

// VICTORY: C4→E4→G4 triangle arpeggio (staggered) + root sub sine. No filters → clean.
addSound("VICTORY", "SoundManager", "C-E-G triangle arpeggio (staggered) + root sub sine", (e) => {
  [261.63, 329.63, 392.0].forEach((freq, idx) => {
    const delay = idx * 0.18;
    // note: rise to 0.38 then sustain ~0.35s then decay to ~1.2s
    tone({ wave: "triangle", freq, peak: 0.38, dur: 0.4, startSec: delay }, e);
    sweepTone({ wave: "triangle", freq, freqEnd: freq, peak: 0.38, dur: 0.8, startSec: delay + 0.4 }, e);
    if (idx === 0) sweepTone({ wave: "sine", freq: freq * 0.5, freqEnd: freq * 0.5, peak: 0.25, dur: 0.5 }, e);
  });
});

// DEFEAT: A3→F3→D3 lowpass sawtooth fall + 55→30Hz sine rumble. Lowpass dropped.
addSound("DEFEAT", "SoundManager", "A-F-D sawtooth descending fall + 55→30Hz sine rumble", (e) => {
  [220.0, 174.61, 146.83].forEach((freq, idx) => {
    const delay = idx * 0.22;
    sweepTone({ wave: "sawtooth", freq, freqEnd: freq, peak: 0.28, dur: 1.4, startSec: delay }, e);
  });
  sweepTone({ wave: "sine", freq: 55, freqEnd: 30, peak: 0.2, dur: 1.5 }, e);
});

// ── AudioController.js ───────────────────────────────────────────────────────────

// CLINK (playClink, i=1): triangle 1300→300Hz + sine 2200→700Hz + hi bandpass noise tick.
addSound("CLINK", "AudioController", "triangle 1300→300 + sine 2200→700 + metallic noise (i=1)", (e) => {
  sweepTone({ wave: "triangle", freq: 1300, freqEnd: 300, peak: 0.25, dur: 0.26 }, e);
  sweepTone({ wave: "sine", freq: 2200, freqEnd: 700, peak: 0.1, dur: 0.1 }, e);
  noiseBurst({ peak: 0.12, dur: 0.03 }, e);
});

// GOAL (playGoal): 330/415/495 Hz sine triad, staggered 0.12s, slow attack + 0.9s decay.
addSound("GOAL", "AudioController", "E-G#-B sine triad, staggered, 0.9s decay", (e) => {
  [330, 415, 495].forEach((freq, idx) => {
    const onset = idx * 0.12;
    tone({ wave: "sine", freq, peak: 0.18, dur: 0.1, startSec: onset }, e);
    sweepTone({ wave: "sine", freq, freqEnd: freq, peak: 0.18, dur: 0.9, startSec: onset + 0.1 }, e);
  });
});

// WALL_HIT (playWallHit, i=1): sawtooth 150→30Hz + lowish bandpass noise thud. Filter dropped.
addSound("WALL_HIT", "AudioController", "sawtooth 150→30Hz + low noise thud (i=1)", (e) => {
  sweepTone({ wave: "sawtooth", freq: 150, freqEnd: 30, peak: 0.35, dur: 0.14 }, e);
  noiseBurst({ peak: 0.4, dur: 0.18 }, e);
});

// PILLAR_CLANG (playPillarClang, i=1): deep sine 125→28 + hi sine 1700→700 + stone noise +
// crystalline spark noise. Filters dropped; four layers preserved.
addSound("PILLAR_CLANG", "AudioController", "obsidian sine ring 125→28 + shimmer 1700→700 + stone/spark noise (i=1)", (e) => {
  sweepTone({ wave: "sine", freq: 125, freqEnd: 28, peak: 0.5, dur: 0.75 }, e);
  sweepTone({ wave: "sine", freq: 1700, freqEnd: 700, peak: 0.14, dur: 0.3 }, e);
  noiseBurst({ peak: 0.55, dur: 0.3 }, e);
  noiseBurst({ peak: 0.1, dur: 0.04 }, e);
});

// OVERDRIVE_ELECTRIC: sawtooth 110→2200Hz zap + bandpass noise. Filter dropped.
addSound("OVERDRIVE_ELECTRIC", "AudioController", "sawtooth 110→2200Hz rising zap + noise", (e) => {
  sweepTone({ wave: "sawtooth", freq: 110, freqEnd: 2200, peak: 0.28, dur: 0.28 }, e);
  noiseBurst({ peak: 0.18, dur: 0.12 }, e);
});

// OVERDRIVE_EARTH: sub sine 55→28Hz crack + low bandpass noise. Filter dropped.
addSound("OVERDRIVE_EARTH", "AudioController", "sub sine 55→28Hz crack + low noise", (e) => {
  sweepTone({ wave: "sine", freq: 55, freqEnd: 28, peak: 0.65, dur: 0.55 }, e);
  noiseBurst({ peak: 0.5, dur: 0.38 }, e);
});

// START_CHIME (playStartChime): sine 220→330Hz rising fifth + sine 880→1100Hz shimmer.
addSound("START_CHIME", "AudioController", "rising fifth sine 220→330 + shimmer 880→1100", (e) => {
  sweepTone({ wave: "sine", freq: 220, freqEnd: 330, peak: 0.22, dur: 0.9 }, e);
  sweepTone({ wave: "sine", freq: 880, freqEnd: 1100, peak: 0.08, dur: 0.55 }, e);
});

// ── SKIPPED sounds (identity depends on filter sweep / LFO / delay / real-time loop) ──
// These are listed but NOT built — the simple tone/noise renderer can't carry their character.
const SKIPPED = [
  ["AMBIENT_VOID", "SoundManager", "40Hz sine + 0.07Hz LFO wobble + LOOPED 4s lowpass(120Hz) noise; identity = the slow LFO breathing + heavy lowpass texture, neither of which the renderer can express. Also non-terminating (looped)."],
  ["PHASE_SHIFT", "AudioController", "bandpass noise whose center sweeps 200Hz→8kHz over 0.65s (Q=7) = the whole 'portal whoosh' character; a raw un-filtered noise burst would just be static. Sine undertone alone isn't the cue."],
  ["INTRO_AMBIENT", "AudioController", "3 sine pad oscillators (55/65.4/82.4Hz) → 150Hz lowpass → 0.38s feedback-delay 'reverb'; identity = the delay/feedback space + filter open sweep. Persistent/looped, not a finite one-shot."],
  ["THRUM", "AudioController", "persistent speed-reactive sawtooth→lowpass drone; parametric & continuous (no fixed duration) — not a discrete cue."],
  ["WELL_PULL", "AudioController", "persistent gravity-well sub-bass drone, intensity-driven & smoothed; parametric & continuous — not a discrete cue."],
  ["BEAT (kick/snare/hihat pattern)", "AudioController", "140-BPM lookahead-scheduled industrial pattern with speed-reactive lowpass bus + gated layers; a continuous evolving loop, not a single bakeable clip. (Individual kick/snare/hat hits could be baked, but the 'beat' asset is the reactive sequence.)"],
];

// ── run ──────────────────────────────────────────────────────────────────────────
console.log(`${DRY ? "[dry-run] " : ""}Storm-Break audio → Crucible project "${SLUG}" (${base}/api/import)`);
console.log(`${CATALOG.length} sounds to import, ${SKIPPED.length} skipped as too-complex.\n`);

let ok = 0, fail = 0;
for (const s of CATALOG) {
  const wav = renderWav(s.recipe);
  const label = s.name;
  const artKitId = "audio." + s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const durSec = s.recipe.events.reduce((m, ev) => Math.max(m, ev.startSec + ev.durationSec), 0);

  if (DRY) {
    console.log(
      `  would import  ${label.padEnd(20)} ${artKitId.padEnd(24)} ${wav.length.toString().padStart(6)} B  ${durSec.toFixed(2)}s  (${s.recipe.events.length} events)`
    );
    console.log(`                └─ ${s.source}: ${s.note}`);
    ok++;
    continue;
  }

  try {
    const res = await fetch(`${base}/api/import`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        projectSlug: SLUG,
        type: "other",
        label,
        artKitId,
        dataBase64: Buffer.from(wav).toString("base64"),
        mimeType: "audio/wav",
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${out.error ?? JSON.stringify(out)}`);
    console.log(`  ok  ${label.padEnd(20)} → ${out.url}`);
    ok++;
  } catch (err) {
    console.warn(`  FAIL ${label} — ${err.message}`);
    fail++;
  }
}

console.log(`\nSKIPPED (too complex for the simple tone/noise renderer):`);
for (const [name, src, why] of SKIPPED) console.log(`  - ${name} (${src}): ${why}`);

console.log(
  `\n${DRY ? "[dry-run] " : ""}done: ${ok} ${DRY ? "to import" : "imported"}, ${fail} failed, ${SKIPPED.length} skipped.`
);
if (DRY) console.log("Re-run with --run to render each WAV + POST to /api/import.");
