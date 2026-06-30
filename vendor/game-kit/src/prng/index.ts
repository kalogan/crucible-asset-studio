/**
 * Seeded PRNG — mulberry32 algorithm.
 *
 * THREE-FREE: this module must never import three so it unit-tests without it.
 *
 * Deterministic: the same seed always produces the same sequence. Never uses
 * Math.random() or Date.now() internally.
 */

export interface Rng {
  /** Returns a float in [0, 1). */
  next(): number;
  /** Returns an integer in [0, maxExclusive). Throws if maxExclusive < 1. */
  int(maxExclusive: number): number;
  /** Returns an integer in [min, max] inclusive. Throws if min > max. */
  range(min: number, max: number): number;
  /** Picks a random element from a non-empty array. Throws if empty. */
  pick<T>(arr: readonly T[]): T;
  /**
   * Derives a new independent Rng from this one's seed plus a salt.
   * Stable: the same (seed, salt) pair always yields the same child stream,
   * and different salts yield different streams.
   */
  fork(salt: number): Rng;
}

/**
 * mulberry32 — fast, deterministic, good statistical quality.
 * Returns a function producing floats in [0, 1).
 */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0; // 32-bit unsigned
  return function () {
    s += 0x6d2b79f5;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
  };
}

/**
 * Mix two 32-bit integers into a new well-distributed 32-bit seed.
 * Used by fork() so that (seed, salt) deterministically derives a child seed
 * that differs across salts.
 */
function mixSeed(seed: number, salt: number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (salt >>> 0), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Create a seeded Rng from a numeric seed.
 * Same seed → identical sequence, every time.
 */
export function createRng(seed: number): Rng {
  const baseSeed = seed >>> 0;
  const raw = mulberry32(baseSeed);

  const rng: Rng = {
    next(): number {
      return raw();
    },

    int(maxExclusive: number): number {
      if (!Number.isFinite(maxExclusive) || maxExclusive < 1) {
        throw new RangeError(`Rng.int: maxExclusive must be >= 1 (got ${maxExclusive})`);
      }
      return Math.floor(raw() * Math.floor(maxExclusive));
    },

    range(min: number, max: number): number {
      if (min > max) throw new RangeError(`Rng.range: min (${min}) > max (${max})`);
      if (min === max) return min;
      return Math.floor(raw() * (max - min + 1)) + min;
    },

    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) throw new RangeError('Rng.pick: array is empty');
      const index = Math.floor(raw() * arr.length);
      const item = arr[index];
      if (item === undefined) {
        throw new RangeError('Rng.pick: index out of bounds (unreachable)');
      }
      return item;
    },

    fork(salt: number): Rng {
      return createRng(mixSeed(baseSeed, salt));
    },
  };

  return rng;
}
