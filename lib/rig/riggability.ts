/**
 * riggability.ts — predict whether a GLB will auto-rig CLEANLY, BEFORE spending the
 * UniRig call.
 *
 * UniRig ("One Model to Rig Them All") rigs a clean humanoid superbly but maps a
 * NON-humanoid mesh ambiguously — e.g. a boss whose tendril crown fragments the mesh
 * into hundreds of disconnected islands, or a bust/blob with no separable limbs.
 * Riggability is set UPSTREAM (by the 2D input pose + mesh cleanliness), NOT by any
 * TRELLIS flag, so it is knowable from the mesh alone.
 *
 * This module PARSES the GLB binary itself (JSON chunk + BIN chunk; POSITION accessor
 * for vertices, the indices accessor for triangles — the standard glb layout) with no
 * dependencies, and computes three cheap geometric signals:
 *
 *   - island count — connected components over the triangle index graph (union-find).
 *     A clean generated humanoid is 1–few connected shells; hundreds of islands means
 *     fused/floating appendages that UniRig can't disambiguate.
 *   - aspect — bounding-box tall/wide ratio (height / max(width, depth)). A full body
 *     is tall (>2); a bust or blob is ~1.
 *   - symmetry — left/right (mirror across X) similarity of a coarse voxel occupancy
 *     histogram → 0..1 (1 = perfectly symmetric). Humanoids are fairly symmetric.
 *
 * Everything here is PURE + synchronously testable: `analyzeGlb(bytes)` takes the raw
 * GLB bytes; `scoreRiggability(metrics)` takes the raw numbers. The CLI
 * (scripts/rig/check-riggability.mjs) and scripts/auto-rig.mjs read the file and hand
 * the bytes in. No "server-only", no network, no fs.
 */

// ── Public shapes ─────────────────────────────────────────────────────────────
export type Verdict = "clean" | "risky";

export interface RiggabilityMetrics {
  /** Connected components over the triangle graph. Clean humanoid: 1–few. */
  islands: number;
  /** Bounding-box height / max(width, depth). Full body > 2; bust/blob ~1. */
  aspect: number;
  /** Left/right voxel-histogram similarity, 0..1 (1 = symmetric). */
  symmetry: number;
  /** Total vertices parsed from the POSITION accessor(s). */
  vertexCount: number;
  /** Total triangles parsed from the indices accessor(s). */
  triangleCount: number;
}

export interface RiggabilityReport extends RiggabilityMetrics {
  verdict: Verdict;
  /** Human-readable reasons a mesh was flagged risky (empty when clean). */
  reasons: string[];
}

// ── Thresholds (the simple rule) ──────────────────────────────────────────────
/**
 * A mesh is RISKY if ANY of these hold. Tuned so a clean full-body humanoid reads
 * CLEAN and a fragmented/blobby boss reads RISKY:
 *   - too many islands (fused/floating appendages UniRig can't separate)
 *   - too squat (a bust/blob, not a rigable full body)
 *   - too asymmetric (an off-axis creature, not a bilaterally-symmetric humanoid)
 */
export const RIGGABILITY_THRESHOLDS = {
  /**
   * More islands than this ⇒ risky. Calibrated on real TRELLIS output: a clean
   * generated full-body humanoid still carries ~130 disconnected shells (eyes, straps,
   * hair tufts, buckles) — that is NORMAL and rigs fine. Only EXTREME fragmentation
   * (the tendril boss = 556 islands, a crown that shatters into hundreds of tiny
   * shells) signals appendages UniRig can't disambiguate. So the gate sits well above
   * the humanoid baseline; aspect + symmetry do the body-shape discrimination.
   */
  maxIslands: 300,
  /** Height/width below this ⇒ risky (not a full standing body — a bust/blob is ~1). */
  minAspect: 1.5,
  /** Symmetry below this ⇒ risky (not a bilaterally-symmetric humanoid). */
  minSymmetry: 0.5,
} as const;

// ── GLB binary parsing ────────────────────────────────────────────────────────
const GLB_MAGIC = 0x46546c67; // "glTF" little-endian
const CHUNK_JSON = 0x4e4f534a; // "JSON"
const CHUNK_BIN = 0x004e4942; // "BIN\0"

// glTF component types (accessor.componentType) → byte size.
const COMPONENT_BYTES: Record<number, number> = {
  5120: 1, // BYTE
  5121: 1, // UNSIGNED_BYTE
  5122: 2, // SHORT
  5123: 2, // UNSIGNED_SHORT
  5125: 4, // UNSIGNED_INT
  5126: 4, // FLOAT
};
// glTF accessor.type → number of components.
const TYPE_COMPONENTS: Record<string, number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};

