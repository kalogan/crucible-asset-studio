// Import Woodturning Studio's SYNTHESIZED sounds into Crucible as AUDIO reference assets.
//
// Woodturning Studio has NO audio files — its sounds are Web-Audio synth defined in code
// (src/client/audio/sfxRegistry.ts one-shot factories + footsteps.ts). This script translates
// each DISCRETE cue into a Crucible AudioRecipe (tones + noise + envelope), renders it to a
// 16-bit PCM mono WAV with the SAME pure renderSamples/encodeWav math as lib/pipeline/audio.ts
// (reimplemented INLINE below — the renderer is dependency-free), base64-encodes it, and POSTs
// it to /api/import as a reference_asset on project "woodturning-studio".
//
//   pnpm import-woodturning-audio          # DRY-RUN: list what would import (no writes) — default
//   pnpm import-woodturning-audio --run     # actually render + POST each WAV
//
// Idempotent: the endpoint re-syncs by storage path (upsert), so re-running --run overwrites the
// same assets rather than duplicating them.
//
// Env (.env.local): CRUCIBLE_IMPORT_TOKEN (the /api/import bearer). Target overridable with
// CRUCIBLE_APP_URL (default http://localhost:3000).
//
// ── FIDELITY NOTE ────────────────────────────────────────────────────────────────
// Crucible's renderer is deliberately simple: naive oscillators + RAW white noise, a fixed
// ~10 ms attack/release envelope (flat sustain between), and NO biquad filters, frequency
// ramps, LFOs, delay/feedback, or looping. Woodturning's cues use bandpass/highpass-filtered
// noise + ADSR envelopes. So these recipes are APPROXIMATIONS of the game's cues, not bit-exact
// captures:
//   • ADSR gain envelopes                 → approximated by the event's flat gain over its
//                                           duration (renderer applies its own short A/R fade).
//   • Bandpass/lowpass-filtered noise      → rendered as raw white-noise bursts (unfiltered);
//                                           the burst's gain/duration convey the "shape", not
//                                           the timbre. Good enough for a reference cue.
// Sounds whose identity is a CONTINUOUS, parametric, filter-swept drone (the lathe motor whir,
// the cutting hiss, the ambient room bed) are SKIPPED and listed at the end — those are not
// discrete one-shot clips and the simple renderer can't carry their character.

const args = process.argv.slice(2);
const DRY = !args.includes("--run");

const token = process.env.CRUCIBLE_IMPORT_TOKEN;
if (!token) {
  console.error("Set CRUCIBLE_IMPORT_TOKEN in .env.local (the /api/import bearer token).");
  process.exit(1);
}
const base = process.env.CRUCIBLE_APP_URL || "http://localhost:3000";
const SLUG = "woodturning-studio";
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
// Woodturning's synth uses playTone (oscillator + ADSR) and playNoise (bandpass-filtered noise
// burst with fade in/out). The Crucible renderer has neither ADSR nor filters, so:
//   • a playTone → one flat "tone" event at its `gain` over its `duration` (renderer adds its
//     own ~10 ms attack/release so it doesn't click). ADSR shape is not reproduced.
//   • a playNoise → one flat "noise" event at its `gain` over its `duration`. The bandpass/
//     highpass filter is DROPPED (raw white noise); gain/duration convey the shape only.

/** A single oscillator tone, flat gain over its duration. Mirrors synth.playTone (ADSR flattened). */
function tone({ wave, freq, gain, dur, startSec = 0 }, events) {
  events.push({ type: "tone", wave, freq, startSec, durationSec: dur, gain });
}

/** A single white-noise burst, flat gain over its duration. Mirrors synth.playNoise (filter dropped). */
function noise({ gain, dur, startSec = 0 }, events) {
  events.push({ type: "noise", startSec, durationSec: dur, gain });
}

