// Import project-mmo (Wayfinders)'s SYNTHESIZED sounds into Crucible as AUDIO reference assets.
//
// Wayfinders has NO audio files — every SFX is Web-Audio-adjacent OFFLINE synth, defined in code
// (packages/client/src/audio/generators.ts + dsp.ts). Each sound is a deterministic
// `(seed) => RenderedBuffer` built from layered "partials" (osc + freq-glide + ADSR + one-pole /
// resonant lowpass + FM + detune-chorus + vibrato) and seeded white-noise bursts, then normalized
// with a tanh warmth guard. This script translates each DISCRETE ONE-SHOT cue into a Crucible
// AudioRecipe (plain tones + raw noise bursts + a fixed ~10 ms attack/release), renders it to a
// 16-bit PCM mono WAV with the SAME pure renderSamples/encodeWav math as lib/pipeline/audio.ts
// (reimplemented INLINE below — dependency-free), base64-encodes it, and POSTs it to /api/import
// as a reference_asset (type "other") on project "wayfinders".
//
//   pnpm import-mmo-audio            # DRY-RUN: list what would import (no writes) — the default
//   pnpm import-mmo-audio --run      # actually render + POST each WAV
//
// Idempotent: the endpoint re-syncs by artKitId (upsert on the storage path), so re-running
// --run overwrites the same assets rather than duplicating them.
//
// Env (.env.local): CRUCIBLE_IMPORT_TOKEN (the /api/import bearer). Target overridable with
// CRUCIBLE_APP_URL (default http://localhost:3000).
//
// ── FIDELITY NOTE ────────────────────────────────────────────────────────────────
// Wayfinders' offline DSP is FAR richer than Crucible's reference renderer. Crucible's renderer is
// deliberately simple: naive oscillators (sine/square/sawtooth/triangle) + RAW white noise, a fixed
// ~10 ms attack/release envelope (flat sustain between), and NO biquad/resonant filters, frequency
// glides, FM, vibrato, detune-chorus, ADSR-with-hold, LFOs, or looping. So these recipes are
// APPROXIMATIONS of the game's cues, not bit-exact captures:
//   • Linear freq glides (freqStart→freqEnd)  → a short chain of stepped flat tones tracing the glide.
//   • ADSR + tanh-normalized decays           → a short chain of gain-stepped events (exp-ish fade).
//   • Lowpass/resonant/FM-coloured partials    → rendered as plain tones at the partial's pitch (the
//                                                filter/FM timbre is dropped; pitch + envelope survive).
//   • softsquare / softsaw waves               → mapped to the plain square / sawtooth oscillators.
//   • Filtered/coloured noise bursts           → RAW white-noise bursts (unfiltered); the burst's
//                                                gain/duration convey the "shape", not the timbre.
//   • Seed-random params (rng.range/pick)      → baked at a fixed NOMINAL value (≈ the range midpoint
//                                                / default choice), so the reference asset is stable.
// Sounds whose IDENTITY is the LFO-swelled filtered-noise field, the sequenced music loop, or that
// are LOOPING/non-terminating are SKIPPED and listed at the end — those need an in-browser export
// harness in Wayfinders (offline-render the RenderedBuffer straight to WAV), not this approximator.

const args = process.argv.slice(2);
const DRY = !args.includes("--run");

const token = process.env.CRUCIBLE_IMPORT_TOKEN;
if (!token) {
  console.error("Set CRUCIBLE_IMPORT_TOKEN in .env.local (the /api/import bearer token).");
  process.exit(1);
}
const base = process.env.CRUCIBLE_APP_URL || "http://localhost:3000";
const SLUG = "wayfinders";
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
// Wayfinders' partials use LINEAR freq glides + smooth ADSR (attack→decay→sustain→release), which
// the Crucible renderer can't express directly. We decompose them into a chain of short stepped
// events that trace the same curve. STEPS controls resolution (higher = smoother, bigger WAV).
// Every seed-random parameter is baked at a fixed NOMINAL value so the reference asset is stable.