interface GltfAccessor {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
}
interface GltfBufferView {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
  byteStride?: number;
}
interface GltfJson {
  accessors?: GltfAccessor[];
  bufferViews?: GltfBufferView[];
  meshes?: { primitives: { attributes: Record<string, number>; indices?: number }[] }[];
}

export interface ParsedGlb {
  json: GltfJson;
  // ArrayBufferLike: a subarray of the caller's buffer (may be Buffer/SharedArrayBuffer).
  bin: Uint8Array<ArrayBufferLike>;
}

/** Read a little-endian uint32 from a byte offset. */
function u32(view: DataView, off: number): number {
  return view.getUint32(off, true);
}

/**
 * Parse a binary GLB into { json, bin }. Accepts a Uint8Array/Buffer/ArrayBuffer.
 * Throws on a malformed container.
 */
export function parseGlb(input: Uint8Array | ArrayBuffer): ParsedGlb {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 12) throw new Error("not a GLB: too short");
  if (u32(view, 0) !== GLB_MAGIC) throw new Error("not a GLB: bad magic");
  const version = u32(view, 4);
  if (version !== 2) throw new Error(`unsupported GLB version ${version} (need 2)`);

  let json: GltfJson | null = null;
  let bin: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  let off = 12;
  while (off + 8 <= bytes.byteLength) {
    const chunkLen = u32(view, off);
    const chunkType = u32(view, off + 4);
    const dataStart = off + 8;
    const dataEnd = dataStart + chunkLen;
    if (dataEnd > bytes.byteLength) throw new Error("GLB chunk overruns buffer");
    if (chunkType === CHUNK_JSON) {
      const text = new TextDecoder().decode(bytes.subarray(dataStart, dataEnd));
      json = JSON.parse(text) as GltfJson;
    } else if (chunkType === CHUNK_BIN) {
      bin = bytes.subarray(dataStart, dataEnd);
    }
    off = dataEnd;
  }
  if (!json) throw new Error("GLB has no JSON chunk");
  return { json, bin };
}

/** Read a whole accessor as a flat Float64 array (byteStride-aware). */
function readAccessorNumbers(parsed: ParsedGlb, accessorIndex: number): Float64Array {
  const { json, bin } = parsed;
  const accessor = json.accessors?.[accessorIndex];
  if (!accessor) throw new Error(`accessor ${accessorIndex} missing`);
  const view = json.bufferViews?.[accessor.bufferView ?? -1];
  if (!view) throw new Error(`bufferView for accessor ${accessorIndex} missing`);

  const comps = TYPE_COMPONENTS[accessor.type];
  const compBytes = COMPONENT_BYTES[accessor.componentType];
  if (!comps || !compBytes) {
    throw new Error(`unsupported accessor type ${accessor.type}/${accessor.componentType}`);
  }
  const elemBytes = comps * compBytes;
  const stride = view.byteStride && view.byteStride > 0 ? view.byteStride : elemBytes;
  const base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);

  const out = new Float64Array(accessor.count * comps);
  for (let i = 0; i < accessor.count; i++) {
    const elemOff = base + i * stride;
    for (let c = 0; c < comps; c++) {
      const o = elemOff + c * compBytes;
      let v: number;
      switch (accessor.componentType) {
        case 5126:
          v = dv.getFloat32(o, true);
          break;
        case 5125:
          v = dv.getUint32(o, true);
          break;
        case 5123:
          v = dv.getUint16(o, true);
          break;
        case 5122:
          v = dv.getInt16(o, true);
          break;
        case 5121:
          v = dv.getUint8(o);
          break;
        case 5120:
          v = dv.getInt8(o);
          break;
        default:
          v = 0;
      }
      out[i * comps + c] = v;
    }
  }
  return out;
}

// ── Union-find for island counting ────────────────────────────────────────────
class UnionFind {
  private parent: Int32Array;
  private rank: Uint8Array;
  constructor(n: number) {
    this.parent = new Int32Array(n);
    this.rank = new Uint8Array(n);
    for (let i = 0; i < n; i++) this.parent[i] = i;
  }
  find(x: number): number {
    let root = x;
    while (this.parent[root] !== root) root = this.parent[root]!;
    // path-compression
    while (this.parent[x] !== root) {
      const next = this.parent[x]!;
      this.parent[x] = root;
      x = next;
    }
    return root;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    if (this.rank[ra]! < this.rank[rb]!) this.parent[ra] = rb;
    else if (this.rank[ra]! > this.rank[rb]!) this.parent[rb] = ra;
    else {
      this.parent[rb] = ra;
      this.rank[ra]!++;
    }
  }
}

