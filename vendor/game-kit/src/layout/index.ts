/**
 * Layout — authored multi-floor interior levels (stairs, open atriums).
 *
 * THREE-FREE: this module must never import three so it unit-tests without it
 * (see ./r3f.tsx for the thin greybox renderer that turns this into meshes).
 *
 * Spatial model: VOLUMES + PORTALS. A `LayoutDescriptor` is a JSON-serializable
 * list of floors, each holding a set of `Volume`s (rooms/halls as rects or
 * polys), plus a flat list of `Portal`s connecting them — doors (same floor),
 * stairs (adjacent floors), and voids (an atrium: a floor-above opening that
 * lets a lower volume see up through it). This is DATA-FIRST: a future
 * Crucible 2D-canvas editor authors this exact JSON; the kit only reads it.
 *
 * `validateLayout(d)` checks referential + geometric integrity (dangling refs,
 * portals that don't touch their volumes, spawn outside every volume, etc.).
 * `buildLayoutGeometry(d)` turns a valid descriptor into transform-ready
 * primitive arrays (floor slabs, wall segments, stair runs) — deterministic,
 * no THREE, ready for a renderer (r3f or otherwise) to instantiate meshes
 * from. `layoutBounds(d, floor)` derives a `BoundsConstraint`-compatible
 * clamp function (see ../camera/index.ts) so a GYRE-style player can walk a
 * floor and be kept inside its volumes, with pass-through at door gaps.
 *
 * KIT OWNS GEOMETRY + COLLISION ONLY. Explicitly NOT built here (ROADMAP):
 *   - Navgrid derivation (a walkable graph baked from the volumes/portals for
 *     pathfinding NPCs) — layered on top of ../nav/index.ts later.
 *   - Spawn/door RUNTIME (trigger volumes, open/close state, locked doors) —
 *     a game-side concern; this module only describes door geometry + gaps.
 *   - Room-enter events (the game reacting to the player crossing a portal).
 *   - The Crucible 2D-canvas editor that authors/edits this JSON visually.
 *
 * POLY v1 NOTE: `Poly` shapes are accepted by the descriptor for future
 * authoring flexibility, but v1 geometry/bounds/validation treat a Poly as
 * its AXIS-ALIGNED BOUNDING RECT (the "rect hull"). Convexity is not
 * required. This keeps the rect-decomposition + bounds-clamp math simple and
 * correct for the common case (rectangular rooms); true poly clipping is a
 * later upgrade if/when the editor needs non-rectangular rooms.
 */

// ── Descriptor (pure data, JSON-serializable) ───────────────────────────────

/** An axis-aligned rectangle footprint on the XZ plane. */
export interface Rect {
  type: 'rect';
  x: number;
  z: number;
  w: number;
  d: number;
}

/** A polygon footprint on the XZ plane. Treated as its rect hull in v1 (see module docs). */
export interface Poly {
  type: 'poly';
  points: Array<[number, number]>;
}

/** A volume's footprint — either an authored rect or a poly (rect-hulled in v1). */
export type Shape = Rect | Poly;

/** A room or hall — one enclosed footprint on a floor. */
export interface Volume {
  id: string;
  kind: 'room' | 'hall';
  shape: Shape;
}

/** One storey: a floor slab at `elevation` (world Y) with `height` ceiling clearance. */
export interface Floor {
  /** Floor slab Y (world units). */
  elevation: number;
  /** Ceiling clearance above `elevation` (world units). */
  height: number;
  volumes: Volume[];
}

/** Reference to a volume on a specific floor. */
export interface VolumeRef {
  floor: number;
  volume: string;
}

/** A door connecting two volumes on the SAME floor. */
export interface DoorPortal {
  type: 'door';
  a: VolumeRef;
  b: VolumeRef;
  at: [number, number];
  width: number;
}

/**
 * A stair connecting two volumes on ADJACENT floors. The run is a straight
 * flight from `foot` (in `from`'s floor plane) rising in direction `dir`
 * (radians, 0 = +X, increasing toward +Z) until it spans the elevation delta
 * between `from` and `to`; the head lands inside `to`.
 */
export interface StairPortal {
  type: 'stair';
  from: VolumeRef;
  to: VolumeRef;
  foot: [number, number];
  /** Run direction in radians (0 = +X axis, increasing toward +Z). */
  dir: number;
  width: number;
}

