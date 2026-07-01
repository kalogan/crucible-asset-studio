// Import Deceive Me Daddy's SYNTHESIZED sounds into Crucible as AUDIO reference assets.
//
// Deceive Me Daddy has NO audio files — its sounds are Web-Audio synth defined in code
// (packages/client/src/audio/AudioEngine.ts, dispatched by audioEvents.ts). This script
// translates each ONE-SHOT sound into a Crucible AudioRecipe (tones + noise + envelope),
// renders it to a 16-bit PCM mono WAV with the SAME pure renderSamples/encodeWav math as
// lib/pipeline/audio.ts (reimplemented INLINE below — the renderer is dependency-free),
// base64-encodes it, and POSTs it to /api/import as a reference asset on project
// "deceive-me-daddy".
//
//   pnpm import-deceive-audio            # DRY-RUN: list what would import (no writes) — the default
//   pnpm import-deceive-audio --run      # actually render + POST each WAV
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
// ramps, LFOs, delay/feedback, or looping. Deceive Me Daddy's sounds use several of those. So
// these recipes are APPROXIMATIONS of the game's cues, not bit-exact captures:
//   • Frequency sweeps (freq → freqEnd)  → approximated as a short chain of stepped tones.
//   • Exponential gain decays            → approximated as a short chain of gain-stepped events.
//   • Lowpass/highpass-filtered noise     → rendered as raw white-noise bursts (unfiltered);
//                                           the burst's gain/duration convey the "shape", not
//                                           the timbre. Good enough for a reference cue.
// Sounds whose identity IS a bandpass/lowpass sweep, an LFO drone, or a looped bed are SKIPPED
// and listed at the end — those would need an in-browser export harness in the game.

const args = process.argv.slice(2);
const DRY = !args.includes("--run");

const token = process.env.CRUCIBLE_IMPORT_TOKEN;
if (!token) {
  console.error("Set CRUCIBLE_IMPORT_TOKEN in .env.local (the /api/import bearer token).");
  process.exit(1);
}
const base = process.env.CRUCIBLE_APP_URL || "http://localhost:3000";
const SLUG = "deceive-me-daddy";
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
// The game's synths use exponential freq ramps + exponential gain decays, which the Crucible
// renderer can't express directly. We decompose them into a chain of short stepped events that
// trace the same curve. STEPS controls resolution (higher = smoother, bigger WAV).

const STEPS = 12;

/** Geometric interpolation start→end across n steps (matches exponentialRampToValueAtTime). */
function geom(start, end, i, n) {
  const s = Math.max(start, 1e-4);
  const e = Math.max(end, 1e-4);
  return s * Math.pow(e / s, i / Math.max(1, n));
}

/**
 * A tone with an exponential freq sweep (freq→freqEnd) and an exponential gain decay from
 * `peak` to ~0 over `dur`, approximated as STEPS contiguous flat sub-events. `startSec` offsets
 * the whole chain. Mirrors the AudioEngine's fast-attack / exp-decay one-shot shape.
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

/** A sustained tone that rises to `peak` then holds — used for staggered chord/arp notes. */
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

// ── the Deceive Me Daddy sound catalog → Crucible recipes ────────────────────────
// Each entry: { name, source, note, build(events) }. Peak gains mirror the AudioEngine's
// per-synth exponentialRampToValueAtTime targets (each synth's own gain; the game's SFX_GAIN
// bus ceiling is folded into masterGain below).

const CATALOG = [];
function addSound(name, source, note, build) {
  const events = [];
  build(events);
  CATALOG.push({ name, source, note, recipe: { sampleRate: SAMPLE_RATE, masterGain: 0.9, events } });
}

// ── playSfx one-shots (AudioEngine.ts) ───────────────────────────────────────────

// FIRE (synthFire): bandpass noise 2400→600Hz, snap attack, 0.22s decay. Bandpass dropped →
// raw noise burst (percussive "pew" shape preserved via the fast decay, like IMPACT_WALL).
addSound("FIRE", "AudioEngine.synthFire", "bandpass-noise zap 2400→600Hz (filter approximated as raw burst)", (e) => {
  noiseBurst({ peak: 0.9, dur: 0.22 }, e);
});

// HIT (synthHit): sine 180→50Hz thud + lowpass-noise click. Sine sweep + short raw-noise tick.
addSound("HIT", "AudioEngine.synthHit", "sine 180→50Hz thud + noise impact click", (e) => {
  sweepTone({ wave: "sine", freq: 180, freqEnd: 50, peak: 0.9, dur: 0.25 }, e);
  noiseBurst({ peak: 0.5, dur: 0.06 }, e);
});

