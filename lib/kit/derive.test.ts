import { describe, expect, it } from "vitest";
import type { Game, KitSystem } from "./catalog";
import {
  coverageSummary,
  builtSystemGapsByGame,
  buildNext,
  adoptHere,
  expandTo,
} from "./derive";

// Small synthetic fixture so the ranking/counting logic is checked against
// hand-computed expectations, independent of the live audit data.
const GAMES: Game[] = [
  { id: "g1", name: "Game One", engine: "three-r3f" },
  { id: "g2", name: "Game Two", engine: "three-vanilla" },
  { id: "g3", name: "Game Three", engine: "three-vanilla" },
];

const SYSTEMS: KitSystem[] = [
  { id: "alpha", name: "Alpha", tier: "atom", status: "built" },
  { id: "beta", name: "Beta", tier: "system", status: "built" },
  { id: "gamma", name: "Gamma", tier: "kit", status: "planned" },
  { id: "delta", name: "Delta", tier: "system", status: "planned" },
];

// Patch the module-level lookup by passing explicit data into each helper, but
// derive reads ADOPTION via adoptionFor, which is keyed on the real ids. So we
// build a fixture-aware version by re-deriving against a local adoption table.
// To keep helpers pure we instead test against the real catalog ids below.

describe("coverageSummary (real catalog)", () => {
  it("counts built vs planned and core/gap opportunities consistently", () => {
    const s = coverageSummary();
    // 14 built, 6 planned per the audit.
    expect(s.builtCount).toBe(14);
    expect(s.plannedCount).toBe(6);
    // Opportunities are non-negative and bounded by built*games (14*5 = 70).
    expect(s.unifyOpportunities).toBeGreaterThan(0);
    expect(s.expandOpportunities).toBeGreaterThan(0);
    expect(s.unifyOpportunities + s.expandOpportunities).toBeLessThanOrEqual(70);
  });
});

describe("builtSystemGapsByGame (real catalog)", () => {
  it("returns one bar per game with gaps within [0, builtTotal]", () => {
    const bars = builtSystemGapsByGame();
    expect(bars).toHaveLength(5);
    for (const bar of bars) {
      expect(bar.builtTotal).toBe(14);
      expect(bar.gaps).toBeGreaterThanOrEqual(0);
      expect(bar.gaps).toBeLessThanOrEqual(bar.builtTotal);
    }
  });

  it("Woodturning Studio has the most built-system gaps", () => {
    const bars = builtSystemGapsByGame();
    const top = [...bars].sort((a, b) => b.gaps - a.gaps)[0];
    expect(top?.game.id).toBe("woodturning-studio");
  });
});

describe("ranking helpers are descending and exclude zero-count systems", () => {
  it("buildNext ranks planned systems by # of core games, top is camera-rigs (5)", () => {
    const ranked = buildNext();
    // camera-rigs is core in all 5 games.
    expect(ranked[0]?.system.id).toBe("camera-rigs");
    expect(ranked[0]?.count).toBe(5);
    // Monotonic non-increasing.
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1]!.count).toBeGreaterThanOrEqual(ranked[i]!.count);
    }
    // No zero-count entries.
    expect(ranked.every((o) => o.count > 0)).toBe(true);
    // games array length matches the count.
    expect(ranked.every((o) => o.games.length === o.count)).toBe(true);
  });

  it("adoptHere ranks built systems by # of core games; fully-adopted systems top out at 5", () => {
    const ranked = adoptHere();
    expect(ranked[0]?.count).toBe(5);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1]!.count).toBeGreaterThanOrEqual(ranked[i]!.count);
    }
    expect(ranked.every((o) => o.count > 0)).toBe(true);
  });

  it("expandTo lists only built systems that have at least one gap game", () => {
    const ranked = expandTo();
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.every((o) => o.count > 0)).toBe(true);
    expect(ranked.every((o) => o.system.status === "built")).toBe(true);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1]!.count).toBeGreaterThanOrEqual(ranked[i]!.count);
    }
  });
});

describe("derived helpers accept injected data (purity)", () => {
  it("coverageSummary over a planned-only system set has zero opportunities", () => {
    const plannedOnly = SYSTEMS.filter((s) => s.status === "planned");
    const s = coverageSummary(plannedOnly, GAMES);
    expect(s.builtCount).toBe(0);
    expect(s.plannedCount).toBe(2);
    expect(s.unifyOpportunities).toBe(0);
    expect(s.expandOpportunities).toBe(0);
  });
});
