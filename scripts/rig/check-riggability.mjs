#!/usr/bin/env node
/**
 * check-riggability.mjs — CLI: predict whether a GLB will auto-rig CLEANLY.
 *
 *   node scripts/rig/check-riggability.mjs <glb> [--json]
 *
 * Prints island count / aspect / symmetry + a clean|risky verdict with reasons,
 * BEFORE spending a UniRig call. This is the node/CLI twin of the tested pure module
 * lib/rig/riggability.ts (same layout the auto-rig CLI uses: a plain-ESM mirror of a
 * server-only TS unit — behaviour must stay in sync). The TS module is the tested
 * source of truth; keep the maths here identical to it.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ── Thresholds (mirror lib/rig/riggability.ts) ────────────────────────────────
export const RIGGABILITY_THRESHOLDS = { maxIslands: 300, minAspect: 1.5, minSymmetry: 0.5 };

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const COMPONENT_BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

export function parseGlb(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 12) throw new Error("not a GLB: too short");
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error("not a GLB: bad magic");
  if (view.getUint32(4, true) !== 2) throw new Error("unsupported GLB version (need 2)");
  let json = null;
  let bin = new Uint8Array(0);
  let off = 12;
  while (off + 8 <= bytes.byteLength) {
    const len = view.getUint32(off, true);
    const type = view.getUint32(off + 4, true);
    const start = off + 8;
    const end = start + len;
    if (end > bytes.byteLength) throw new Error("GLB chunk overruns buffer");
    if (type === CHUNK_JSON) json = JSON.parse(new TextDecoder().decode(bytes.subarray(start, end)));
    else if (type === CHUNK_BIN) bin = bytes.subarray(start, end);
    off = end;
  }
  if (!json) throw new Error("GLB has no JSON chunk");
  return { json, bin };
}

function readAccessor({ json, bin }, i) {
  const acc = json.accessors?.[i];
  if (!acc) throw new Error(`accessor ${i} missing`);
  const bv = json.bufferViews?.[acc.bufferView ?? -1];
  if (!bv) throw new Error(`bufferView for accessor ${i} missing`);
  const comps = TYPE_COMPONENTS[acc.type];
  const cb = COMPONENT_BYTES[acc.componentType];
  if (!comps || !cb) throw new Error(`unsupported accessor ${acc.type}/${acc.componentType}`);
  const elem = comps * cb;
  const stride = bv.byteStride && bv.byteStride > 0 ? bv.byteStride : elem;
  const base = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const out = new Float64Array(acc.count * comps);
  for (let n = 0; n < acc.count; n++) {
    const eo = base + n * stride;
    for (let c = 0; c < comps; c++) {
      const o = eo + c * cb;
      let v = 0;
      switch (acc.componentType) {
        case 5126: v = dv.getFloat32(o, true); break;
        case 5125: v = dv.getUint32(o, true); break;
        case 5123: v = dv.getUint16(o, true); break;
        case 5122: v = dv.getInt16(o, true); break;
        case 5121: v = dv.getUint8(o); break;
        case 5120: v = dv.getInt8(o); break;
      }
      out[n * comps + c] = v;
    }
  }
  return out;
}

export function gatherGeometry(parsed) {
  const { json } = parsed;
  const posChunks = [];
  const idxChunks = [];
  let base = 0;
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      const pa = prim.attributes?.POSITION;
      if (pa === undefined) continue;
      const pos = readAccessor(parsed, pa);
      const vc = pos.length / 3;
      posChunks.push(pos);
      if (prim.indices !== undefined) {
        const raw = readAccessor(parsed, prim.indices);
        const idx = new Uint32Array(raw.length);
        for (let i = 0; i < raw.length; i++) idx[i] = raw[i];
        idxChunks.push({ data: idx, base });
      } else {
        const idx = new Uint32Array(vc);
        for (let i = 0; i < vc; i++) idx[i] = i;
        idxChunks.push({ data: idx, base });
      }
      base += vc;
    }
  }
  const vertexCount = base;
  const positions = new Float64Array(vertexCount * 3);
  let o = 0;
  for (const c of posChunks) { positions.set(c, o); o += c.length; }
  let total = 0;
  for (const c of idxChunks) total += c.data.length - (c.data.length % 3);
  const indices = new Uint32Array(total);
  o = 0;
  for (const c of idxChunks) {
    const usable = c.data.length - (c.data.length % 3);
    for (let i = 0; i < usable; i++) indices[o++] = c.data[i] + c.base;
  }
  return { positions, indices, vertexCount, triangleCount: indices.length / 3 };
}

function countIslands(geo) {
  if (geo.vertexCount === 0) return 0;
  const parent = new Int32Array(geo.vertexCount);
  const rank = new Uint8Array(geo.vertexCount);
  for (let i = 0; i < geo.vertexCount; i++) parent[i] = i;
  const find = (x) => {
    let r = x;
    while (parent[r] !== r) r = parent[r];
    while (parent[x] !== r) { const n = parent[x]; parent[x] = r; x = n; }
    return r;
  };
  const union = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra === rb) return;
    if (rank[ra] < rank[rb]) parent[ra] = rb;
    else if (rank[ra] > rank[rb]) parent[rb] = ra;
    else { parent[rb] = ra; rank[ra]++; }
  };
  const { indices } = geo;
  for (let t = 0; t < indices.length; t += 3) {
    union(indices[t], indices[t + 1]);
    union(indices[t + 1], indices[t + 2]);
  }
  const used = new Uint8Array(geo.vertexCount);
  for (let i = 0; i < indices.length; i++) used[indices[i]] = 1;
  const roots = new Set();
  for (let v = 0; v < geo.vertexCount; v++) if (used[v]) roots.add(find(v));
  return roots.size;
}

function boundingBox(geo) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const p = geo.positions;
  for (let i = 0; i < p.length; i += 3) {
    for (let c = 0; c < 3; c++) {
      const v = p[i + c];
      if (v < min[c]) min[c] = v;
      if (v > max[c]) max[c] = v;
    }
  }
  if (!Number.isFinite(min[0])) return { min: [0, 0, 0], max: [0, 0, 0] };
  return { min, max };
}

function computeAspect(b) {
  const dims = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]].sort((x, y) => y - x);
  return dims[0] / Math.max(dims[1], 1e-9);
}

function computeSymmetry(geo, b, grid = 12) {
  const p = geo.positions;
  if (p.length === 0) return 0;
  const midX = (b.min[0] + b.max[0]) / 2;
  const size = [
    Math.max(b.max[0] - b.min[0], 1e-9),
    Math.max(b.max[1] - b.min[1], 1e-9),
    Math.max(b.max[2] - b.min[2], 1e-9),
  ];
  const half = grid;
  const cells = half * grid * grid;
  const pos = new Float64Array(cells);
  const neg = new Float64Array(cells);
  const clamp = (n, hi) => (n < 0 ? 0 : n >= hi ? hi - 1 : n);
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], y = p[i + 1], z = p[i + 2];
    const dx = Math.abs(x - midX);
    const bx = clamp(Math.floor((dx / (size[0] / 2)) * half), half);
    const by = clamp(Math.floor(((y - b.min[1]) / size[1]) * grid), grid);
    const bz = clamp(Math.floor(((z - b.min[2]) / size[2]) * grid), grid);
    const cell = (bx * grid + by) * grid + bz;
    if (x >= midX) pos[cell] += 1;
    else neg[cell] += 1;
  }
  let dot = 0, np = 0, nn = 0;
  for (let i = 0; i < cells; i++) { dot += pos[i] * neg[i]; np += pos[i] * pos[i]; nn += neg[i] * neg[i]; }
  if (np === 0 || nn === 0) return 0;
  return dot / (Math.sqrt(np) * Math.sqrt(nn));
}

export function scoreRiggability(m) {
  const reasons = [];
  const T = RIGGABILITY_THRESHOLDS;
  if (m.islands > T.maxIslands)
    reasons.push(`${m.islands} disconnected islands (> ${T.maxIslands}) — fused/floating appendages rig ambiguously`);
  if (m.aspect < T.minAspect)
    reasons.push(`aspect ${m.aspect.toFixed(2)} (< ${T.minAspect}) — squat/bust, not a full standing body`);
  if (m.symmetry < T.minSymmetry)
    reasons.push(`symmetry ${m.symmetry.toFixed(2)} (< ${T.minSymmetry}) — not bilaterally symmetric`);
  return { ...m, verdict: reasons.length ? "risky" : "clean", reasons };
}

/** Parse GLB bytes → full riggability report. */
export function analyzeGlb(bytes) {
  const parsed = parseGlb(bytes);
  const geo = gatherGeometry(parsed);
  const b = boundingBox(geo);
  return scoreRiggability({
    islands: countIslands(geo),
    aspect: computeAspect(b),
    symmetry: computeSymmetry(geo, b),
    vertexCount: geo.vertexCount,
    triangleCount: geo.triangleCount,
  });
}

export function formatReport(r) {
  const head =
    `verdict=${r.verdict.toUpperCase()} islands=${r.islands} ` +
    `aspect=${r.aspect.toFixed(2)} symmetry=${r.symmetry.toFixed(2)} ` +
    `(${r.vertexCount} verts, ${r.triangleCount} tris)`;
  return r.reasons.length ? head + "\n  - " + r.reasons.join("\n  - ") : head;
}

// ── CLI ───────────────────────────────────────────────────────────────────────
function isMain() {
  return process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
}

if (isMain()) {
  const rest = process.argv.slice(2);
  const asJson = rest.includes("--json");
  const file = rest.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("usage: node scripts/rig/check-riggability.mjs <glb> [--json]");
    process.exit(1);
  }
  let bytes;
  try {
    bytes = readFileSync(resolve(file));
  } catch (e) {
    console.error(`[check-riggability] cannot read ${file}: ${e.message}`);
    process.exit(1);
  }
  let report;
  try {
    report = analyzeGlb(bytes);
  } catch (e) {
    console.error(`[check-riggability] parse failed: ${e.message}`);
    process.exit(1);
  }
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`[check-riggability] ${file}`);
    console.log(formatReport(report));
  }
  process.exit(0);
}
