import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import {
  analyzeGlb,
  boundingBox,
  computeAspect,
  computeSymmetry,
  countIslands,
  gatherGeometry,
  parseGlb,
  scoreRiggability,
  RIGGABILITY_THRESHOLDS,
  type MeshGeometry,
} from "./riggability";

// ── Minimal GLB builder (v2 binary, single mesh, POSITION + indices) ──────────
// Builds a real binary GLB in-memory so the parser is exercised end-to-end without
// any fixture files. positions: flat Float32 XYZ; indices: flat Uint16 triangles.
function buildGlb(positions: number[], indices: number[]): Uint8Array {
  const posBytes = new Float32Array(positions);
  const idxBytes = new Uint16Array(indices);
  // pad each bufferView to 4-byte alignment
  const posLen = posBytes.byteLength;
  const idxLenRaw = idxBytes.byteLength;
  const idxPad = (4 - (idxLenRaw % 4)) % 4;
  const idxLen = idxLenRaw + idxPad;

  const bin = new Uint8Array(posLen + idxLen);
  bin.set(new Uint8Array(posBytes.buffer), 0);
  bin.set(new Uint8Array(idxBytes.buffer), posLen);

  const vertCount = positions.length / 3;
  // bounds for POSITION accessor min/max (required by spec, not by our parser)
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let c = 0; c < 3; c++) {
      const v = positions[i + c]!;
      if (v < min[c]!) min[c] = v;
      if (v > max[c]!) max[c] = v;
    }
  }

  const json = {
    asset: { version: "2.0" },
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: vertCount, type: "VEC3", min, max },
      { bufferView: 1, componentType: 5123, count: indices.length, type: "SCALAR" },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posLen },
      { buffer: 0, byteOffset: posLen, byteLength: idxLenRaw },
    ],
    buffers: [{ byteLength: bin.byteLength }],
  };

  let jsonText = JSON.stringify(json);
  // pad JSON chunk to 4-byte alignment with spaces
  while (jsonText.length % 4 !== 0) jsonText += " ";
  const jsonBytes = new TextEncoder().encode(jsonText);

  const total = 12 + 8 + jsonBytes.byteLength + 8 + bin.byteLength;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  let o = 0;
  dv.setUint32(o, 0x46546c67, true); // magic "glTF"
  dv.setUint32(o + 4, 2, true); // version
  dv.setUint32(o + 8, total, true); // total length
  o += 12;
  dv.setUint32(o, jsonBytes.byteLength, true);
  dv.setUint32(o + 4, 0x4e4f534a, true); // "JSON"
  o += 8;
  out.set(jsonBytes, o);
  o += jsonBytes.byteLength;
  dv.setUint32(o, bin.byteLength, true);
  dv.setUint32(o + 4, 0x004e4942, true); // "BIN\0"
  o += 8;
  out.set(bin, o);
  return out;
}

// One axis-aligned box (12 tris) at [cx,cy,cz] with half-extents [hx,hy,hz].
// Returns { positions, indices } with indices offset by `base` vertices.
function box(
  cx: number,
  cy: number,
  cz: number,
  hx: number,
  hy: number,
  hz: number,
  base: number,
): { positions: number[]; indices: number[] } {
  const p = [
    [cx - hx, cy - hy, cz - hz],
    [cx + hx, cy - hy, cz - hz],
    [cx + hx, cy + hy, cz - hz],
    [cx - hx, cy + hy, cz - hz],
    [cx - hx, cy - hy, cz + hz],
    [cx + hx, cy - hy, cz + hz],
    [cx + hx, cy + hy, cz + hz],
    [cx - hx, cy + hy, cz + hz],
  ];
  const faces = [
    [0, 1, 2], [0, 2, 3], // -z
    [4, 6, 5], [4, 7, 6], // +z
    [0, 4, 5], [0, 5, 1], // -y
    [3, 2, 6], [3, 6, 7], // +y
    [0, 3, 7], [0, 7, 4], // -x
    [1, 5, 6], [1, 6, 2], // +x
  ];
  return {
    positions: p.flat(),
    indices: faces.flat().map((i) => i + base),
  };
}

// Assemble several boxes into one flat positions/indices soup.
function assemble(boxes: { positions: number[]; indices: number[] }[]) {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const b of boxes) {
    positions.push(...b.positions);
    indices.push(...b.indices);
  }
  return { positions, indices };
}

function geoFrom(positions: number[], indices: number[]): MeshGeometry {
  return gatherGeometry(parseGlb(buildGlb(positions, indices)));
}