const STEPS = 12;

/** Waveform map: Wayfinders' softsquare/softsaw → Crucible's plain square/sawtooth. */
function mapWave(w) {
  if (w === "softsquare") return "square";
  if (w === "softsaw") return "sawtooth";
  if (w === "sine" || w === "triangle" || w === "square" || w === "sawtooth") return w;
  return "sine"; // noise handled separately
}

/** Geometric interpolation start→end across n steps (a smooth glide trace). */
function geom(start, end, i, n) {
  const s = Math.max(start, 1e-4);
  const e = Math.max(end, 1e-4);
  return s * Math.pow(e / s, i / Math.max(1, n));
}

/**
 * A tone with a (possibly) freq glide freqStart→freqEnd and an exponential gain decay from `peak`
 * to ~0 over `dur`, approximated as STEPS contiguous flat sub-events. `startSec` offsets the whole
 * chain. Mirrors a plucky/decaying partial (renderPartial with a short-tail ADSR).
 */
function sweepTone({ wave, freq, freqEnd = freq, peak, dur, startSec = 0 }, events) {
  const w = mapWave(wave);
  const step = dur / STEPS;
  for (let i = 0; i < STEPS; i++) {
    const f = geom(freq, freqEnd, i, STEPS);
    const g = peak * Math.pow(0.0001 / 1, i / STEPS); // exp decay to ~-80 dB
    if (g <= 0.001) break;
    events.push({ type: "tone", wave: w, freq: f, startSec: startSec + i * step, durationSec: step, gain: g });
  }
}

