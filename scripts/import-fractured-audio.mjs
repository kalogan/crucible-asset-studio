// Import Fractured Domains' SYNTHESIZED sounds into Crucible as AUDIO reference assets.
//
// Fractured Domains has NO audio files — its sounds are Web-Audio synth defined in code
// (src/services/AudioSynth.ts + src/audio/MenuAmbience.ts + src/audio/AetherWoodsAudio.ts).
// This script translates each DISCRETE one-shot cue into a Crucible AudioRecipe (tones + noise
// + envelope), renders it to a 16-bit PCM mono WAV with the SAME pure renderSamples/encodeWav
// math as lib/pipeline/audio.ts (reimplemented INLINE below — the renderer is dependency-free),
// base64-encodes it, and POSTs it to /api/import as a reference_asset on project
// "fractured-domains".
//
//   pnpm import-fractured-audio          # DRY-RUN: list what would import (no writes) — the default
//   pnpm import-fractured-audio --run    # actually render + POST each WAV
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
// ramps, LFOs, delay/feedback, or looping. Fractured Domains' one-shot SFX use LINEAR freq
// ramps + linear gain fades; the BGM/ambience layers add filters, LFOs, feedback-delay and
// run as continuous loops. So these recipes are APPROXIMATIONS of the discrete cues, not
// bit-exact captures:
//   • Frequency ramps (freq → freqEnd)   → approximated as a short chain of stepped tones.
//   • Gain fade-to-zero                   → approximated as a short chain of gain-stepped events.
//   • setTimeout-staggered arpeggios      → laid out on the timeline via startSec offsets.
//   • RANDOMIZED pitches (playStep/Hit)   → baked at their NOMINAL (mid-range) value.
// Sounds that lean HARD on filtering/LFO/delay for their identity, or that are continuous
// looped drones/sequencers with no fixed duration, are SKIPPED and listed at the end — those
// would need an in-browser export harness in Fractured Domains (see report).

const args = process.argv.slice(2);
const DRY = !args.includes("--run");

const token = process.env.CRUCIBLE_IMPORT_TOKEN;
if (!token) {
  console.error("Set CRUCIBLE_IMPORT_TOKEN in .env.local (the /api/import bearer token).");
  process.exit(1);
}
const base = process.env.CRUCIBLE_APP_URL || "http://localhost:3000";
const SLUG = "fractured-domains";
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
// AudioSynth.tone() uses osc.frequency.linearRampToValueAtTime (freq→freqEnd) + a
// gain.linearRampToValueAtTime(0) fade over the whole duration. The Crucible renderer can't
// express either directly, so we decompose a tone into a chain of short stepped events that
// trace the same freq slide + linear fade. STEPS controls resolution (higher = smoother).

const STEPS = 12;

/** Linear interpolation start→end across n steps (matches linearRampToValueAtTime). */
function lerp(start, end, i, n) {
  return start + (end - start) * (i / Math.max(1, n));
}

/**
 * A tone matching AudioSynth.tone(): starts at `peak` gain and LINEARLY fades to 0 over `dur`,
 * with an optional LINEAR freq slide freq→freqEnd. Approximated as STEPS contiguous flat
 * sub-events. `startSec` offsets the whole chain.
 */
function tone({ wave, freq, freqEnd = freq, peak, dur, startSec = 0 }, events) {
  const step = dur / STEPS;
  for (let i = 0; i < STEPS; i++) {
    const f = lerp(freq, freqEnd, i + 0.5, STEPS);
    const g = peak * (1 - i / STEPS); // linear fade to 0 (mirrors linearRampToValueAtTime(0))
    if (g <= 0.001) break;
    events.push({ type: "tone", wave, freq: f, startSec: startSec + i * step, durationSec: step, gain: g });
  }
}

/**
 * A percussive note with an ADSR-ish decay (MenuAmbience.pluck / AetherWoods.chime): fast attack
 * to `peak`, then decay toward ~0 across `dur`. Approximated as an exponential-ish gain ramp
 * down over STEPS flat sub-events at a fixed frequency. `startSec` offsets the chain.
 */
function pluck({ wave, freq, peak, dur, startSec = 0 }, events) {
  const step = dur / STEPS;
  for (let i = 0; i < STEPS; i++) {
    const g = peak * Math.pow(0.0006 / 1, i / STEPS); // fast exp decay toward silence
    if (g <= 0.001) break;
    events.push({ type: "tone", wave, freq, startSec: startSec + i * step, durationSec: step, gain: g });
  }
}