describe("parseGlb", () => {
  it("round-trips a minimal GLB", () => {
    const { positions, indices } = box(0, 0, 0, 1, 1, 1, 0);
    const parsed = parseGlb(buildGlb(positions, indices));
    expect(parsed.json.meshes?.length).toBe(1);
    expect(parsed.bin.byteLength).toBeGreaterThan(0);
  });
  it("rejects non-GLB bytes", () => {
    expect(() => parseGlb(new Uint8Array([1, 2, 3, 4]))).toThrow();
  });
});

describe("gatherGeometry", () => {
  it("reads positions + triangles from a single box", () => {
    const { positions, indices } = box(0, 0, 0, 1, 1, 1, 0);
    const geo = geoFrom(positions, indices);
    expect(geo.vertexCount).toBe(8);
    expect(geo.triangleCount).toBe(12);
  });
});

describe("countIslands", () => {
  it("one box = 1 island", () => {
    const { positions, indices } = box(0, 0, 0, 1, 1, 1, 0);
    expect(countIslands(geoFrom(positions, indices))).toBe(1);
  });
  it("three disjoint boxes = 3 islands", () => {
    const { positions, indices } = assemble([
      box(0, 0, 0, 1, 1, 1, 0),
      box(10, 0, 0, 1, 1, 1, 8),
      box(20, 0, 0, 1, 1, 1, 16),
    ]);
    expect(countIslands(geoFrom(positions, indices))).toBe(3);
  });
});

describe("computeAspect", () => {
  it("a tall body reads > 2; a cube reads ~1", () => {
    const tall = box(0, 0, 0, 0.5, 4, 0.5, 0); // height 8, width 1
    const cube = box(0, 0, 0, 1, 1, 1, 0);
    expect(computeAspect(boundingBox(geoFrom(tall.positions, tall.indices)))).toBeGreaterThan(2);
    expect(
      computeAspect(boundingBox(geoFrom(cube.positions, cube.indices))),
    ).toBeCloseTo(1, 5);
  });
});

describe("computeSymmetry", () => {
  it("a mirrored pair reads ~1; a one-sided blob reads low", () => {
    // symmetric: two boxes mirrored across X
    const sym = assemble([
      box(-3, 0, 0, 1, 1, 1, 0),
      box(3, 0, 0, 1, 1, 1, 8),
    ]);
    const symGeo = geoFrom(sym.positions, sym.indices);
    expect(computeSymmetry(symGeo, boundingBox(symGeo))).toBeGreaterThan(0.9);

    // asymmetric: mass only on +X within a box spanning both sides
    const asym = assemble([
      box(-4, 0, 0, 0.2, 1, 1, 0), // thin sliver far -X (sets bounds)
      box(3, 0, 0, 2, 2, 2, 8), // big lump on +X
    ]);
    const asymGeo = geoFrom(asym.positions, asym.indices);
    expect(computeSymmetry(asymGeo, boundingBox(asymGeo))).toBeLessThan(0.5);
  });
});

describe("scoreRiggability (pure rule)", () => {
  it("clean humanoid-like metrics → clean", () => {
    const r = scoreRiggability({
      islands: 1,
      aspect: 2.6,
      symmetry: 0.85,
      vertexCount: 5000,
      triangleCount: 9000,
    });
    expect(r.verdict).toBe("clean");
    expect(r.reasons).toEqual([]);
  });
  it("hundreds of islands → risky", () => {
    const r = scoreRiggability({
      islands: 556,
      aspect: 2.2,
      symmetry: 0.8,
      vertexCount: 9000,
      triangleCount: 18000,
    });
    expect(r.verdict).toBe("risky");
    expect(r.reasons.join(" ")).toContain("islands");
  });
  it("squat blob (low aspect) → risky", () => {
    const r = scoreRiggability({
      islands: 1,
      aspect: 1.0,
      symmetry: 0.9,
      vertexCount: 4000,
      triangleCount: 8000,
    });
    expect(r.verdict).toBe("risky");
    expect(r.reasons.join(" ")).toContain("aspect");
  });
  it("asymmetric → risky", () => {
    const r = scoreRiggability({
      islands: 1,
      aspect: 2.5,
      symmetry: 0.2,
      vertexCount: 4000,
      triangleCount: 8000,
    });
    expect(r.verdict).toBe("risky");
    expect(r.reasons.join(" ")).toContain("symmetry");
  });
  it("thresholds are the documented values", () => {
    // maxIslands is calibrated ABOVE the ~130-island baseline of a clean generated
    // humanoid so normal meshes pass; only extreme fragmentation (556) trips it.
    expect(RIGGABILITY_THRESHOLDS.maxIslands).toBe(300);
    expect(RIGGABILITY_THRESHOLDS.minAspect).toBe(1.5);
    expect(RIGGABILITY_THRESHOLDS.minSymmetry).toBe(0.5);
  });

  it("a clean generated humanoid's ~130 islands still reads CLEAN (tall + symmetric)", () => {
    // Regression: real TRELLIS humanoids carry ~130 shells; the gate must not flag them.
    const r = scoreRiggability({
      islands: 134,
      aspect: 2.38,
      symmetry: 0.93,
      vertexCount: 4142,
      triangleCount: 5580,
    });
    expect(r.verdict).toBe("clean");
  });

  it("the tendril boss's real metrics read RISKY", () => {
    // Regression pinned to the actual boss GLB numbers (556 islands, squat 1.29 aspect).
    const r = scoreRiggability({
      islands: 556,
      aspect: 1.29,
      symmetry: 0.93,
      vertexCount: 16178,
      triangleCount: 20823,
    });
    expect(r.verdict).toBe("risky");
    expect(r.reasons.join(" ")).toContain("islands");
    expect(r.reasons.join(" ")).toContain("aspect");
  });
});