/** A sustained flat tone (rises to peak, holds) — used for pad/chord/held notes. */
function tone({ wave, freq, peak, dur, startSec = 0 }, events) {
  events.push({ type: "tone", wave: mapWave(wave), freq, startSec, durationSec: dur, gain: peak });
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

// ── the Wayfinders sound catalog → Crucible recipes ──────────────────────────────
// Each entry: { name, source, note, build(events) }. All seed-random params (rng.range/pick) are
// baked at a fixed NOMINAL value (≈ range midpoint / a representative default choice) so the
// reference asset is stable and reproducible. Layer counts follow the generator's dominant path.

const CATALOG = [];
function addSound(name, source, note, build) {
  const events = [];
  build(events);
  CATALOG.push({ name, source, note, recipe: { sampleRate: SAMPLE_RATE, masterGain: 0.9, events } });
}

// ── SFX generators (generators.ts) ───────────────────────────────────────────────

// FOOTSTEP: transient click (filtered noise) + body thump (pitch-drop 115→~75Hz) + surface tail.
addSound("Footstep", "generators.genFootstep", "click + pitch-drop body thump + surface crunch tail (filters→raw noise)", (e) => {
  noiseBurst({ peak: 0.22, dur: 0.01 }, e); // heel/toe click (~clickCut lowpass dropped)
  sweepTone({ wave: "triangle", freq: 115, freqEnd: 115 * 0.7, peak: 0.88, dur: 0.11 }, e); // body thump
  noiseBurst({ peak: 0.2, dur: 0.05 }, e); // surface texture crunch
});

// MELEE_HIT: pitch-drop woody body (~285→~110Hz) + transient crack + optional soft ring overtone.
addSound("Melee Hit", "generators.genMeleeHit", "pitch-drop woody body + transient crack + ring overtone (FM/filter→plain)", (e) => {
  sweepTone({ wave: "triangle", freq: 190 * 1.65, freqEnd: 190 * 0.57, peak: 0.9, dur: 0.13 }, e);
  noiseBurst({ peak: 0.22, dur: 0.03 }, e);
  sweepTone({ wave: "sine", freq: 190 * 3.1, freqEnd: 190 * 3.1, peak: 0.22, dur: 0.19 }, e);
});

// CAST_HIT: bright bell fundamental (~520Hz) + upper partials + airy shimmer noise tail.
addSound("Cast / Spell Hit", "generators.genCastHit", "bell fundamental + upper partials + airy shimmer (FM/reso→plain sines)", (e) => {
  tone({ wave: "sine", freq: 520, peak: 0.72, dur: 0.55, startSec: 0 }, e);
  sweepTone({ wave: "sine", freq: 520, freqEnd: 520, peak: 0.72, dur: 0.5, startSec: 0.05 }, e);
  sweepTone({ wave: "sine", freq: 520 * 1.5, freqEnd: 520 * 1.5, peak: 0.3, dur: 0.45 }, e);
  sweepTone({ wave: "sine", freq: 520 * 3.0, freqEnd: 520 * 3.0, peak: 0.18, dur: 0.4 }, e);
  noiseBurst({ peak: 0.1, dur: 0.35 }, e);
});

// ABILITY_CAST: rising tonal sweep (~260→~570Hz) + whoosh noise + optional high sparkle.
addSound("Ability Cast", "generators.genAbilityCast", "rising tonal charge sweep + whoosh noise + sparkle (vibrato/FM/filter→plain)", (e) => {
  sweepTone({ wave: "triangle", freq: 260, freqEnd: 260 * 2.15, peak: 0.66, dur: 0.42 }, e);
  noiseBurst({ peak: 0.15, dur: 0.3 }, e);
  sweepTone({ wave: "sine", freq: 260 * 5.5, freqEnd: 260 * 5.5, peak: 0.12, dur: 0.25 }, e);
});

// LOOT_PICKUP: two-note "ding" (root + rising fifth) + optional sparkle harmonic.
addSound("Loot Pickup", "generators.genLootPickup", "rising two-note ding (C5 + fifth) + sparkle harmonic", (e) => {
  const root = 587.33; // D5 (mid choice)
  const second = root * 1.5; // perfect fifth
  sweepTone({ wave: "sine", freq: root, freqEnd: root, peak: 0.72, dur: 0.14 }, e); // pluck body
  sweepTone({ wave: "sine", freq: second, freqEnd: second, peak: 0.7, dur: 0.4, startSec: 0.02 }, e); // ringing second
  sweepTone({ wave: "triangle", freq: second * 2, freqEnd: second * 2, peak: 0.18, dur: 0.12 }, e); // sparkle
});

// UI_CLICK: soft tonal tick (tonal path) — a short pitch-drop tone.
addSound("UI Click", "generators.genUiClick", "soft tonal tick (short pitch-drop tone; noisy-tap path not taken)", (e) => {
  const hz = 730;
  sweepTone({ wave: "triangle", freq: hz, freqEnd: hz * 0.85, peak: 0.8, dur: 0.08 }, e);
});

// LEVEL_UP: rising major-triad→octave arpeggio (staggered) + soft low pad swell.
addSound("Level Up", "generators.genLevelUp", "rising major-triad→octave arpeggio (staggered) + low pad swell", (e) => {
  const root = 440.0; // A4 (mid choice)
  const shape = [1, 1.25, 1.5, 2]; // major triad → octave
  const step = 0.13;
  shape.forEach((m, i) => {
    sweepTone({ wave: "triangle", freq: root * m, freqEnd: root * m, peak: 0.55, dur: 0.5, startSec: i * step }, e);
  });
  tone({ wave: "sine", freq: root * 0.5, peak: 0.3, dur: 1.1, startSec: 0 }, e); // pad swell
});

// THUNDER: deep rolling low-passed noise rumble (slow swell, long tail) + sub chest-thump partials.
addSound("Thunder Roll", "generators.genThunder", "rolling low rumble noise + sub chest-thump partials (lowpass dropped → raw)", (e) => {
  noiseBurst({ peak: 0.85, dur: 2.0 }, e); // rolling rumble (slow swell approximated as decay)
  sweepTone({ wave: "sine", freq: 48, freqEnd: 48 * 0.78, peak: 0.45, dur: 1.0 }, e); // chest-thump #1
  sweepTone({ wave: "sine", freq: 96, freqEnd: 96 * 0.78, peak: 0.22, dur: 0.9 }, e); // chest-thump #2
});

// SFX_BURST_WHOOSH: rising tonal sweep (~280→~700Hz) + rushing noise sweep.
addSound("Skyboat · Burst Whoosh", "generators.genBurstWhoosh", "rising tonal sweep + rushing wind noise (skyboat burst fire)", (e) => {
  sweepTone({ wave: "triangle", freq: 280, freqEnd: 280 * 2.6, peak: 0.6, dur: 0.35 }, e);
  noiseBurst({ peak: 0.3, dur: 0.26 }, e);
});

// SFX_HAZARD_THUD: low pitch-drop body (~110→~66Hz) + dull transient crack.
addSound("Skyboat · Hazard Thud", "generators.genHazardThud", "low pitch-drop woody body + dull hull-contact crack", (e) => {
  sweepTone({ wave: "triangle", freq: 110 * 1.7, freqEnd: 110 * 0.6, peak: 0.9, dur: 0.16 }, e);
  noiseBurst({ peak: 0.25, dur: 0.03 }, e);
});

// SFX_FIND_CHIME: bright two-note ding (E5 + fifth) + sky sparkle harmonic.
addSound("Skyboat · Find Chime", "generators.genFindChime", "bright two-note ding (E5 + fifth) + sparkle harmonic (airier loot ding)", (e) => {
  const root = 739.99; // F#5 (mid choice)
  const second = root * 1.5;
  sweepTone({ wave: "sine", freq: root, freqEnd: root, peak: 0.65, dur: 0.14 }, e);
  sweepTone({ wave: "sine", freq: second, freqEnd: second, peak: 0.64, dur: 0.4, startSec: 0.02 }, e);
  sweepTone({ wave: "triangle", freq: second * 2, freqEnd: second * 2, peak: 0.16, dur: 0.12 }, e);
});

// GATHER_CHOP: woody body thock (pitch-drop ~155→~135Hz) + dry "tk" contact + optional woody ring.
addSound("Gather · Chop (Wood)", "generators.genGatherChop", "woody thock body + dry tk contact + woody ring overtone", (e) => {
  const hz = 155;
  sweepTone({ wave: "triangle", freq: hz * 1.8, freqEnd: hz * 0.63, peak: 0.9, dur: 0.13 }, e);
  noiseBurst({ peak: 0.23, dur: 0.02 }, e);
  sweepTone({ wave: "sine", freq: hz * 3.0, freqEnd: hz * 3.0, peak: 0.15, dur: 0.12 }, e);
});

// GATHER_MINE: metallic inharmonic tink (~650Hz) + low stone knock + bright chip + gravel ticks.
addSound("Gather · Mine (Stone)", "generators.genGatherMine", "metallic pick tink + low stone knock + bright chip + gravel (FM/reso→plain)", (e) => {
  sweepTone({ wave: "triangle", freq: 650, freqEnd: 650, peak: 0.6, dur: 0.09 }, e); // tink
  sweepTone({ wave: "sine", freq: 145, freqEnd: 90, peak: 0.5, dur: 0.08 }, e); // stone knock
  noiseBurst({ peak: 0.18, dur: 0.015 }, e); // bright chip
  noiseBurst({ peak: 0.12, dur: 0.05, startSec: 0.02 }, e); // scattering gravel (approx)
});

// GATHER_FORAGE: leafy rustle (mid noise) + green snap tick (high noise) + optional low give body.
addSound("Gather · Forage (Leafy)", "generators.genGatherForage", "leafy rustle + green snap tick + soft give-body (filtered noise → raw)", (e) => {
  noiseBurst({ peak: 0.31, dur: 0.09 }, e); // rustle
  noiseBurst({ peak: 0.16, dur: 0.012 }, e); // snap tick
  sweepTone({ wave: "triangle", freq: 195, freqEnd: 115, peak: 0.25, dur: 0.07 }, e); // give body
});

// GATHER_DROP: single soft pluck tone (~660Hz) + optional faint upper sparkle.
addSound("Gather · Drop (Pluck)", "generators.genGatherDrop", "single soft pluck + faint upper sparkle (unknown-verb gather cue)", (e) => {
  const root = 659.25; // E5 (mid choice)
  sweepTone({ wave: "sine", freq: root, freqEnd: root, peak: 0.7, dur: 0.14 }, e);
  sweepTone({ wave: "sine", freq: root * 1.5, freqEnd: root * 1.5, peak: 0.15, dur: 0.1 }, e);
});

// GATHER_DEPLETED: soft crumble (low noise + grain) → warm two-note "done" chime resolving DOWN.
addSound("Gather · Depleted", "generators.genGatherDepleted", "crumble noise (+grain) → warm two-note down-third done-chime", (e) => {
  const root = 659.25; // E5 (mid choice)
  const down = 0.8; // ↓ major third
  noiseBurst({ peak: 0.24, dur: 0.14 }, e); // crumble settle
  sweepTone({ wave: "sine", freq: root, freqEnd: root, peak: 0.58, dur: 0.34 }, e); // higher note
  sweepTone({ wave: "sine", freq: root * down, freqEnd: root * down, peak: 0.58, dur: 0.42, startSec: 0.13 }, e); // resolve down
});

// ── Splash UI-CLICK candidates: same genUiClick recipe at 3 different catalog seeds. ──
// Baked as distinct labeled reference assets (they ARE distinct catalog entries the Director
// auditions), but each is the SAME cozy tonal-tick recipe as UI Click above.
addSound("Splash · Click A", "generators.genUiClickSplashA", "cozy shell-button tick (genUiClick recipe, candidate A)", (e) => {
  sweepTone({ wave: "triangle", freq: 700, freqEnd: 700 * 0.85, peak: 0.8, dur: 0.08 }, e);
});
addSound("Splash · Click B", "generators.genUiClickSplashB", "cozy shell-button tick (genUiClick recipe, candidate B)", (e) => {
  sweepTone({ wave: "sine", freq: 620, freqEnd: 620 * 0.85, peak: 0.8, dur: 0.08 }, e);
});
addSound("Splash · Click C", "generators.genUiClickSplashC", "cozy shell-button tick (genUiClick recipe, candidate C)", (e) => {
  sweepTone({ wave: "square", freq: 820, freqEnd: 820 * 0.85, peak: 0.78, dur: 0.08 }, e);
});

// ── SKIPPED sounds (identity depends on LFO-swelled filtered noise, sequenced music, or looping) ──
// Listed but NOT built — the simple tone/noise renderer can't carry their character.
const SKIPPED = [
  ["Ambience · Frostpeaks Wind (amb.wind)", "generators.genWindBed/buildBed", "LOOPING 4s bed: a sustained filtered white-noise wind field whose amplitude is driven by two slow LFO 'gust' swells (0.12Hz-ish) + a detuned, vibratoed low drone. Identity = the LFO breathing + heavy lowpass texture, none of which the tone/noise renderer can express; also non-terminating (loop=true)."],
  ["Ambience · Emberwastes Ember (amb.ember)", "generators.genEmberBed/buildBed", "LOOPING bed (wind buildBed) + sprinkled deterministic crackle pops; the bed's LFO-swept lowpassed-noise field + drone can't be reproduced, and it's a non-terminating loop."],
  ["Ambience · Skyhold Hub (amb.hub)", "generators.genHubBed/buildBed", "LOOPING soft pad-drone bed: a very-lowpassed noise field + detuned vibrato drone with slow swell LFOs — the filter/LFO IS the sound, and it loops."],
  ["Ambience · Rainforest Rain (amb.rain)", "generators.genRainBed/buildBed", "LOOPING bed: bright LFO-swelled filtered-noise 'rain hiss' over a low drone + sparse droplet ticks; the sustained filtered field + swell can't be carried by raw noise bursts, and it loops."],
  ["Ambience · Sky Travel (amb.sky-travel)", "generators.genSkyTravelBed/buildBed", "LOOPING open-sky airy drone bed (buildBed): LFO-swelled filtered-noise air + detuned vibrato drone. Filter/LFO identity + non-terminating loop."],
  ["Ambience · Skylanes Flight (amb.flight)", "generators.genFlightBed/buildBed", "LOOPING 8s bed: buildBed foundation + a stack of slowly-vibratoed, detuned, lowpassed high 'shimmer' sine partials held the full loop. Identity = the drifting filtered/vibrato shimmer over the swelled noise field; loops."],
  ["Music · Safe Hub (music.safe)", "generators.genMusicSafe/composeMusicLoop", "LOOPING multi-layer folk-orchestral loop (harmony pad chords + a melody motif + root/fifth bass + soft percussion), sequenced by music.ts. A continuous composed piece, not a discrete bakeable one-shot; loops."],
  ["Music · Explore (music.explore)", "generators.genMusicExplore/composeMusicLoop", "LOOPING sequenced folk loop (warmer/fuller, brushed perc). Composed multi-layer loop, not a one-shot cue; loops."],
  ["Music · Combat (music.combat)", "generators.genMusicCombat/composeMusicLoop", "LOOPING sequenced folk loop (driving groove, minor color). Composed multi-layer loop; loops."],
  ["Music · High Tension (music.tension)", "generators.genMusicTension/composeMusicLoop", "LOOPING sequenced folk loop (darker/sparser, urgent pulse). Composed multi-layer loop; loops."],
  ["Splash · Intro A–G (music.splash-a … music.splash-g)", "generators.genMusicSplash*/composeMusicLoop", "SEVEN LOOPING composed intro beds (welcome/hearth/dawn/pastoral/musicbox moods via SPLASH_MOODS). Each is a full sequenced music loop (pad+melody+bass+perc), not a discrete bakeable cue; all loop. Skipped as one group (7 entries)."],
];

// ── run ──────────────────────────────────────────────────────────────────────────
console.log(`${DRY ? "[dry-run] " : ""}Wayfinders (project-mmo) audio → Crucible project "${SLUG}" (${base}/api/import)`);
console.log(`${CATALOG.length} sounds to import, ${SKIPPED.length} skip-lines (17 skipped sounds).\n`);

let ok = 0, fail = 0;
for (const s of CATALOG) {
  const wav = renderWav(s.recipe);
  const label = s.name;
  // artKitId: audio.<slugified-name> (parallels the storm importer's audio.* namespace).
  const artKitId = "audio." + s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const durSec = s.recipe.events.reduce((m, ev) => Math.max(m, ev.startSec + ev.durationSec), 0);

  if (DRY) {
    console.log(
      `  would import  ${label.padEnd(26)} ${artKitId.padEnd(30)} ${wav.length.toString().padStart(6)} B  ${durSec.toFixed(2)}s  (${s.recipe.events.length} events)`
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
    console.log(`  ok  ${label.padEnd(26)} → ${out.url}`);
    ok++;
  } catch (err) {
    console.warn(`  FAIL ${label} — ${err.message}`);
    fail++;
  }
}

console.log(`\nSKIPPED (identity = LFO/filtered-noise field, sequenced music loop, or looping/non-terminating):`);
for (const [name, src, why] of SKIPPED) console.log(`  - ${name} (${src}): ${why}`);

console.log(
  `\n${DRY ? "[dry-run] " : ""}done: ${ok} ${DRY ? "to import" : "imported"}, ${fail} failed, ${SKIPPED.length} skip-lines.`
);
if (DRY) console.log("Re-run with --run to render each WAV + POST to /api/import.");
