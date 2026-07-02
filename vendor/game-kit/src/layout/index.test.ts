import { describe, it, expect } from 'vitest';
import {
  validateLayout,
  buildLayoutGeometry,
  layoutBounds,
  layoutArea,
  decomposeRect,
  type LayoutDescriptor,
  type Rect,
} from './index.js';

// Pure, THREE-free contract for the layout core — validation error classes,
// slab rect-decomposition, wall door-gaps, stair runs, and bounds clamping.

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** Simple single-floor, single-room layout — the smallest valid descriptor. */
function oneRoom(): LayoutDescriptor {
  return {
    id: 'one-room',
    floors: [
      {
        elevation: 0,
        height: 3,
        volumes: [{ id: 'hall', kind: 'room', shape: { type: 'rect', x: 0, z: 0, w: 10, d: 10 } }],
      },
    ],
    portals: [],
    spawn: { floor: 0, pos: [5, 5] },
  };
}

/** Two floors, one stair, one atrium void — the "deceive-me-daddy" integration fixture. */
function twoFloorAtrium(): LayoutDescriptor {
  return {
    id: 'atrium',
    floors: [
      {
        elevation: 0,
        height: 3,
        volumes: [
          { id: 'lobby', kind: 'room', shape: { type: 'rect', x: 0, z: 0, w: 10, d: 10 } },
          { id: 'stairhall', kind: 'hall', shape: { type: 'rect', x: 10, z: 0, w: 4, d: 4 } },
        ],
      },
      {
        elevation: 3,
        height: 3,
        volumes: [
          { id: 'gallery', kind: 'room', shape: { type: 'rect', x: 0, z: 0, w: 10, d: 10 } },
          { id: 'landing', kind: 'hall', shape: { type: 'rect', x: 10, z: 0, w: 4, d: 4 } },
        ],
      },
    ],
    portals: [
      { type: 'door', a: { floor: 0, volume: 'lobby' }, b: { floor: 0, volume: 'stairhall' }, at: [10, 2], width: 1.2 },
      {
        type: 'stair',
        from: { floor: 0, volume: 'stairhall' },
        to: { floor: 1, volume: 'landing' },
        foot: [11, 1],
        dir: 0, // +X: lands at [11 + 3, 1] = [14, 1] — inside landing [10..14]x[0..4]
        width: 1.2,
      },
      {
        type: 'void',
        over: { floor: 1, volume: 'gallery' },
        opening: { type: 'rect', x: 2, z: 2, w: 3, d: 3 },
      },
    ],
    spawn: { floor: 0, pos: [5, 5] },
    exits: [{ name: 'main-entry', floor: 0, at: [0, 5] }],
  };
}

// ── validateLayout ───────────────────────────────────────────────────────────

describe('validateLayout — happy paths', () => {
  it('accepts the minimal one-room layout', () => {
    expect(validateLayout(oneRoom())).toEqual({ ok: true });
  });

  it('accepts the two-floor stair + atrium fixture', () => {
    expect(validateLayout(twoFloorAtrium())).toEqual({ ok: true });
  });
});