describe("analyzeGlb (end-to-end on synthetic meshes)", () => {
  it("a clean tall symmetric humanoid-ish figure reads CLEAN", () => {
    // torso + 2 arms + 2 legs + head, all fused (shared bounds), tall & symmetric.
    // Overlapping boxes stay separate islands unless they share vertices, so to make
    // it 1 island we build a single tall symmetric torso plus mirrored limbs that
    // OVERLAP the torso vertices — but simplest: keep them separate and rely on aspect
    // + symmetry passing with a small island count under the threshold.
    const parts = assemble([
      box(0, 0, 0, 0.6, 3.5, 0.4, 0), // torso (tall → sets height ~7)
      box(-1.2, 1.5, 0, 0.3, 1.5, 0.3, 8), // left arm
      box(1.2, 1.5, 0, 0.3, 1.5, 0.3, 16), // right arm
      box(-0.4, -3.5, 0, 0.3, 1.5, 0.3, 24), // left leg
      box(0.4, -3.5, 0, 0.3, 1.5, 0.3, 32), // right leg
      box(0, 4, 0, 0.5, 0.5, 0.5, 40), // head
    ]);
    const r = analyzeGlb(buildGlb(parts.positions, parts.indices));
    expect(r.islands).toBeLessThanOrEqual(RIGGABILITY_THRESHOLDS.maxIslands);
    expect(r.aspect).toBeGreaterThan(RIGGABILITY_THRESHOLDS.minAspect);
    expect(r.symmetry).toBeGreaterThan(RIGGABILITY_THRESHOLDS.minSymmetry);
    expect(r.verdict).toBe("clean");
  });

  it("a fragmented crown of many islands reads RISKY", () => {
    // A compact body plus a 'tendril crown' of 320 tiny disjoint boxes → > 300 islands,
    // mirroring the real boss whose crown shatters into hundreds of shells.
    const N = 320;
    const boxes = [box(0, 0, 0, 1, 2, 0.5, 0)];
    let base = 8;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      boxes.push(box(Math.cos(a) * 2, 3 + Math.sin(a) * 0.2, Math.sin(a) * 2, 0.1, 0.1, 0.1, base));
      base += 8;
    }
    const parts = assemble(boxes);
    const r = analyzeGlb(buildGlb(parts.positions, parts.indices));
    expect(r.islands).toBeGreaterThan(RIGGABILITY_THRESHOLDS.maxIslands);
    expect(r.verdict).toBe("risky");
  });
});

// ── Optional: real fixture files (only if present on this machine) ─────────────
// The task ships two real GLBs in ~/Downloads. When present, assert the boss reads
// RISKY and the clean player reads CLEAN. Skipped in CI / other machines.
const HOME = process.env.USERPROFILE || process.env.HOME || "";
const BOSS = `${HOME}\\Downloads\\prop.threshold-host.glb`;
const PLAYER = `${HOME}\\Downloads\\ld-player-49-o8h.glb`;
const haveFixtures = HOME !== "" && existsSync(BOSS) && existsSync(PLAYER);

describe.skipIf(!haveFixtures)("analyzeGlb (real fixtures)", () => {
  it("the tendril boss reads RISKY", () => {
    const r = analyzeGlb(readFileSync(BOSS));
    expect(r.verdict).toBe("risky");
  });
  it("the clean full-body player reads CLEAN", () => {
    const r = analyzeGlb(readFileSync(PLAYER));
    expect(r.verdict).toBe("clean");
  });
});