// ── the Woodturning sound catalog → Crucible recipes ─────────────────────────────
// Each entry: { name, source, note, build(events) }. Cues are baked at their nominal
// full-intensity parameters (the loudest/representative form) so the reference asset is
// the canonical cue.

const CATALOG = [];
function addSound(name, source, note, build) {
  const events = [];
  build(events);
  CATALOG.push({ name, source, note, recipe: { sampleRate: SAMPLE_RATE, masterGain: 0.9, events } });
}

// ── sfxRegistry.ts one-shot factories ────────────────────────────────────────────

// tool.grab: high triangle 1200Hz metallic click, 0.12s quick-decay ADSR.
addSound("tool.grab", "sfxRegistry", "metallic triangle click 1200Hz (pick up a turning tool)", (e) => {
  tone({ wave: "triangle", freq: 1200, gain: 0.4, dur: 0.12 }, e);
});

// tool.select: soft sine pluck 320Hz, 0.10s. Change the active tool.
addSound("tool.select", "sfxRegistry", "soft woody sine pluck 320Hz (change active tool)", (e) => {
  tone({ wave: "sine", freq: 320, gain: 0.3, dur: 0.1 }, e);
});

// part.snap: two overlapping tones — square 180Hz thunk + triangle 540Hz tick.
addSound("part.snap", "sfxRegistry", "square 180Hz thunk + triangle 540Hz tick (assembly part snaps in)", (e) => {
  tone({ wave: "square", freq: 180, gain: 0.35, dur: 0.15 }, e);
  tone({ wave: "triangle", freq: 540, gain: 0.2, dur: 0.08 }, e);
});

// control.tighten: ratchet-like bandpass(800Hz,Q8) noise burst, 0.07s. Filter dropped → raw burst.
addSound("control.tighten", "sfxRegistry", "ratchet noise burst 0.07s (tighten bolt/chuck key) — bandpass approximated as raw", (e) => {
  noise({ gain: 0.25, dur: 0.07 }, e);
});

// footstep (registry stub): lowpass(120Hz) noise thud + 60Hz sine sub, 0.12s. Filter dropped.
addSound("footstep", "sfxRegistry", "dull wood-floor thud: low noise + 60Hz sine sub — filter approximated as raw", (e) => {
  noise({ gain: 0.3, dur: 0.12 }, e);
  tone({ wave: "sine", freq: 60, gain: 0.2, dur: 0.1 }, e);
});

// lathe.motor: brief motor-on BURST (startup/idle tick, NOT the sustained whir) — sawtooth 50Hz
// hum + light bandpass(2kHz) noise, 0.4s. A discrete one-shot; the continuous motor is skipped.
addSound("lathe.motor", "sfxRegistry", "brief motor-on burst: sawtooth 50Hz + light noise, 0.4s (startup/idle tick — NOT the sustained whir)", (e) => {
  tone({ wave: "sawtooth", freq: 50, gain: 0.25, dur: 0.4 }, e);
  noise({ gain: 0.08, dur: 0.4 }, e);
});

// cut (registry one-shot): a single gouge-engage cue — bandpass(3.5kHz) noise hiss + sawtooth
// 220Hz, 0.35s. This is the DISCRETE one-shot factory, distinct from the continuous cutting drone.
addSound("cut", "sfxRegistry", "single gouge-engage cue: noise hiss + sawtooth 220Hz, 0.35s (one-shot — NOT the continuous cutting drone)", (e) => {
  noise({ gain: 0.3, dur: 0.35 }, e);
  tone({ wave: "sawtooth", freq: 220, gain: 0.15, dur: 0.3 }, e);
});

// catch: jarring tool dig-in — loud bandpass(600Hz) noise burst + square 80Hz thud, 0.18s.
addSound("catch", "sfxRegistry", "jarring tool catch/dig-in: loud noise burst + square 80Hz thud, 0.18s", (e) => {
  noise({ gain: 0.6, dur: 0.18 }, e);
  tone({ wave: "square", freq: 80, gain: 0.4, dur: 0.15 }, e);
});