// ── the Fractured Domains sound catalog → Crucible recipes ────────────────────────
// Each entry: { name, source, note, build(events) }. RANDOMIZED-pitch cues are baked at their
// nominal mid-range value so the reference asset is a stable, representative capture.

const CATALOG = [];
function addSound(name, source, note, build) {
  const events = [];
  build(events);
  CATALOG.push({ name, source, note, recipe: { sampleRate: SAMPLE_RATE, masterGain: 0.9, events } });
}

// ── AudioSynth.ts — discrete SFX (one-shot .tone() calls) ─────────────────────────

// playStep: triangle 80..120Hz random, 0.05s, vol 0.08. Baked at nominal 100Hz.
addSound("STEP", "AudioSynth", "footstep — triangle ~100Hz (random 80-120), 0.05s (nominal pitch)", (e) => {
  tone({ wave: "triangle", freq: 100, peak: 0.08, dur: 0.05 }, e);
});

// playHit: sawtooth (350..450 random)→80Hz slide, 0.12s, vol 0.25. Baked at nominal 400Hz.
addSound("HIT", "AudioSynth", "melee hit — sawtooth 400→80Hz slide, 0.12s (nominal start pitch)", (e) => {
  tone({ wave: "sawtooth", freq: 400, freqEnd: 80, peak: 0.25, dur: 0.12 }, e);
});

// playMiss: square 200Hz, 0.06s, vol 0.1.
addSound("MISS", "AudioSynth", "whiff — square 200Hz, 0.06s", (e) => {
  tone({ wave: "square", freq: 200, peak: 0.1, dur: 0.06 }, e);
});

// playPickup: sine 660Hz then sine 880Hz (+60ms), each 0.05s, vol 0.2.
addSound("PICKUP", "AudioSynth", "item pickup — sine 660Hz then 880Hz (staggered 60ms), 0.05s each", (e) => {
  tone({ wave: "sine", freq: 660, peak: 0.2, dur: 0.05, startSec: 0 }, e);
  tone({ wave: "sine", freq: 880, peak: 0.2, dur: 0.05, startSec: 0.06 }, e);
});

// playError: square 110Hz, 0.15s, vol 0.2.
addSound("ERROR", "AudioSynth", "error buzz — square 110Hz, 0.15s", (e) => {
  tone({ wave: "square", freq: 110, peak: 0.2, dur: 0.15 }, e);
});

// playGold: triangle 880 / 1100 / 1320Hz arpeggio, staggered 0/50/110ms, durs 0.05/0.08/0.10, vol 0.15.
addSound("GOLD", "AudioSynth", "coin — triangle 880/1100/1320Hz arpeggio (staggered 0/50/110ms)", (e) => {
  tone({ wave: "triangle", freq: 880, peak: 0.15, dur: 0.05, startSec: 0 }, e);
  tone({ wave: "triangle", freq: 1100, peak: 0.15, dur: 0.08, startSec: 0.05 }, e);
  tone({ wave: "triangle", freq: 1320, peak: 0.15, dur: 0.1, startSec: 0.11 }, e);
});

// playDeath: sawtooth 200→40Hz slide, 0.3s, vol 0.3.
addSound("DEATH", "AudioSynth", "death — sawtooth 200→40Hz downward slide, 0.3s", (e) => {
  tone({ wave: "sawtooth", freq: 200, freqEnd: 40, peak: 0.3, dur: 0.3 }, e);
});

// playVictory: square C5/E5/G5/C6 (523/659/784/1047), staggered 180ms, 0.2s each, vol 0.3.
addSound("VICTORY", "AudioSynth", "victory fanfare — square C5-E5-G5-C6 arpeggio (staggered 180ms)", (e) => {
  [523, 659, 784, 1047].forEach((freq, i) => {
    tone({ wave: "square", freq, peak: 0.3, dur: 0.2, startSec: i * 0.18 }, e);
  });
});

// ── MenuAmbience.ts — the ONE discrete, filter-free note ──────────────────────────
// The sequencer itself is a looped, randomized, (modern-mode) delay-fed motif → SKIPPED.
// Its classic/oldschool fallback is a single pure-tone blip (square 220Hz), a discrete ADSR
// pluck with NO filter/delay — bakeable as a representative "menu blip" cue.

