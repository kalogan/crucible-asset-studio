/**
 * NPC behavior runtime (Track B2) — deterministic walking over a `Pathfinder`.
 *
 * Distilled from Wayfinders' `tickNpcBehavior`: an NPC picks a goal WITHIN its bounds, asks
 * the pathfinder for a route, and walks it; on arrival it idles, then picks again. Bounds:
 *   • `wander`/`region` — a goal anywhere in a disc around an anchor;
 *   • `patrol`          — cycle through a fixed list of waypoints.
 *
 * Seeded + deterministic: goal selection uses the injected kit `Rng`, motion uses the `dt`
 * the caller passes — no clock, no Math.random — so the same seed yields the same trajectory.
 * THREE-free: positions are plain `[x, z]`. The game renders the synced position; this layer
 * never touches a renderer. The LLM never drives it — movement stays pure + authoritative.
 */

import type { Pathfinder, Vec2 } from '../nav/index.js';
import type { Rng } from '../prng/index.js';

export * from './follow.js';
export * from './utility.js';

/** Where an NPC is allowed to roam. */
export type BehaviorBounds =
  | { kind: 'wander'; anchor: Vec2; radius: number }
  /** `region` behaves like `wander` for v1 (a disc around the anchor). */
  | { kind: 'region'; anchor: Vec2; radius: number }
  | { kind: 'patrol'; waypoints: Vec2[] };

export interface NpcBehaviorOptions {
  /** The route provider (e.g. a `createGridNav`). */
  pathfinder: Pathfinder;
  /** The roam bounds. */
  bounds: BehaviorBounds;
  /** Seeded RNG for goal selection (e.g. `createRng(seed)`). */
  rng: Rng;
  /** Starting world position. Default: the anchor (wander/region) or first waypoint (patrol). */
  start?: Vec2;
  /** Movement speed in world units per second. Default 2. */
  speed?: number;
  /** Distance at which a waypoint counts as reached. Default 0.15. */
  arriveRadius?: number;
  /** Seconds to pause at a goal before choosing the next. Default 0.6. */
  idleSeconds?: number;
  /** Random-goal attempts before giving up a tick (wander/region). Default 8. */
  goalAttempts?: number;
}

export type BehaviorPhase = 'idle' | 'walking';

export interface NpcBehaviorState {
  /** Current world position `[x, z]`. */
  position: Vec2;
  phase: BehaviorPhase;
  /** The current destination, or null while idle with none chosen. */
  goal: Vec2 | null;
}

export interface NpcBehavior {
  readonly position: Vec2;
  /** A snapshot of the current state (no side effects). */
  state(): NpcBehaviorState;
  /** Advance the simulation by `dtSeconds` and return the new state. */
  tick(dtSeconds: number): NpcBehaviorState;
}

function dist(a: Vec2, b: Vec2): number {
  const dx = a[0] - b[0];
  const dz = a[1] - b[1];
  return Math.hypot(dx, dz);
}

/** Default start: a wander/region anchor, or the first patrol waypoint, or the origin. */
function defaultStart(bounds: BehaviorBounds): Vec2 {
  if (bounds.kind === 'patrol') {
    const first = bounds.waypoints[0];
    return first ? [first[0], first[1]] : [0, 0];
  }
  return [bounds.anchor[0], bounds.anchor[1]];
}

export function createNpcBehavior(opts: NpcBehaviorOptions): NpcBehavior {
  const { pathfinder, bounds, rng } = opts;
  const speed = opts.speed ?? 2;
  const arriveRadius = opts.arriveRadius ?? 0.15;
  const idleSeconds = opts.idleSeconds ?? 0.6;
  const goalAttempts = opts.goalAttempts ?? 8;

  let position: Vec2 = opts.start ? [opts.start[0], opts.start[1]] : defaultStart(bounds);
  let phase: BehaviorPhase = 'idle';
  let idleTimer = 0; // 0 ⇒ choose a goal on the first tick
  let goal: Vec2 | null = null;
  let path: Vec2[] = [];
  let pathIndex = 0;
  let patrolIndex = 0;

  /** Choose the next destination + route. Returns true if a walkable route was found. */
  function beginNextGoal(): boolean {
    if (bounds.kind === 'patrol') {
      const wp = bounds.waypoints[patrolIndex];
      if (!wp) return false;
      patrolIndex = (patrolIndex + 1) % bounds.waypoints.length;
      const route = pathfinder.findPath(position, [wp[0], wp[1]]);
      if (!route || route.length === 0) return false;
      goal = [wp[0], wp[1]];
      path = route;
      pathIndex = 0;
      return true;
    }

    // wander / region: sample a point in the disc around the anchor (uniform area).
    const anchor = bounds.anchor;
    const radius = bounds.radius;
    for (let attempt = 0; attempt < goalAttempts; attempt++) {
      const angle = rng.next() * Math.PI * 2;
      const r = radius * Math.sqrt(rng.next());
      const candidate: Vec2 = [anchor[0] + Math.cos(angle) * r, anchor[1] + Math.sin(angle) * r];
      const route = pathfinder.findPath(position, candidate);
      if (route && route.length > 0) {
        goal = candidate;
        path = route;
        pathIndex = 0;
        return true;
      }
    }
    return false;
  }

  function advance(dtSeconds: number): void {
    if (phase === 'idle') {
      idleTimer -= dtSeconds;
      if (idleTimer > 0) return;
      if (beginNextGoal()) {
        phase = 'walking';
      } else {
        idleTimer = idleSeconds; // no route — wait and retry next idle window
      }
      return;
    }

    // walking: consume `speed * dt` of travel along the remaining waypoints.
    let remaining = speed * dtSeconds;
    while (remaining > 0 && pathIndex < path.length) {
      const target = path[pathIndex] as Vec2;
      const d = dist(position, target);
      if (d <= arriveRadius || d <= remaining) {
        position = [target[0], target[1]];
        remaining -= Math.max(d, 0);
        pathIndex++;
      } else {
        const step = remaining / d;
        position = [
          position[0] + (target[0] - position[0]) * step,
          position[1] + (target[1] - position[1]) * step,
        ];
        remaining = 0;
      }
    }

    if (pathIndex >= path.length) {
      phase = 'idle';
      idleTimer = idleSeconds;
    }
  }

  return {
    get position(): Vec2 {
      return [position[0], position[1]];
    },
    state(): NpcBehaviorState {
      return {
        position: [position[0], position[1]],
        phase,
        goal: goal ? [goal[0], goal[1]] : null,
      };
    },
    tick(dtSeconds: number): NpcBehaviorState {
      if (dtSeconds > 0) advance(dtSeconds);
      return this.state();
    },
  };
}