// ── footsteps.ts — deterministic left/right procedural footstep ───────────────────
// emitFootstep alternates timbre by step parity: EVEN foot = base, ODD foot = ×1.12 pitch,
// ×0.88 gain. Bake BOTH feet so the reference captures the left/right variation. Body is a
// lowpass-ish bandpass(130Hz) noise burst (filter dropped) + a 62Hz sine sub-thud, 0.11s.
addSound("footstep.left", "footsteps", "walk footstep, even foot: 130Hz noise burst + 62Hz sine sub, 0.11s (filter approximated as raw)", (e) => {
  noise({ gain: 0.16, dur: 0.11 }, e);
  tone({ wave: "sine", freq: 62, gain: 0.1, dur: 0.099 }, e);
});
addSound("footstep.right", "footsteps", "walk footstep, odd foot: ×1.12 pitch / ×0.88 gain variation (145.6Hz noise + 69.4Hz sub)", (e) => {
  noise({ gain: 0.16 * 0.88, dur: 0.11 }, e);
  tone({ wave: "sine", freq: 62 * 1.12, gain: 0.1 * 0.88, dur: 0.099 }, e);
});

// ── SKIPPED sounds (continuous / parametric / filter-swept drones — not discrete clips) ──
// These are listed but NOT built — they have no fixed duration and/or their identity is a
// filter sweep the simple tone/noise renderer can't express.
const SKIPPED = [
  ["cutting drone", "cutting.ts", "CONTINUOUS tool-on-wood texture: looped highpass(1.2–4kHz)-swept scrape noise + bandpass(1.2kHz) body, intensity-driven per-frame via setTargetAtTime. No fixed duration; identity = the intensity-swept filter texture. Not a discrete clip. (The DISCRETE 'cut' one-shot from sfxRegistry IS baked.)"],
  ["lathe motor whir", "continuous.ts", "CONTINUOUS three-layer motor: gated 80Hz hum + rpm-swept sine whir (60→380Hz) + bandpass bearing noise, driven per-frame by rpm. Parametric & non-terminating. Identity = the rising rpm sweep. (The DISCRETE 'lathe.motor' burst from sfxRegistry IS baked.)"],
  ["ambient room tone", "continuous.ts", "CONTINUOUS looped low-gain white noise through a ~200Hz lowpass — a barely-perceptible constant shop bed. Non-terminating loop, identity = the heavy lowpass texture. Not a one-shot cue."],
];

// ── run ──────────────────────────────────────────────────────────────────────────
console.log(`${DRY ? "[dry-run] " : ""}Woodturning Studio audio → Crucible project "${SLUG}" (${base}/api/import)`);
console.log(`${CATALOG.length} sounds to import, ${SKIPPED.length} skipped as continuous/parametric.\n`);

let ok = 0, fail = 0;
for (const s of CATALOG) {
  const wav = renderWav(s.recipe);
  const label = s.name;
  const artKitId = "audio." + s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const durSec = s.recipe.events.reduce((m, ev) => Math.max(m, ev.startSec + ev.durationSec), 0);

  if (DRY) {
    console.log(
      `  would import  ${label.padEnd(20)} ${artKitId.padEnd(26)} ${wav.length.toString().padStart(6)} B  ${durSec.toFixed(2)}s  (${s.recipe.events.length} events)`
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

console.log(`\nSKIPPED (continuous / parametric / filter-swept — not discrete one-shot clips):`);
for (const [name, src, why] of SKIPPED) console.log(`  - ${name} (${src}): ${why}`);

console.log(
  `\n${DRY ? "[dry-run] " : ""}done: ${ok} ${DRY ? "to import" : "imported"}, ${fail} failed, ${SKIPPED.length} skipped.`
);
if (DRY) console.log("Re-run with --run to render each WAV + POST to /api/import.");