// REVEAL (synthReveal): two detuned sawtooth (440/466Hz minor-2nd clash) pulsing twice — the
// classic "bwa-bwa" alarm. No filter → clean; the two 0.15s pulses are rebuilt explicitly.
addSound("REVEAL", "AudioEngine.synthReveal", "alarm sting: sawtooth 440+466Hz minor-2nd, two pulses", (e) => {
  for (let p = 0; p < 2; p++) {
    const on = p * 0.18;
    [440, 466].forEach((freq) => {
      sweepTone({ wave: "sawtooth", freq, freqEnd: freq, peak: 0.8, dur: 0.15, startSec: on }, e);
    });
  }
});

// INTEL (synthIntel): square E5→B5 (659.25/987.77Hz) rising fifth, two staggered blips.
addSound("INTEL", "AudioEngine.synthIntel", "square E5→B5 rising-fifth two-note blip", (e) => {
  [659.25, 987.77].forEach((freq, idx) => {
    const on = idx * 0.09;
    tone({ wave: "square", freq, peak: 0.4, dur: 0.02, startSec: on }, e);
    sweepTone({ wave: "square", freq, freqEnd: freq, peak: 0.4, dur: 0.12, startSec: on + 0.02 }, e);
  });
});

// KEYCARD (synthKeycard): highpass-noise click + square 880Hz confirm blip. Filter dropped →
// short raw-noise tick, then a clean tone.
addSound("KEYCARD", "AudioEngine.synthKeycard", "mechanical noise click + square 880Hz confirm blip", (e) => {
  noiseBurst({ peak: 0.5, dur: 0.03 }, e);
  tone({ wave: "square", freq: 880, peak: 0.3, dur: 0.02, startSec: 0.04 }, e);
  sweepTone({ wave: "square", freq: 880, freqEnd: 880, peak: 0.3, dur: 0.1, startSec: 0.06 }, e);
});

// VAULT_OPEN (synthVaultOpen): A1/E2/A2 sawtooth open-fifth chord settling from ×1.5 down to
// root over 0.4s, through a resonant lowpass (Q=8), 1.4s decay. Resonant lowpass dropped.
addSound("VAULT_OPEN", "AudioEngine.synthVaultOpen", "sawtooth A1-E2-A2 open-fifth boom settling ×1.5→root, 1.4s decay (resonant lowpass dropped)", (e) => {
  [55, 82.5, 110].forEach((hz) => {
    // settle portion: hz*1.5 → hz over first 0.4s
    const settleSteps = 8;
    for (let i = 0; i < settleSteps; i++) {
      const f = geom(hz * 1.5, hz, i, settleSteps);
      e.push({ type: "tone", wave: "sawtooth", freq: f, startSec: (i * 0.4) / settleSteps, durationSec: 0.4 / settleSteps, gain: 0.5 });
    }
    // sustain + exp decay tail 0.4 → 1.4s
    sweepTone({ wave: "sawtooth", freq: hz, freqEnd: hz, peak: 0.5, dur: 1.0, startSec: 0.4 }, e);
  });
});

// WIN (synthWin): C5-E5-G5-C6 triangle major fanfare, staggered 0.11s, each note ~0.5s ring.
addSound("WIN", "AudioEngine.synthWin", "triangle C5-E5-G5-C6 major fanfare arpeggio", (e) => {
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
    const on = idx * 0.11;
    tone({ wave: "triangle", freq, peak: 0.5, dur: 0.02, startSec: on }, e);
    sweepTone({ wave: "triangle", freq, freqEnd: freq, peak: 0.5, dur: 0.5, startSec: on + 0.02 }, e);
  });
});

// DOWNED (synthDowned): sawtooth 220→55Hz long sinking glissando through a static 800Hz lowpass,
// 1.0s decay. Lowpass dropped (static, not the identity); the gliss + decay carry the cue.
addSound("DOWNED", "AudioEngine.synthDowned", "sawtooth 220→55Hz sinking glissando, 1.0s decay (static lowpass dropped)", (e) => {
  sweepTone({ wave: "sawtooth", freq: 220, freqEnd: 55, peak: 0.5, dur: 1.0 }, e);
});

// REVIVE (synthRevive): sine E4-A4-D5 (329.63/440/587.33Hz) rising lift, staggered 0.1s.
addSound("REVIVE", "AudioEngine.synthRevive", "sine E4-A4-D5 rising hopeful lift", (e) => {
  [329.63, 440, 587.33].forEach((freq, idx) => {
    const on = idx * 0.1;
    tone({ wave: "sine", freq, peak: 0.45, dur: 0.04, startSec: on }, e);
    sweepTone({ wave: "sine", freq, freqEnd: freq, peak: 0.45, dur: 0.45, startSec: on + 0.04 }, e);
  });
});

