/**
 * AudioManager — a lean, reusable Web-Audio runtime.
 *
 * DOM/AudioContext-OPTIONAL: importing this module must never throw without a DOM
 * (node / SSR). The AudioContext is created LAZILY on `resume()` (the first user
 * gesture, required by browser autoplay policy). In an environment with no
 * AudioContext (node / SSR / tests), every method is a safe no-op so call sites
 * never need to guard.
 *
 * Bus graph (mirrors the proven project-mmo engine, kept lean + standalone):
 *   tone/noise source → per-channel GainNode → master GainNode → destination.
 * Each channel's audible gain is the clamped product of its level and the master
 * level (see the pure `effectiveGain` helper, which is unit-tested without any
 * AudioContext).
 *
 * No new deps: pure Web Audio API. The only per-play allocation is the oscillator
 * / buffer-source node Web-Audio requires (one-shot by design — they're GC'd once
 * stopped, so we pool nothing).
 */

export type Channel = string;

export interface PlayToneOpts {
  /** Oscillator waveform. Defaults to 'sine'. */
  type?: OscillatorType;
  /** Channel to route through. Defaults to 'sfx'. */
  channel?: Channel;
  /** Per-event linear gain layered on top of the channel volume (0..1). Defaults to 1. */
  gain?: number;
}

export interface PlayNoiseOpts {
  /** Channel to route through. Defaults to 'sfx'. */
  channel?: Channel;
  /** Per-event linear gain layered on top of the channel volume (0..1). Defaults to 1. */
  gain?: number;
}

export interface AudioManager {
  /** Unlock/create the AudioContext (call on the first user gesture). Idempotent. */
  resume(): Promise<void>;
  /** Set a channel's volume, clamped to 0..1. Unknown channels are ignored. */
  setVolume(channel: Channel, level: number): void;
  /** Read a channel's volume (0..1). Returns 0 for unknown channels. */
  getVolume(channel: Channel): number;
  /** Play a short tone (oscillator) for `durationSec`. No-op until resumed. */
  playTone(freq: number, durationSec: number, opts?: PlayToneOpts): void;
  /** Play a burst of white noise for `durationSec`. No-op until resumed. */
  playNoise(durationSec: number, opts?: PlayNoiseOpts): void;
  /** Close the AudioContext and release nodes. Safe to call repeatedly. */
  dispose(): void;
}

export interface AudioManagerOptions {
  /** Channel names (each a GainNode → master). Defaults to ['master','music','sfx']. */
  channels?: Channel[];
}

/** Channels every manager has, even if the caller passes a custom list. */
const DEFAULT_CHANNELS: Channel[] = ['master', 'music', 'sfx'];

/** Default channel a tone/noise routes through when none is given. */
const DEFAULT_CHANNEL: Channel = 'sfx';

/** Clamp a number into [0, 1]. NaN → 0; ±Infinity clamp to the nearest bound (1 / 0). */
function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * PURE: the audible gain a channel produces — the clamped product of the master
 * level, the channel level, and an optional per-event gain (each clamped to 0..1,
 * so the result is always in 0..1). No AudioContext needed → unit-testable.
 */
export function effectiveGain(master: number, channel: number, gain?: number): number {
  const g = gain === undefined ? 1 : clamp01(gain);
  return clamp01(clamp01(master) * clamp01(channel) * g);
}