// pluck(220, 0.25, 'square'): ADSR A0.01/D0.1/S0.1/R0.2 (~0.5s), peak 0.25.
addSound("MENU_BLIP", "MenuAmbience", "menu step blip (classic tier) — square 220Hz ADSR pluck, ~0.5s", (e) => {
  pluck({ wave: "square", freq: 220, peak: 0.25, dur: 0.5 }, e);
});

// ── AetherWoodsAudio.ts — the ONE discrete, filter-free note ───────────────────────
// The full soundscape (bandpass+LFO breeze, feedback-delay tail, looped pulse/chime timers) →
// SKIPPED. Its classic/oldschool chime is a single pure-tone bell (square 220Hz, 0.4s release,
// peak 0.15) with NO filter/delay — bakeable as a representative "woods chime" cue.

// chime() classic: square 220Hz, fast attack + 0.4s release, peak 0.15 (root of A-minor pentatonic).
addSound("WOODS_CHIME", "AetherWoodsAudio", "aether woods chime (classic tier) — square 220Hz bell, ~0.45s", (e) => {
  pluck({ wave: "square", freq: 220, peak: 0.15, dur: 0.45 }, e);
});

// ── SKIPPED sounds (continuous loops or identity depends on filter/LFO/delay) ──────
// These are listed but NOT built — the simple tone/noise renderer can't carry their character,
// or they are non-terminating loops with no fixed duration.
const SKIPPED = [
  ["startSplashDrone", "AudioSynth", "two detuned sub-bass sines (42/56Hz) with a 0.35Hz LFO tremolo, faded in over 2s and held until stopped; identity = the slow breathing LFO on a sustained drone. Continuous (no fixed duration) + LFO the renderer can't express."],
  ["playBiomeTheme (all biomes)", "AudioSynth", "looping BGM: detuned saws / high sines a 5th apart / triads, most routed through a lowpass biquad and modulated by 0.1-0.15Hz LFOs (overworld also mixes lowpass-filtered looping white-noise 'wind'). Continuous drones, filter + LFO driven — not finite one-shots."],
  ["playDeathAmbient", "AudioSynth", "A-minor dirge (55/55.4/65.4/82.4Hz) through a 320Hz lowpass with a 0.12Hz tremolo LFO, swelled over 2.5s and LOOPED via the BGM engine; identity = the dark lowpass + slow beating. Continuous + filter/LFO."],
  ["playShopTheme", "AudioSynth", "warm A-major triad (220/277/330Hz) with a ~4Hz tremolo LFO on the track gain, looped; identity = the tremolo. Continuous + LFO."],
  ["MenuAmbience sequencer", "MenuAmbience", "8-step 120-BPM random-note sequencer over a natural-minor scale, accents every 4th beat, drops a sub-bass thud on beat 1, and (modern mode) feeds the melody through a 0.375s feedback delay. A live evolving loop, not a single bakeable clip. (The individual classic blip IS baked as MENU_BLIP.)"],
  ["AetherWoods soundscape", "AetherWoodsAudio", "living loop: ~100-BPM lowpass-filtered noise heartbeat 'pulse' + cascading arpeggio through a bandpass swept by a 0.07Hz LFO ('breeze') + a feedback-delay tail. Continuous, filter/LFO/delay driven. (The classic pure-tone chime IS baked as WOODS_CHIME; the lowpass 'pulse' thud is dropped — its identity is the 200Hz lowpass.)"],
];

// ── run ──────────────────────────────────────────────────────────────────────────
console.log(`${DRY ? "[dry-run] " : ""}Fractured Domains audio → Crucible project "${SLUG}" (${base}/api/import)`);
console.log(`${CATALOG.length} sounds to import, ${SKIPPED.length} skipped as too-complex.\n`);

let ok = 0, fail = 0;
for (const s of CATALOG) {
  const wav = renderWav(s.recipe);
  const label = s.name;
  const artKitId = "audio." + s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const durSec = s.recipe.events.reduce((m, ev) => Math.max(m, ev.startSec + ev.durationSec), 0);

  if (DRY) {
    console.log(
      `  would import  ${label.padEnd(14)} ${artKitId.padEnd(20)} ${wav.length.toString().padStart(6)} B  ${durSec.toFixed(2)}s  (${s.recipe.events.length} events)`
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
    console.log(`  ok  ${label.padEnd(14)} → ${out.url}`);
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