// ── Geometry gather ───────────────────────────────────────────────────────────
export interface MeshGeometry {
  /** Flat XYZ positions, length = vertexCount * 3. */
  positions: Float64Array;
  /** Flat triangle vertex indices, length = triangleCount * 3. */
  indices: Uint32Array;
  vertexCount: number;
  triangleCount: number;
}

/**
 * Collect ALL primitives' POSITION + indices into one global vertex/triangle soup,
 * offsetting each primitive's indices into the shared vertex array. A primitive with
 * no indices is treated as a sequential triangle list (0,1,2,3,4,5,…).
 */
export function gatherGeometry(parsed: ParsedGlb): MeshGeometry {
  const { json } = parsed;
  const positionsChunks: Float64Array[] = [];
  const indexChunks: { data: Uint32Array; base: number }[] = [];
  let vertexBase = 0;

  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      const posAcc = prim.attributes?.POSITION;
      if (posAcc === undefined) continue;
      const pos = readAccessorNumbers(parsed, posAcc);
      const vCount = pos.length / 3;
      positionsChunks.push(pos);

      if (prim.indices !== undefined) {
        const raw = readAccessorNumbers(parsed, prim.indices);
        const idx = new Uint32Array(raw.length);
        for (let i = 0; i < raw.length; i++) idx[i] = raw[i]!;
        indexChunks.push({ data: idx, base: vertexBase });
      } else {
        // non-indexed: sequential triangles over this primitive's vertices
        const idx = new Uint32Array(vCount);
        for (let i = 0; i < vCount; i++) idx[i] = i;
        indexChunks.push({ data: idx, base: vertexBase });
      }
      vertexBase += vCount;
    }
  }

  // Concatenate positions.
  const vertexCount = vertexBase;
  const positions = new Float64Array(vertexCount * 3);
  {
    let o = 0;
    for (const chunk of positionsChunks) {
      positions.set(chunk, o);
      o += chunk.length;
    }
  }

  // Concatenate + offset indices (drop any trailing partial triangle).
  let totalIdx = 0;
  for (const c of indexChunks) totalIdx += c.data.length - (c.data.length % 3);
  const indices = new Uint32Array(totalIdx);
  {
    let o = 0;
    for (const c of indexChunks) {
      const usable = c.data.length - (c.data.length % 3);
      for (let i = 0; i < usable; i++) indices[o++] = c.data[i]! + c.base;
    }
  }

  return {
    positions,
    indices,
    vertexCount,
    triangleCount: indices.length / 3,
  };
}

// ── Metric computations ───────────────────────────────────────────────────────
/** Count connected components over the triangle index graph (union-find). */
export function countIslands(geo: MeshGeometry): number {
  if (geo.vertexCount === 0) return 0;
  const uf = new UnionFind(geo.vertexCount);
  const { indices } = geo;
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t]!;
    const b = indices[t + 1]!;
    const c = indices[t + 2]!;
    uf.union(a, b);
    uf.union(b, c);
  }
  // Count roots only among vertices that participate in a triangle — isolated,
  // unreferenced POSITION entries would otherwise inflate the count.
  const used = new Uint8Array(geo.vertexCount);
  for (let i = 0; i < indices.length; i++) used[indices[i]!] = 1;
  const roots = new Set<number>();
  for (let v = 0; v < geo.vertexCount; v++) {
    if (used[v]) roots.add(uf.find(v));
  }
  return roots.size;
}

export interface Bounds {
  min: [number, number, number];
  max: [number, number, number];
}

export function boundingBox(geo: MeshGeometry): Bounds {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const p = geo.positions;
  for (let i = 0; i < p.length; i += 3) {
    for (let c = 0; c < 3; c++) {
      const v = p[i + c]!;
      if (v < min[c]!) min[c] = v;
      if (v > max[c]!) max[c] = v;
    }
  }
  if (!Number.isFinite(min[0])) {
    return { min: [0, 0, 0], max: [0, 0, 0] };
  }
  return { min, max };
}

/**
 * Bounding-box tall/wide ratio. We do NOT assume which axis is "up": we take the
 * LONGEST box dimension as height and the larger of the remaining two as width, so a
 * Y-up or Z-up export both read the same. Full body ≈ tall (>2); bust/blob ≈ 1.
 */
export function computeAspect(bounds: Bounds): number {
  const dims = [
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
  ].sort((a, b) => b - a);
  const height = dims[0]!;
  const width = Math.max(dims[1]!, 1e-9);
  return height / width;
}