/** Resolve the AudioContext constructor, or null in a no-AudioContext env. */
function resolveAudioContextCtor(): typeof AudioContext | null {
  const g = globalThis as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

/**
 * Create an AudioManager. Channels default to ['master','music','sfx']; the
 * 'master' channel is ALWAYS present (it backs the master GainNode) even if the
 * caller omits it. All channels start at volume 1.
 */
export function createAudioManager(opts: AudioManagerOptions = {}): AudioManager {
  // De-dupe the channel list and guarantee 'master' is present.
  const requested = opts.channels && opts.channels.length > 0 ? opts.channels : DEFAULT_CHANNELS;
  const channelNames = Array.from(new Set<Channel>(['master', ...requested]));

  // Volumes live independently of the AudioContext so getVolume/setVolume work
  // before resume() and in no-AudioContext envs. All channels start at 1.
  const volumes = new Map<Channel, number>();
  for (const name of channelNames) volumes.set(name, 1);

  let ctx: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  /** Per-channel GainNodes (excluding 'master', which is `masterGain`). */
  const channelGains = new Map<Channel, GainNode>();
  let disposed = false;

  function masterLevel(): number {
    return volumes.get('master') ?? 1;
  }

  /** Build the bus graph once a context exists: channel gains → master → destination. */
  function buildGraph(c: AudioContext): void {
    masterGain = c.createGain();
    masterGain.gain.value = clamp01(masterLevel());
    masterGain.connect(c.destination);
    for (const name of channelNames) {
      if (name === 'master') continue;
      const g = c.createGain();
      g.gain.value = clamp01(volumes.get(name) ?? 1);
      g.connect(masterGain);
      channelGains.set(name, g);
    }
  }

  /** The GainNode a channel routes through (master falls back to the master gain). */
  function gainFor(channel: Channel): GainNode | null {
    if (channel === 'master') return masterGain;
    return channelGains.get(channel) ?? null;
  }

  return {
    async resume(): Promise<void> {
      if (disposed) return;
      if (!ctx) {
        const Ctor = resolveAudioContextCtor();
        if (!Ctor) return; // no-AudioContext env → safe no-op
        ctx = new Ctor();
        buildGraph(ctx);
      }
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          /* resume can reject if not from a gesture; caller retries on next gesture */
        }
      }
    },

    setVolume(channel: Channel, level: number): void {
      if (!volumes.has(channel)) return; // unknown channel → ignore
      const clamped = clamp01(level);
      volumes.set(channel, clamped);
      if (channel === 'master') {
        if (masterGain && ctx) masterGain.gain.setTargetAtTime(clamped, ctx.currentTime, 0.02);
      } else {
        const g = channelGains.get(channel);
        if (g && ctx) g.gain.setTargetAtTime(clamped, ctx.currentTime, 0.02);
      }
    },

    getVolume(channel: Channel): number {
      return volumes.get(channel) ?? 0;
    },

    playTone(freq: number, durationSec: number, toneOpts: PlayToneOpts = {}): void {
      if (disposed || !ctx || durationSec <= 0) return;
      const bus = gainFor(toneOpts.channel ?? DEFAULT_CHANNEL);
      if (!bus) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = toneOpts.type ?? 'sine';
      osc.frequency.value = freq;
      const env = ctx.createGain();
      // Short attack/release envelope so tones don't click on start/stop.
      const peak = clamp01(toneOpts.gain ?? 1);
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(peak, now + Math.min(0.01, durationSec / 2));
      env.gain.setValueAtTime(peak, now + Math.max(0, durationSec - 0.01));
      env.gain.linearRampToValueAtTime(0, now + durationSec);
      osc.connect(env).connect(bus);
      osc.start(now);
      osc.stop(now + durationSec);
      osc.onended = () => {
        try {
          osc.disconnect();
          env.disconnect();
        } catch {
          /* already gone */
        }
      };
    },

    playNoise(durationSec: number, noiseOpts: PlayNoiseOpts = {}): void {
      if (disposed || !ctx || durationSec <= 0) return;
      const bus = gainFor(noiseOpts.channel ?? DEFAULT_CHANNEL);
      if (!bus) return;
      const now = ctx.currentTime;
      const frames = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
      const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const env = ctx.createGain();
      env.gain.value = clamp01(noiseOpts.gain ?? 1);
      src.connect(env).connect(bus);
      src.start(now);
      src.stop(now + durationSec);
      src.onended = () => {
        try {
          src.disconnect();
          env.disconnect();
        } catch {
          /* already gone */
        }
      };
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      channelGains.clear();
      masterGain = null;
      const c = ctx;
      ctx = null;
      if (c) {
        try {
          void c.close();
        } catch {
          /* already closed */
        }
      }
    },
  };
}