/**
 * An ATRIUM: cuts an opening in the floor slab of the volume ABOVE (`over`),
 * so the volume below is open to it. Stack `void` portals across floors for a
 * multi-floor atrium.
 */
export interface VoidPortal {
  type: 'void';
  over: VolumeRef;
  opening: Rect;
}

export type Portal = DoorPortal | StairPortal | VoidPortal;

/** The "area" seam — a named point a player can be sent to (see module docs). */
export interface NamedExit {
  name: string;
  floor: number;
  at: [number, number];
}

/** A full authored level: floors of volumes, connecting portals, a spawn, and named exits. */
export interface LayoutDescriptor {
  id: string;
  floors: Floor[];
  portals: Portal[];
  spawn: { floor: number; pos: [number, number] };
  exits?: NamedExit[];
}

// ── Shared "area" seam (world + layout both satisfy this later) ────────────

/**
 * The minimal contract BOTH `layout` (this module) and the future `world`
 * open-world module can satisfy: a spawn point, named exits, and outer
 * bounds. A game that doesn't care whether it's standing in an authored
 * interior or an open zone can code against this interface alone.
 */
export interface Area {
  spawn: { pos: [number, number] };
  exits: NamedExit[];
  /** Outer bounds of the area on the XZ plane (a loose AABB, not per-room). */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

// ── Rect helpers ─────────────────────────────────────────────────────────────

/** Rect hull of a `Shape` — a `Rect` as-is, a `Poly` as its axis-aligned bounding rect. */
export function shapeRect(shape: Shape): Rect {
  if (shape.type === 'rect') return shape;
  const xs = shape.points.map((p) => p[0]);
  const zs = shape.points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  return { type: 'rect', x: minX, z: minZ, w: maxX - minX, d: maxZ - minZ };
}

function rectContains(r: Rect, x: number, z: number, eps = 1e-6): boolean {
  return x >= r.x - eps && x <= r.x + r.w + eps && z >= r.z - eps && z <= r.z + r.d + eps;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.z < b.z + b.d && a.z + a.d > b.z;
}

/** Intersection of two rects, or null if they don't overlap (touching is not overlap). */
function rectIntersect(a: Rect, b: Rect): Rect | null {
  const x0 = Math.max(a.x, b.x);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const z0 = Math.max(a.z, b.z);
  const z1 = Math.min(a.z + a.d, b.z + b.d);
  if (x1 <= x0 || z1 <= z0) return null;
  return { type: 'rect', x: x0, z: z0, w: x1 - x0, d: z1 - z0 };
}

function rectArea(r: Rect): number {
  return Math.max(0, r.w) * Math.max(0, r.d);
}

// ── Lookups ──────────────────────────────────────────────────────────────────

function findVolume(d: LayoutDescriptor, ref: VolumeRef): Volume | undefined {
  return d.floors[ref.floor]?.volumes.find((v) => v.id === ref.volume);
}

function refLabel(ref: VolumeRef): string {
  return `floor ${ref.floor}/${ref.volume}`;
}

// ── Validation ───────────────────────────────────────────────────────────────

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

/**
 * Validate a `LayoutDescriptor`'s referential + geometric integrity:
 *   - every volume id is unique within its floor; every floor index used by a
 *     portal/spawn/exit is in range
 *   - portal refs resolve to real volumes
 *   - door `at` lies on/inside BOTH connected volumes' rect hulls
 *   - stair `from`/`to` floors are adjacent (|Δfloor| === 1); `foot` lies
 *     inside `from`; the derived head (see {@link stairHead}) lies inside `to`
 *   - void `opening` lies inside its `over` volume's rect hull
 *   - spawn floor is in range and `pos` lies inside some volume on that floor
 * Returns `{ ok: true }` or `{ ok: false, errors }` with one message per
 * violation (does not stop at the first error — collects all of them).
 */
export function validateLayout(d: LayoutDescriptor): ValidationResult {
  const errors: string[] = [];

  // Duplicate volume ids (within a floor).
  d.floors.forEach((floor, fi) => {
    const seen = new Set<string>();
    for (const v of floor.volumes) {
      if (seen.has(v.id)) errors.push(`duplicate volume id "${v.id}" on floor ${fi}`);
      seen.add(v.id);
    }
  });

  // Duplicate top-level layout id is out of scope (single descriptor), but
  // duplicate portal identity isn't tracked (portals are unnamed) — skip.

  const checkRef = (ref: VolumeRef, where: string): Volume | undefined => {
    if (ref.floor < 0 || ref.floor >= d.floors.length) {
      errors.push(`${where}: floor ${ref.floor} out of range`);
      return undefined;
    }
    const vol = findVolume(d, ref);
    if (!vol) errors.push(`${where}: volume "${ref.volume}" not found on floor ${ref.floor}`);
    return vol;
  };

  d.portals.forEach((portal, pi) => {
    const where = `portal[${pi}] (${portal.type})`;
    if (portal.type === 'door') {
      const va = checkRef(portal.a, `${where}.a`);
      const vb = checkRef(portal.b, `${where}.b`);
      const [x, z] = portal.at;
      if (va && !rectContains(shapeRect(va.shape), x, z)) {
        errors.push(`${where}: at [${x}, ${z}] is outside volume ${refLabel(portal.a)}`);
      }
      if (vb && !rectContains(shapeRect(vb.shape), x, z)) {
        errors.push(`${where}: at [${x}, ${z}] is outside volume ${refLabel(portal.b)}`);
      }
    } else if (portal.type === 'stair') {
      const vFrom = checkRef(portal.from, `${where}.from`);
      const vTo = checkRef(portal.to, `${where}.to`);
      if (Math.abs(portal.from.floor - portal.to.floor) !== 1) {
        errors.push(`${where}: from/to floors must be adjacent (got ${portal.from.floor} -> ${portal.to.floor})`);
      }
      const [fx, fz] = portal.foot;
      if (vFrom && !rectContains(shapeRect(vFrom.shape), fx, fz)) {
        errors.push(`${where}: foot [${fx}, ${fz}] is outside volume ${refLabel(portal.from)}`);
      }
      if (vTo) {
        const [hx, hz] = stairHead(d, portal) ?? [NaN, NaN];
        if (!rectContains(shapeRect(vTo.shape), hx, hz)) {
          errors.push(`${where}: derived head [${hx.toFixed(2)}, ${hz.toFixed(2)}] is outside volume ${refLabel(portal.to)}`);
        }
      }
    } else {
      const vOver = checkRef(portal.over, `${where}.over`);
      if (vOver) {
        const overRect = shapeRect(vOver.shape);
        const corners: Array<[number, number]> = [
          [portal.opening.x, portal.opening.z],
          [portal.opening.x + portal.opening.w, portal.opening.z + portal.opening.d],
        ];
        for (const [x, z] of corners) {
          if (!rectContains(overRect, x, z)) {
            errors.push(`${where}: opening extends outside volume ${refLabel(portal.over)}`);
            break;
          }
        }
      }
    }
  });

  // Spawn.
  if (d.spawn.floor < 0 || d.spawn.floor >= d.floors.length) {
    errors.push(`spawn: floor ${d.spawn.floor} out of range`);
  } else {
    const [sx, sz] = d.spawn.pos;
    const inside = d.floors[d.spawn.floor]!.volumes.some((v) => rectContains(shapeRect(v.shape), sx, sz));
    if (!inside) errors.push(`spawn: pos [${sx}, ${sz}] is outside every volume on floor ${d.spawn.floor}`);
  }

  // Named exits.
  (d.exits ?? []).forEach((exit, ei) => {
    if (exit.floor < 0 || exit.floor >= d.floors.length) {
      errors.push(`exit[${ei}] "${exit.name}": floor ${exit.floor} out of range`);
    }
  });

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/**
 * The stair's landing point in `to`'s floor plane: `foot` translated by the
 * horizontal run implied by `dir` and the elevation delta (run length = |Δy|,
 * i.e. a 45°-equivalent flight — see module JSDoc on `buildStairRun` for the
 * actual step geometry). Null if either floor index is out of range.
 */
function stairHead(d: LayoutDescriptor, portal: StairPortal): [number, number] | null {
  const fromFloor = d.floors[portal.from.floor];
  const toFloor = d.floors[portal.to.floor];
  if (!fromFloor || !toFloor) return null;
  const rise = Math.abs(toFloor.elevation - fromFloor.elevation);
  const run = rise; // 1:1 horizontal run per vertical rise (documented in buildStairRun).
  const [fx, fz] = portal.foot;
  return [fx + Math.cos(portal.dir) * run, fz + Math.sin(portal.dir) * run];
}

// ── Geometry primitives ──────────────────────────────────────────────────────

/** A floor slab piece — one rect of a (possibly hole-punched) floor, at world Y `elevation`. */
export interface Slab {
  floor: number;
  elevation: number;
  rect: Rect;
}

/** A wall segment: a straight run along one side of a volume, floor-to-ceiling, with door gaps already cut out. */
export interface WallSeg {
  floor: number;
  volume: string;
  /** Segment endpoints on the XZ plane. */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Wall base Y (== floor elevation) and height (== floor ceiling clearance). */
  elevation: number;
  height: number;
}

/** A stair run: N steps rising from `fromElevation` to `toElevation` along `dir`. */
export interface StairRun {
  fromFloor: number;
  toFloor: number;
  foot: [number, number];
  dir: number;
  width: number;
  fromElevation: number;
  toElevation: number;
  /** Step count (derived from the elevation delta; see {@link buildLayoutGeometry}). */
  steps: number;
  /** Per-step rise (world units). */
  stepRise: number;
  /** Per-step run (horizontal, world units). */
  stepRun: number;
}

export interface LayoutGeometry {
  floors: Slab[];
  walls: WallSeg[];
  stairs: StairRun[];
}

const STEP_RISE = 0.2; // world units per step (a comfortable ~20cm rise at 1 unit = 1 metre).

/**
 * Rect-decomposition: `base` minus a set of hole `rects`, emitted as a
 * deterministic list of non-overlapping rects covering exactly `base` area
 * minus the (base-clipped) holes. Uses a simple horizontal-strip sweep over
 * hole Z boundaries — good enough for the axis-aligned rects this module
 * deals in (v1 treats polys as their rect hull, so this is the ONLY
 * decomposition shape needed). Holes outside `base` are ignored; holes are
 * clipped to `base` first so overlapping/out-of-bounds openings don't produce
 * negative-area slivers.
 */
export function decomposeRect(base: Rect, holes: Rect[]): Rect[] {
  const clipped = holes
    .map((h) => rectIntersect(base, h))
    .filter((h): h is Rect => h !== null && rectArea(h) > 1e-9);

  if (clipped.length === 0) return [{ ...base }];

  // Z boundaries: base top/bottom + every hole's top/bottom, sorted + deduped.
  const zsSet = new Set<number>([base.z, base.z + base.d]);
  for (const h of clipped) {
    zsSet.add(h.z);
    zsSet.add(h.z + h.d);
  }
  const zs = [...zsSet].sort((a, b) => a - b);

  const out: Rect[] = [];
  for (let i = 0; i < zs.length - 1; i++) {
    const z0 = zs[i]!;
    const z1 = zs[i + 1]!;
    const zMid = (z0 + z1) / 2;
    if (z1 - z0 <= 1e-9) continue;

    // Holes covering this strip, sorted by X.
    const stripHoles = clipped
      .filter((h) => h.z <= zMid && h.z + h.d >= zMid)
      .sort((a, b) => a.x - b.x);

    let cursor = base.x;
    for (const h of stripHoles) {
      if (h.x > cursor + 1e-9) {
        out.push({ type: 'rect', x: cursor, z: z0, w: h.x - cursor, d: z1 - z0 });
      }
      cursor = Math.max(cursor, h.x + h.w);
    }
    const rightEdge = base.x + base.w;
    if (rightEdge > cursor + 1e-9) {
      out.push({ type: 'rect', x: cursor, z: z0, w: rightEdge - cursor, d: z1 - z0 });
    }
  }
  return out;
}

/** Door portals touching (floor, volume), each carrying its gap half-width + position. */
function doorGapsFor(d: LayoutDescriptor, floor: number, volumeId: string): Array<{ at: [number, number]; width: number }> {
  const gaps: Array<{ at: [number, number]; width: number }> = [];
  for (const p of d.portals) {
    if (p.type !== 'door') continue;
    if ((p.a.floor === floor && p.a.volume === volumeId) || (p.b.floor === floor && p.b.volume === volumeId)) {
      gaps.push({ at: p.at, width: p.width });
    }
  }
  return gaps;
}

/**
 * Split ONE side (`x0,z0` -> `x1,z1`) of a volume's perimeter into wall
 * segments, cutting a gap of `width` centered at each door's `at` point that
 * projects onto this side (within half-width of the side's line and between
 * its endpoints). Deterministic: gaps are applied in ascending order along
 * the side's parametric length.
 */
function splitSideAtGaps(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  gaps: Array<{ at: [number, number]; width: number }>,
): Array<[number, number, number, number]> {
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len <= 1e-9) return [];
  const ux = (x1 - x0) / len;
  const uz = (z1 - z0) / len;

  // Project each gap onto this side; keep only those whose center lies within
  // [0, len] along the side and within a small perpendicular tolerance of it.
  type Cut = { t0: number; t1: number };
  const cuts: Cut[] = [];
  for (const g of gaps) {
    const dx = g.at[0] - x0;
    const dz = g.at[1] - z0;
    const t = dx * ux + dz * uz; // parametric position along the side
    const perp = Math.abs(dx * -uz + dz * ux); // perpendicular distance from the side's line
    if (perp > 0.05) continue; // not on this side
    const half = g.width / 2;
    const t0 = Math.max(0, t - half);
    const t1 = Math.min(len, t + half);
    if (t1 > t0) cuts.push({ t0, t1 });
  }
  cuts.sort((a, b) => a.t0 - b.t0);

  const segs: Array<[number, number, number, number]> = [];
  let cursor = 0;
  for (const c of cuts) {
    if (c.t0 > cursor + 1e-9) {
      segs.push([x0 + ux * cursor, z0 + uz * cursor, x0 + ux * c.t0, z0 + uz * c.t0]);
    }
    cursor = Math.max(cursor, c.t1);
  }
  if (len > cursor + 1e-9) {
    segs.push([x0 + ux * cursor, z0 + uz * cursor, x0 + ux * len, z0 + uz * len]);
  }
  return segs;
}

/** Wall segments tracing a volume's rect perimeter (4 sides), with door gaps cut. */
function buildVolumeWalls(d: LayoutDescriptor, floor: number, floorData: Floor, volume: Volume): WallSeg[] {
  const r = shapeRect(volume.shape);
  const gaps = doorGapsFor(d, floor, volume.id);
  const corners: Array<[number, number]> = [
    [r.x, r.z],
    [r.x + r.w, r.z],
    [r.x + r.w, r.z + r.d],
    [r.x, r.z + r.d],
  ];
  const walls: WallSeg[] = [];
  for (let i = 0; i < 4; i++) {
    const [x0, z0] = corners[i]!;
    const [x1, z1] = corners[(i + 1) % 4]!;
    const segs = splitSideAtGaps(x0, z0, x1, z1, gaps);
    for (const [sx0, sz0, sx1, sz1] of segs) {
      walls.push({
        floor,
        volume: volume.id,
        x0: sx0,
        z0: sz0,
        x1: sx1,
        z1: sz1,
        elevation: floorData.elevation,
        height: floorData.height,
      });
    }
  }
  return walls;
}

/**
 * Build the floor slabs for one floor: each volume's rect hull, minus any
 * void openings whose `over` ref points at THIS (floor, volume) — i.e. this
 * floor's slab has a hole punched where a lower floor's atrium looks up
 * through it.
 */
function buildFloorSlabs(d: LayoutDescriptor, floor: number, floorData: Floor): Slab[] {
  const slabs: Slab[] = [];
  for (const volume of floorData.volumes) {
    const r = shapeRect(volume.shape);
    const holes = d.portals
      .filter((p): p is VoidPortal => p.type === 'void' && p.over.floor === floor && p.over.volume === volume.id)
      .map((p) => p.opening);
    const pieces = decomposeRect(r, holes);
    for (const piece of pieces) {
      slabs.push({ floor, elevation: floorData.elevation, rect: piece });
    }
  }
  return slabs;
}

/**
 * Build a stair run's step count from the elevation delta at a fixed
 * per-step rise ({@link STEP_RISE}, ~0.2 world units). `stepRun` matches the
 * 1:1 horizontal-run-per-rise convention {@link stairHead} uses to derive the
 * landing point, spread evenly over the step count (so the flight's total
 * horizontal run always equals the vertical rise, same as `stairHead`).
 */
function buildStairRun(d: LayoutDescriptor, portal: StairPortal): StairRun | null {
  const fromFloor = d.floors[portal.from.floor];
  const toFloor = d.floors[portal.to.floor];
  if (!fromFloor || !toFloor) return null;
  const fromElevation = fromFloor.elevation;
  const toElevation = toFloor.elevation;
  const rise = Math.abs(toElevation - fromElevation);
  const steps = Math.max(1, Math.round(rise / STEP_RISE));
  return {
    fromFloor: portal.from.floor,
    toFloor: portal.to.floor,
    foot: portal.foot,
    dir: portal.dir,
    width: portal.width,
    fromElevation,
    toElevation,
    steps,
    stepRise: rise / steps,
    stepRun: rise / steps, // 1:1 total run == rise, spread evenly (matches stairHead).
  };
}

/**
 * Build the deterministic geometry primitives for a valid `LayoutDescriptor`:
 * floor slabs (rect-decomposed around void openings), wall segments (with
 * door gaps cut), and stair runs. Pure + THREE-free — a renderer (see
 * ./r3f.tsx) turns these into meshes. Does NOT validate; call
 * {@link validateLayout} first if the descriptor's provenance is untrusted.
 */
export function buildLayoutGeometry(d: LayoutDescriptor): LayoutGeometry {
  const floors: Slab[] = [];
  const walls: WallSeg[] = [];
  const stairs: StairRun[] = [];

  d.floors.forEach((floorData, fi) => {
    floors.push(...buildFloorSlabs(d, fi, floorData));
    for (const volume of floorData.volumes) {
      walls.push(...buildVolumeWalls(d, fi, floorData, volume));
    }
  });

  for (const portal of d.portals) {
    if (portal.type !== 'stair') continue;
    const run = buildStairRun(d, portal);
    if (run) stairs.push(run);
  }

  return { floors, walls, stairs };
}

// ── Bounds (BoundsConstraint-compatible clamp) ──────────────────────────────

/** A `(x, z) => [x, z]` clamp, matching `BoundsConstraint` in ../camera/index.ts. */
export type LayoutBoundsFn = (x: number, z: number) => [number, number];

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function clampToRect(x: number, z: number, r: Rect): { x: number; z: number; dist: number } {
  const cx = clamp(x, r.x, r.x + r.w);
  const cz = clamp(z, r.z, r.z + r.d);
  return { x: cx, z: cz, dist: Math.hypot(x - cx, z - cz) };
}

/**
 * Derive a `BoundsConstraint`-compatible clamp for one floor of a layout: the
 * point is kept inside the UNION of that floor's volume rects (rect hulls in
 * v1), allowing free pass-through across door gaps (a point already near a
 * door's opening is not pushed back just for straddling two rects). If the
 * point starts inside any volume, it's left alone (mid-room movement is
 * always free); otherwise it's clamped to the closest volume's rect — which
 * also naturally lets a player walk straight through a door gap between two
 * adjacent rects, since both rects individually admit the doorway's width.
 */
export function layoutBounds(d: LayoutDescriptor, floor: number): LayoutBoundsFn {
  const floorData = d.floors[floor];
  const rects = (floorData?.volumes ?? []).map((v) => shapeRect(v.shape));

  return (x: number, z: number): [number, number] => {
    if (rects.length === 0) return [x, z];

    // Already inside some volume — free movement (this is what makes crossing
    // a door gap work: at the gap, x/z lies inside BOTH adjoining rects since
    // door `at` is required (by validateLayout) to be inside both).
    for (const r of rects) {
      if (rectContains(r, x, z, 0)) return [x, z];
    }

    // Outside every volume — clamp to the nearest rect's boundary.
    let best = clampToRect(x, z, rects[0]!);
    for (let i = 1; i < rects.length; i++) {
      const cand = clampToRect(x, z, rects[i]!);
      if (cand.dist < best.dist) best = cand;
    }
    return [best.x, best.z];
  };
}

/**
 * Derive the {@link Area} seam for a layout: spawn + named exits + a loose
 * outer AABB across every floor's volumes (union, not per-floor — the
 * caller picks which floor's `layoutBounds` to enforce at runtime).
 */
export function layoutArea(d: LayoutDescriptor): Area {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const floorData of d.floors) {
    for (const v of floorData.volumes) {
      const r = shapeRect(v.shape);
      minX = Math.min(minX, r.x);
      maxX = Math.max(maxX, r.x + r.w);
      minZ = Math.min(minZ, r.z);
      maxZ = Math.max(maxZ, r.z + r.d);
    }
  }
  if (!isFinite(minX)) {
    minX = maxX = minZ = maxZ = 0;
  }
  return {
    spawn: { pos: d.spawn.pos },
    exits: d.exits ?? [],
    bounds: { minX, maxX, minZ, maxZ },
  };
}