/**
 * Left/right symmetry across the X axis (X is the standard left/right axis for our
 * front-orthographic characters). Bin vertices into a coarse voxel grid over the
 * bounding box; build two occupancy histograms — vertices with +X vs −X (relative to
 * the mid-X plane), the −X side mirrored onto the +X side — and return their cosine
 * similarity, 0..1. 1 = perfectly bilaterally symmetric.
 */
export function computeSymmetry(geo: MeshGeometry, bounds: Bounds, grid = 12): number {
  const p = geo.positions;
  if (p.length === 0) return 0;
  const midX = (bounds.min[0]! + bounds.max[0]!) / 2;
  const size: [number, number, number] = [
    Math.max(bounds.max[0]! - bounds.min[0]!, 1e-9),
    Math.max(bounds.max[1]! - bounds.min[1]!, 1e-9),
    Math.max(bounds.max[2]! - bounds.min[2]!, 1e-9),
  ];
  // Histograms are keyed by (bin of |distance-from-mid| along X, Y bin, Z bin) so a
  // point and its mirror land in the SAME cell. We count the +side and −side apart.
  const half = grid; // bins along the half-X axis
  const cells = half * grid * grid;
  const pos = new Float64Array(cells);
  const neg = new Float64Array(cells);

  const clamp = (n: number, hi: number) => (n < 0 ? 0 : n >= hi ? hi - 1 : n);
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i]!;
    const y = p[i + 1]!;
    const z = p[i + 2]!;
    const dx = Math.abs(x - midX);
    const bx = clamp(Math.floor((dx / (size[0] / 2)) * half), half);
    const by = clamp(Math.floor(((y - bounds.min[1]!) / size[1]) * grid), grid);
    const bz = clamp(Math.floor(((z - bounds.min[2]!) / size[2]) * grid), grid);
    const cell = (bx * grid + by) * grid + bz;
    if (x >= midX) pos[cell]! += 1;
    else neg[cell]! += 1;
  }

  // Cosine similarity between the two occupancy histograms.
  let dot = 0;
  let np = 0;
  let nn = 0;
  for (let i = 0; i < cells; i++) {
    dot += pos[i]! * neg[i]!;
    np += pos[i]! * pos[i]!;
    nn += neg[i]! * neg[i]!;
  }
  if (np === 0 || nn === 0) return 0;
  return dot / (Math.sqrt(np) * Math.sqrt(nn));
}

// ── Scoring ───────────────────────────────────────────────────────────────────
/** Apply the simple rule to raw metrics → { verdict, reasons }. Pure. */
export function scoreRiggability(metrics: RiggabilityMetrics): RiggabilityReport {
  const reasons: string[] = [];
  const T = RIGGABILITY_THRESHOLDS;
  if (metrics.islands > T.maxIslands) {
    reasons.push(
      `${metrics.islands} disconnected islands (> ${T.maxIslands}) — fused/floating appendages rig ambiguously`,
    );
  }
  if (metrics.aspect < T.minAspect) {
    reasons.push(
      `aspect ${metrics.aspect.toFixed(2)} (< ${T.minAspect}) — squat/bust, not a full standing body`,
    );
  }
  if (metrics.symmetry < T.minSymmetry) {
    reasons.push(
      `symmetry ${metrics.symmetry.toFixed(2)} (< ${T.minSymmetry}) — not bilaterally symmetric`,
    );
  }
  return {
    ...metrics,
    verdict: reasons.length ? "risky" : "clean",
    reasons,
  };
}

// ── One-shot entry ────────────────────────────────────────────────────────────
/** Parse GLB bytes → full riggability report. Pure + synchronous. */
export function analyzeGlb(input: Uint8Array | ArrayBuffer): RiggabilityReport {
  const parsed = parseGlb(input);
  const geo = gatherGeometry(parsed);
  const bounds = boundingBox(geo);
  const metrics: RiggabilityMetrics = {
    islands: countIslands(geo),
    aspect: computeAspect(bounds),
    symmetry: computeSymmetry(geo, bounds),
    vertexCount: geo.vertexCount,
    triangleCount: geo.triangleCount,
  };
  return scoreRiggability(metrics);
}

/** One-line human summary for logs/CLI. */
export function formatReport(r: RiggabilityReport): string {
  const head =
    `verdict=${r.verdict.toUpperCase()} ` +
    `islands=${r.islands} aspect=${r.aspect.toFixed(2)} symmetry=${r.symmetry.toFixed(2)} ` +
    `(${r.vertexCount} verts, ${r.triangleCount} tris)`;
  if (r.reasons.length === 0) return head;
  return head + "\n  - " + r.reasons.join("\n  - ");
}
