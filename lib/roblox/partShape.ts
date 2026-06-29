import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  SphereGeometry,
  type BufferGeometry,
} from "three";

/**
 * Pick a low-poly three.js primitive for a socket by NAME heuristic, sized from
 * the part's `size` (already in the caller's units — metres at render time).
 *
 * The greybox no longer renders every socket as the same box: a 'head' reads as
 * a rounded blob, limbs as cylinders, the tail as a taper, so an assembled
 * descriptor silhouettes as a creature rather than a pile of cubes. Geometry
 * only — colour/position/scale stay the caller's job. Pure (three.js only).
 *
 * Heuristic (case-insensitive substring on the socket name):
 *   head            → SphereGeometry scaled to the part box (rounded blob)
 *   leg / arm / neck→ CylinderGeometry along Y, radius from x/z footprint
 *   tail            → tapered CylinderGeometry (narrow tip) along its long axis
 *   torso / body /  → BoxGeometry (default)
 *   default
 *
 * Segment counts are kept deliberately low so the look stays faceted greybox.
 */
export function socketGeometry(
  socketName: string,
  size: readonly [number, number, number],
): BufferGeometry {
  const [sx, sy, sz] = size;
  const name = socketName.toLowerCase();

  // Head → rounded blob. A unit sphere scaled (via matrix bake) to the part box
  // so a non-cubic head still reads as an egg/dome, not a perfect ball.
  if (name.includes("head")) {
    const geom = new SphereGeometry(0.5, 12, 8);
    geom.scale(sx, sy, sz);
    return geom;
  }

  // Tail → taper: a narrow tip, fat base. Modelled as a CylinderGeometry with a
  // small top radius, oriented along the part's longest horizontal/depth axis.
  if (name.includes("tail")) {
    return taperedGeometry(sx, sy, sz);
  }

  // Limbs + neck → cylinders along their long (Y) axis. Radius from the smaller
  // of the x/z footprint so a thin part stays thin.
  if (
    name.includes("leg") ||
    name.includes("arm") ||
    name.includes("neck")
  ) {
    const radius = Math.max(Math.min(sx, sz) / 2, 1e-4);
    const height = Math.max(sy, 1e-4);
    return new CylinderGeometry(radius, radius, height, 10);
  }

  // Torso / body / anything else → box.
  return new BoxGeometry(Math.max(sx, 1e-4), Math.max(sy, 1e-4), Math.max(sz, 1e-4));
}

/**
 * A tapered limb/tail: fat base → narrow tip. Built as a CylinderGeometry, then
 * oriented so its length runs along the part's longest axis. Tails in the
 * fixtures are long in Z (and sometimes Y), so we rotate the default Y-axis
 * cylinder onto whichever of Y/Z is longest.
 */
function taperedGeometry(
  sx: number,
  sy: number,
  sz: number,
): BufferGeometry {
  const radius = Math.max(Math.min(sx, sy, sz) / 2, 1e-4);
  // Length runs along the longest dimension; tip is ~25% of base radius.
  const longestIsZ = sz >= sy && sz >= sx;
  const length = Math.max(longestIsZ ? sz : sy, 1e-4);

  const geom = new CylinderGeometry(radius * 0.25, radius, length, 10);
  // Cylinder defaults to Y-up; rotate onto Z if the tail is depth-long.
  if (longestIsZ) {
    geom.rotateX(Math.PI / 2);
  }
  return geom;
}