// ABILITY (synthAbility): bandpass-noise sweep 800→4000Hz + a clean sawtooth 200→1200Hz body,
// 0.5s. The bandpass sweep is dropped to a raw noise burst; the sawtooth sweep body is kept
// (it's a real oscillator, not filter-dependent), so the "powering up" character survives.
addSound("ABILITY", "AudioEngine.synthAbility", "tech power-up: sawtooth 200→1200Hz sweep body + rising noise (bandpass sweep → raw burst)", (e) => {
  sweepTone({ wave: "sawtooth", freq: 200, freqEnd: 1200, peak: 0.25, dur: 0.45 }, e);
  noiseBurst({ peak: 0.3, dur: 0.5 }, e);
});

// UI_TICK (synthUiTick): triangle 1180→1480Hz upward pip, snap envelope, 0.07s. Clean.
addSound("UI_TICK", "AudioEngine.synthUiTick", "triangle 1180→1480Hz crisp menu pip", (e) => {
  sweepTone({ wave: "triangle", freq: 1180, freqEnd: 1480, peak: 0.16, dur: 0.07 }, e);
});

// FOOTSTEP (playFootstep): lowpass-noise scuff 520→180Hz, soft snap, 0.07s. Filter dropped →
// short raw-noise burst (a muffled scuff shape). Baked at nominal gain (speed scaling is runtime).
addSound("FOOTSTEP", "AudioEngine.playFootstep", "muffled noise scuff (lowpass 520→180Hz approximated as raw burst)", (e) => {
  noiseBurst({ peak: 0.14, dur: 0.07 }, e);
});

// KICK (synthKick): sine 90→40Hz resonant thump, 0.18s decay — a discrete groove hit that's a
// clean bakeable one-shot on its own (the reactive BEAT sequence it belongs to is skipped).
addSound("KICK", "AudioEngine.synthKick", "sine 90→40Hz soft kick thump (single groove hit)", (e) => {
  sweepTone({ wave: "sine", freq: 90, freqEnd: 40, peak: 0.28, dur: 0.18 }, e);
});

// ── SKIPPED sounds (identity depends on a filter sweep / LFO / looped bed / reactive sequence) ──
// These are listed but NOT built — the simple tone/noise renderer can't carry their character.
const SKIPPED = [
  ["DISGUISE (synthDisguise)", "AudioEngine", "bandpass noise whose centre SWEEPS 300→3000Hz (Q=3) over 0.5s = the whole 'whoosh up into a new identity' character; a raw un-filtered noise burst would just be a static hiss, losing the rising-sweep cue entirely."],
  ["AMBIENT beds: menu / match / club / beach / lounge / tension", "AudioEngine.startAmbient", "each is a LOOPED detuned-oscillator drone through a lowpass that a slow LFO breathes open/closed (0.05–0.2Hz), plus timer-scheduled arps and grooves. Non-terminating (looped) and identity = the LFO breathing + filter texture — none of which the renderer expresses."],
  ["BEAT groove (synthHat / synthShaker / synthBass sequence)", "AudioEngine.startAmbient", "a BPM-scheduled, speed-reactive kick/hat/bass pattern (a continuous evolving loop with highpass-noise hats + resonant-lowpass pluck bass), not a single bakeable clip. The KICK hit alone is baked above; hats/shaker are highpass-noise (filter identity) and the bass is a resonant-lowpass filter pluck — both dropped as filter-dependent."],
];

// ── run ──────────────────────────────────────────────────────────────────────────
console.log(`${DRY ? "[dry-run] " : ""}Deceive Me Daddy audio → Crucible project "${SLUG}" (${base}/api/import)`);
console.log(`${CATALOG.length} sounds to import, ${SKIPPED.length} skipped as too-complex.\n`);

let ok = 0, fail = 0;
for (const s of CATALOG) {
  const wav = renderWav(s.recipe);
  const label = s.name;
  const artKitId = "audio." + s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const durSec = s.recipe.events.reduce((m, ev) => Math.max(m, ev.startSec + ev.durationSec), 0);

  if (DRY) {
    console.log(
      `  would import  ${label.padEnd(12)} ${artKitId.padEnd(16)} ${wav.length.toString().padStart(6)} B  ${durSec.toFixed(2)}s  (${s.recipe.events.length} events)`
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
    console.log(`  ok  ${label.padEnd(12)} → ${out.url}`);
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
