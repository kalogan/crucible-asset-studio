// Pure derived metrics over the kit audit. No I/O — safe to unit-test directly.

import {
  GAMES,
  SYSTEMS,
  adoptionFor,
  type Adoption,
  type Game,
  type KitSystem,
} from "./catalog";

export type CoverageSummary = {
  builtCount: number;
  plannedCount: number;
  /** `core` cells across BUILT systems — places the kit could unify an existing impl. */
  unifyOpportunities: number;
  /** `gap` cells across BUILT systems — places a built system could be added net-new. */
  expandOpportunities: number;
};

/** Count systems by status + total core/gap opportunities across BUILT systems. */
export function coverageSummary(
  systems: readonly KitSystem[] = SYSTEMS,
  games: readonly Game[] = GAMES,
): CoverageSummary {
  let builtCount = 0;
  let plannedCount = 0;
  let unifyOpportunities = 0;
  let expandOpportunities = 0;

  for (const system of systems) {
    if (system.status === "built") {
      builtCount += 1;
      for (const game of games) {
        const status = adoptionFor(system.id, game.id);
        if (status === "core") unifyOpportunities += 1;
        else if (status === "gap") expandOpportunities += 1;
      }
    } else {
      plannedCount += 1;
    }
  }

  return { builtCount, plannedCount, unifyOpportunities, expandOpportunities };
}

/** Per-game: how many BUILT systems this game could adopt (its `gap` cells). */
export type GameGapBar = { game: Game; gaps: number; builtTotal: number };

export function builtSystemGapsByGame(
  systems: readonly KitSystem[] = SYSTEMS,
  games: readonly Game[] = GAMES,
): GameGapBar[] {
  const built = systems.filter((s) => s.status === "built");
  return games.map((game) => {
    let gaps = 0;
    for (const system of built) {
      if (adoptionFor(system.id, game.id) === "gap") gaps += 1;
    }
    return { game, gaps, builtTotal: built.length };
  });
}

/** A ranked opportunity: a system + the games that drive its score, with the count. */
export type Opportunity = {
  system: KitSystem;
  /** Games matching the relevant adoption status for this ranking. */
  games: Game[];
  count: number;
};

function gamesWithStatus(
  systemId: string,
  status: Adoption,
  games: readonly Game[],
): Game[] {
  return games.filter((game) => adoptionFor(systemId, game.id) === status);
}

/** Stable, descending-by-count sort; ties broken by system name for determinism. */
function rankDesc(opportunities: Opportunity[]): Opportunity[] {
  return [...opportunities].sort(
    (a, b) => b.count - a.count || a.system.name.localeCompare(b.system.name),
  );
}

/**
 * Build next — PLANNED systems ranked by how many games already hand-roll it
 * (`core`). Most-duplicated planned system = highest leverage to build.
 */
export function buildNext(
  systems: readonly KitSystem[] = SYSTEMS,
  games: readonly Game[] = GAMES,
): Opportunity[] {
  const planned = systems.filter((s) => s.status === "planned");
  const ranked = planned.map((system) => {
    const coreGames = gamesWithStatus(system.id, "core", games);
    return { system, games: coreGames, count: coreGames.length };
  });
  return rankDesc(ranked.filter((o) => o.count > 0));
}

/**
 * Adopt here — BUILT systems ranked by how many games still hand-roll their own
 * impl (`core`). These are the unify-onto-the-kit candidates.
 */
export function adoptHere(
  systems: readonly KitSystem[] = SYSTEMS,
  games: readonly Game[] = GAMES,
): Opportunity[] {
  const built = systems.filter((s) => s.status === "built");
  const ranked = built.map((system) => {
    const coreGames = gamesWithStatus(system.id, "core", games);
    return { system, games: coreGames, count: coreGames.length };
  });
  return rankDesc(ranked.filter((o) => o.count > 0));
}

/**
 * Expand to — BUILT systems with `gap` games: net-new adoption the kit could
 * push into games that don't have it yet.
 */
export function expandTo(
  systems: readonly KitSystem[] = SYSTEMS,
  games: readonly Game[] = GAMES,
): Opportunity[] {
  const built = systems.filter((s) => s.status === "built");
  const ranked = built.map((system) => {
    const gapGames = gamesWithStatus(system.id, "gap", games);
    return { system, games: gapGames, count: gapGames.length };
  });
  return rankDesc(ranked.filter((o) => o.count > 0));
}
