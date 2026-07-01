import { describe, expect, it } from "vitest";
import type { Game, KitSystem } from "./catalog";
import { SYSTEMS as REAL_SYSTEMS, GAMES as REAL_GAMES } from "./catalog";
import {
  coverageSummary,
  builtSystemGapsByGame,
  buildNext,
  adoptHere,
  expandTo,
} from "./derive";

// Expected counts derived FROM the catalog (not hardcoded), so these survive
// director edits to the matrix.
const REAL_BUILT = REAL_SYSTEMS.filter((s) => s.status === "built").length;
const REAL_PLANNED = REAL_SYSTEMS.length - REAL_BUILT;

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
    // Counts match the catalog (derived, not hardcoded).
    expect(s.builtCount).toBe(REAL_BUILT);
    expect(s.plannedCount).toBe(REAL_PLANNED);
    // Opportunities are non-negative and bounded by built × games.
    expect(s.unifyOpportunities).toBeGreaterThanOrEqual(0);
    expect(s.expandOpportunities).toBeGreaterThanOrEqual(0);
    expect(s.unifyOpportunities + s.expandOpportunities).toBeLessThanOrEqual(
      REAL_BUILT * REAL_GAMES.length,
    );
  });
});

describe("builtSystemGapsByGame (real catalog)", () => {
  it("returns one bar per game with gaps within [0, builtTotal]", () => {
    const bars = builtSystemGapsByGame();
    expect(bars).toHaveLength(REAL_GAMES.length);
    for (const bar of bars) {
      expect(bar.builtTotal).toBe(REAL_BUILT);
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
  it("buildNext ranks PLANNED systems by # of core games (descending, no zero-count)", () => {
    const ranked = buildNext();
    // Only planned systems appear (built ones are excluded).
    expect(ranked.every((o) => o.system.status === "planned")).toBe(true);
    // Monotonic non-increasing; no zero-count; games length matches count.
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1]!.count).toBeGreaterThanOrEqual(ranked[i]!.count);
    }
    expect(ranked.every((o) => o.count > 0)).toBe(true);
    expect(ranked.every((o) => o.games.length === o.count)).toBe(true);
  });

  it("adoptHere ranks built systems by # of core games; a system core in every game tops out at the game count", () => {
    const ranked = adoptHere();
    // A universally-adopted system (e.g. scene-state / camera-rigs, core in all games
    // incl. GYRE) tops out at the number of games — derived, so it survives adding games.
    expect(ranked[0]?.count).toBe(REAL_GAMES.length);
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