describe('validateLayout — error classes', () => {
  it('flags a duplicate volume id on the same floor', () => {
    const d = oneRoom();
    d.floors[0]!.volumes.push({ id: 'hall', kind: 'room', shape: { type: 'rect', x: 20, z: 0, w: 2, d: 2 } });
    const r = validateLayout(d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes('duplicate volume id'))).toBe(true);
  });

  it('flags a door referencing a missing volume', () => {
    const d = oneRoom();
    d.portals.push({
      type: 'door',
      a: { floor: 0, volume: 'hall' },
      b: { floor: 0, volume: 'nonexistent' },
      at: [5, 0],
      width: 1,
    });
    const r = validateLayout(d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes('not found'))).toBe(true);
  });

  it('flags a door "at" point outside one of its volumes', () => {
    const d = oneRoom();
    d.floors[0]!.volumes.push({ id: 'annex', kind: 'room', shape: { type: 'rect', x: 20, z: 0, w: 5, d: 5 } });
    d.portals.push({
      type: 'door',
      a: { floor: 0, volume: 'hall' },
      b: { floor: 0, volume: 'annex' },
      at: [5, 5], // inside hall, nowhere near annex
      width: 1,
    });
    const r = validateLayout(d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes('outside volume floor 0/annex'))).toBe(true);
  });

  it('flags a stair spanning non-adjacent floors', () => {
    const d = twoFloorAtrium();
    d.floors.push({
      elevation: 6,
      height: 3,
      volumes: [{ id: 'roof', kind: 'room', shape: { type: 'rect', x: 0, z: 0, w: 10, d: 10 } }],
    });
    d.portals.push({
      type: 'stair',
      from: { floor: 0, volume: 'lobby' },
      to: { floor: 2, volume: 'roof' },
      foot: [5, 5],
      dir: 0,
      width: 1,
    });
    const r = validateLayout(d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes('adjacent'))).toBe(true);
  });

  it('flags a stair whose foot is outside its "from" volume', () => {
    const d = twoFloorAtrium();
    d.portals.push({
      type: 'stair',
      from: { floor: 0, volume: 'lobby' },
      to: { floor: 1, volume: 'landing' },
      foot: [-5, -5], // outside lobby
      dir: 0,
      width: 1,
    });
    const r = validateLayout(d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes('foot') && e.includes('outside'))).toBe(true);
  });

  it('flags a stair whose derived head lands outside its "to" volume', () => {
    const d = twoFloorAtrium();
    d.portals.push({
      type: 'stair',
      from: { floor: 0, volume: 'stairhall' },
      to: { floor: 1, volume: 'landing' },
      foot: [11, 1],
      dir: Math.PI, // -X direction — head lands far outside landing
      width: 1,
    });
    const r = validateLayout(d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes('derived head'))).toBe(true);
  });

  it('flags a void opening extending outside its "over" volume', () => {
    const d = twoFloorAtrium();
    d.portals.push({
      type: 'void',
      over: { floor: 1, volume: 'gallery' },
      opening: { type: 'rect', x: 8, z: 8, w: 5, d: 5 }, // extends past gallery's [0..10]x[0..10]
    });
    const r = validateLayout(d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes('opening extends outside'))).toBe(true);
  });

  it('flags a spawn point outside every volume on its floor', () => {
    const d = oneRoom();
    d.spawn = { floor: 0, pos: [500, 500] };
    const r = validateLayout(d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes('spawn'))).toBe(true);
  });

  it('flags a spawn floor out of range', () => {
    const d = oneRoom();
    d.spawn = { floor: 9, pos: [0, 0] };
    const r = validateLayout(d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes('floor 9 out of range'))).toBe(true);
  });

  it('collects multiple independent errors in one pass', () => {
    const d = oneRoom();
    d.spawn = { floor: 0, pos: [500, 500] };
    d.portals.push({
      type: 'door',
      a: { floor: 0, volume: 'hall' },
      b: { floor: 0, volume: 'missing' },
      at: [5, 5],
      width: 1,
    });
    const r = validateLayout(d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ── decomposeRect (slab rect-decomposition) ────────────────────────────────

describe('decomposeRect', () => {
  it('returns the base rect unchanged when there are no holes', () => {
    const base: Rect = { type: 'rect', x: 0, z: 0, w: 10, d: 10 };
    expect(decomposeRect(base, [])).toEqual([base]);
  });

  it('conserves area when punching a hole fully inside the base', () => {
    const base: Rect = { type: 'rect', x: 0, z: 0, w: 10, d: 10 };
    const hole: Rect = { type: 'rect', x: 2, z: 2, w: 3, d: 3 };
    const pieces = decomposeRect(base, [hole]);
    const total = pieces.reduce((sum, r) => sum + r.w * r.d, 0);
    expect(total).toBeCloseTo(100 - 9, 6);
  });

  it('produces non-overlapping pieces that never intersect the hole', () => {
    const base: Rect = { type: 'rect', x: 0, z: 0, w: 10, d: 10 };
    const hole: Rect = { type: 'rect', x: 2, z: 2, w: 3, d: 3 };
    const pieces = decomposeRect(base, [hole]);
    for (const p of pieces) {
      const overlapsHole = p.x < hole.x + hole.w && p.x + p.w > hole.x && p.z < hole.z + hole.d && p.z + p.d > hole.z;
      expect(overlapsHole).toBe(false);
    }
  });

  it('conserves area with multiple non-overlapping holes', () => {
    const base: Rect = { type: 'rect', x: 0, z: 0, w: 20, d: 20 };
    const holes: Rect[] = [
      { type: 'rect', x: 1, z: 1, w: 2, d: 2 },
      { type: 'rect', x: 10, z: 10, w: 4, d: 4 },
    ];
    const pieces = decomposeRect(base, holes);
    const total = pieces.reduce((sum, r) => sum + r.w * r.d, 0);
    expect(total).toBeCloseTo(400 - 4 - 16, 6);
  });

  it('clips a hole that extends outside the base before subtracting', () => {
    const base: Rect = { type: 'rect', x: 0, z: 0, w: 10, d: 10 };
    const hole: Rect = { type: 'rect', x: 8, z: 8, w: 10, d: 10 }; // extends to [18,18], clipped to [8..10]x[8..10]
    const pieces = decomposeRect(base, [hole]);
    const total = pieces.reduce((sum, r) => sum + r.w * r.d, 0);
    expect(total).toBeCloseTo(100 - 4, 6); // clipped hole is 2x2 = 4
  });

  it('a hole covering the entire base leaves no pieces', () => {
    const base: Rect = { type: 'rect', x: 0, z: 0, w: 5, d: 5 };
    const hole: Rect = { type: 'rect', x: 0, z: 0, w: 5, d: 5 };
    expect(decomposeRect(base, [hole])).toEqual([]);
  });
});

// ── buildLayoutGeometry ──────────────────────────────────────────────────────

describe('buildLayoutGeometry — floor slabs', () => {
  it('emits a single unbroken slab for a room with no void above nothing', () => {
    const geo = buildLayoutGeometry(oneRoom());
    expect(geo.floors).toHaveLength(1);
    expect(geo.floors[0]!.rect).toEqual({ type: 'rect', x: 0, z: 0, w: 10, d: 10 });
  });

  it('punches a hole in the slab of the volume ABOVE a void portal', () => {
    const geo = buildLayoutGeometry(twoFloorAtrium());
    // Floor 1's "gallery" slab is hole-punched; floor 0 is untouched.
    const floor0Gallery = geo.floors.filter((s) => s.floor === 0);
    const floor1Gallery = geo.floors.filter((s) => s.floor === 1);
    const floor0Area = floor0Gallery.reduce((sum, s) => sum + s.rect.w * s.rect.d, 0);
    const floor1Area = floor1Gallery.reduce((sum, s) => sum + s.rect.w * s.rect.d, 0);
    // floor 0: lobby (100) + stairhall (16) = 116, no holes.
    expect(floor0Area).toBeCloseTo(116, 6);
    // floor 1: gallery (100 - 3*3=9 hole) + landing (16) = 107.
    expect(floor1Area).toBeCloseTo(107, 6);
  });
});

describe('buildLayoutGeometry — wall door gaps', () => {
  it('a room with no doors has an unbroken perimeter (4 wall segments)', () => {
    const geo = buildLayoutGeometry(oneRoom());
    expect(geo.walls).toHaveLength(4);
  });

  it('cuts a gap exactly where a door portal sits on a volume side', () => {
    const d = twoFloorAtrium();
    const geo = buildLayoutGeometry(d);
    const lobbyWalls = geo.walls.filter((w) => w.floor === 0 && w.volume === 'lobby');
    // The east side (x=10) of lobby [0..10]x[0..10] has a door at [10, 2] width 1.2,
    // so that side splits into two segments instead of one straight run.
    const eastSideSegs = lobbyWalls.filter((w) => w.x0 === 10 && w.x1 === 10);
    expect(eastSideSegs.length).toBe(2);
    // Gap is centered at z=2 with width 1.2 -> [1.4, 2.6] is missing from the side.
    const covered = eastSideSegs
      .map((w) => [Math.min(w.z0, w.z1), Math.max(w.z0, w.z1)] as const)
      .sort((a, b) => a[0] - b[0]);
    expect(covered[0]![0]).toBeCloseTo(0, 6);
    expect(covered[0]![1]).toBeCloseTo(1.4, 6);
    expect(covered[1]![0]).toBeCloseTo(2.6, 6);
    expect(covered[1]![1]).toBeCloseTo(10, 6);
  });

  it('the matching gap is also cut on the OTHER side of the door (stairhall)', () => {
    const geo = buildLayoutGeometry(twoFloorAtrium());
    const stairhallWalls = geo.walls.filter((w) => w.floor === 0 && w.volume === 'stairhall');
    // stairhall is [10..14]x[0..4]; its west side (x=10) has the same door gap.
    const westSideSegs = stairhallWalls.filter((w) => w.x0 === 10 && w.x1 === 10);
    expect(westSideSegs.length).toBe(2);
  });
});

describe('buildLayoutGeometry — stair runs', () => {
  it('spans exactly the elevation delta between the connected floors', () => {
    const geo = buildLayoutGeometry(twoFloorAtrium());
    expect(geo.stairs).toHaveLength(1);
    const run = geo.stairs[0]!;
    expect(run.toElevation - run.fromElevation).toBeCloseTo(3, 6);
    expect(run.steps * run.stepRise).toBeCloseTo(3, 6);
  });

  it('produces at least one step even for a tiny elevation delta', () => {
    const d = oneRoom();
    d.floors.push({
      elevation: 0.05,
      height: 3,
      volumes: [{ id: 'mezz', kind: 'room', shape: { type: 'rect', x: 0, z: 0, w: 10, d: 10 } }],
    });
    d.portals.push({
      type: 'stair',
      from: { floor: 0, volume: 'hall' },
      to: { floor: 1, volume: 'mezz' },
      foot: [1, 1],
      dir: 0,
      width: 1,
    });
    const geo = buildLayoutGeometry(d);
    expect(geo.stairs).toHaveLength(1);
    expect(geo.stairs[0]!.steps).toBeGreaterThanOrEqual(1);
  });
});

describe('buildLayoutGeometry — determinism', () => {
  it('the same descriptor builds deep-equal geometry every time', () => {
    const d = twoFloorAtrium();
    const a = buildLayoutGeometry(d);
    const b = buildLayoutGeometry(d);
    expect(a).toEqual(b);
  });

  it('a fresh equivalent descriptor object also builds deep-equal geometry', () => {
    const a = buildLayoutGeometry(twoFloorAtrium());
    const b = buildLayoutGeometry(twoFloorAtrium());
    expect(a).toEqual(b);
  });
});

// ── layoutBounds ─────────────────────────────────────────────────────────────

describe('layoutBounds', () => {
  it('leaves a point already inside a volume unchanged', () => {
    const bounds = layoutBounds(oneRoom(), 0);
    expect(bounds(5, 5)).toEqual([5, 5]);
  });

  it('clamps a point outside every volume back to the nearest wall', () => {
    const bounds = layoutBounds(oneRoom(), 0);
    const [x, z] = bounds(15, 5);
    expect(x).toBeCloseTo(10, 6);
    expect(z).toBeCloseTo(5, 6);
  });

  it('blocks straight through a solid wall (no door) back to the boundary', () => {
    const bounds = layoutBounds(oneRoom(), 0);
    const [x, z] = bounds(-3, -3);
    expect(x).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(0, 6);
  });

  it('lets a point cross a doorway between two adjoining volumes', () => {
    const bounds = layoutBounds(twoFloorAtrium(), 0);
    // The door sits at [10, 2] connecting lobby [0..10]x[0..10] and stairhall [10..14]x[0..4].
    // A point exactly at the door threshold is inside BOTH rects -> unclamped.
    expect(bounds(10, 2)).toEqual([10, 2]);
    // Points just inside each side of the doorway are also free (both inside their own rect).
    expect(bounds(9.9, 2)).toEqual([9.9, 2]);
    expect(bounds(10.1, 2)).toEqual([10.1, 2]);
  });

  it('returns the input unchanged when the floor has no volumes', () => {
    const d = oneRoom();
    d.floors.push({ elevation: 3, height: 3, volumes: [] });
    const bounds = layoutBounds(d, 1);
    expect(bounds(42, -17)).toEqual([42, -17]);
  });
});

// ── layoutArea (the "area" seam) ─────────────────────────────────────────────

describe('layoutArea', () => {
  it('exposes spawn + exits + a loose outer AABB across every floor', () => {
    const area = layoutArea(twoFloorAtrium());
    expect(area.spawn.pos).toEqual([5, 5]);
    expect(area.exits).toEqual([{ name: 'main-entry', floor: 0, at: [0, 5] }]);
    // Union of lobby/stairhall/gallery/landing rects: x in [0,14], z in [0,10].
    expect(area.bounds).toEqual({ minX: 0, maxX: 14, minZ: 0, maxZ: 10 });
  });

  it('degenerates to a zero-sized bounds when there are no volumes anywhere', () => {
    const d: LayoutDescriptor = {
      id: 'empty',
      floors: [{ elevation: 0, height: 3, volumes: [] }],
      portals: [],
      spawn: { floor: 0, pos: [0, 0] },
    };
    const area = layoutArea(d);
    expect(area.bounds).toEqual({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 });
  });

  it('defaults exits to an empty array when omitted', () => {
    const area = layoutArea(oneRoom());
    expect(area.exits).toEqual([]);
  });
});

// ── Integration: the two-floor stair + atrium fixture end-to-end ───────────

describe('integration — two-floor stair + atrium ("deceive-me-daddy")', () => {
  it('validates', () => {
    expect(validateLayout(twoFloorAtrium())).toEqual({ ok: true });
  });

  it('builds slabs, walls, and a stair run together', () => {
    const geo = buildLayoutGeometry(twoFloorAtrium());
    expect(geo.floors.length).toBeGreaterThan(0);
    expect(geo.walls.length).toBeGreaterThan(0);
    expect(geo.stairs).toHaveLength(1);
  });
});
