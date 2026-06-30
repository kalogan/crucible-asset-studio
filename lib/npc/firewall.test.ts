import { describe, it, expect } from "vitest";
// Import the firewall + nav helpers straight from the vendored game-kit source. The bare
// "game-kit/npc" / "game-kit" specifiers are tsconfig paths (used by the app + tsc), but
// vitest resolves from disk, so the test points at the real source files directly.
import {
  parseReasoningResponse,
  navBoundsFromGrid,
  clampToNavBounds,
  NPC_EMOTE_NAMES,
  type NavBounds,
} from "@/vendor/game-kit/src/npc/schema";
import { createGridNav } from "@/vendor/game-kit/src/nav/index";

// ── Track B5: the GATED reasoning→behavior movement bridge ───────────────────
//
// These are SAFETY-CRITICAL. The firewall (`parseReasoningResponse`) is the only thing
// between a model and authoritative game state. The contract under test:
//   • DEFAULT (no options / allowMovement off) — goTo/emote are dropped EXACTLY like an
//     unknown kind, so the default build is byte-for-byte as safe as before this track.
//   • allowMovement ON — goTo/emote are admitted, goTo is CLAMPED to walkable bounds,
//     non-finite goTo targets are rejected, and out-of-enum emotes are dropped.

const goTo = (target: [number, number]) => ({ kind: "goTo", target });
const emote = (name: string) => ({ kind: "emote", name });
const say = (text: string) => ({ kind: "say", text });

describe("parseReasoningResponse — default (allowMovement OFF)", () => {
  it("drops goTo exactly like an unknown kind (no options)", () => {
    expect(parseReasoningResponse({ intents: [goTo([3, 4])] })).toEqual([]);
  });

  it("drops emote exactly like an unknown kind (no options)", () => {
    expect(parseReasoningResponse({ intents: [emote("wave")] })).toEqual([]);
  });

  it("drops movement intents with an explicit allowMovement: false too", () => {
    const intents = parseReasoningResponse(
      { intents: [goTo([3, 4]), emote("nod")] },
      { allowMovement: false },
    );
    expect(intents).toEqual([]);
  });

  it("keeps the legal vocabulary while dropping interleaved movement intents", () => {
    const intents = parseReasoningResponse({
      intents: [say("Hello, traveler."), goTo([1, 2]), emote("wave")],
    });
    // Only the `say` survives — movement intents drop without poisoning the rest.
    expect(intents).toEqual([{ kind: "say", text: "Hello, traveler." }]);
  });

  it("is byte-for-byte identical with and without an empty options object", () => {
    const raw = { intents: [say("hi"), goTo([9, 9])] };
    expect(parseReasoningResponse(raw)).toEqual(parseReasoningResponse(raw, {}));
  });
});

describe("parseReasoningResponse — gated ON (allowMovement: true)", () => {
  it("admits a finite goTo and a valid emote", () => {
    const intents = parseReasoningResponse(
      { intents: [goTo([3, 4]), emote("wave")] },
      { allowMovement: true },
    );
    expect(intents).toEqual([
      { kind: "goTo", target: [3, 4] },
      { kind: "emote", name: "wave" },
    ]);
  });

  it("admits every emote in the bounded enum and drops anything else", () => {
    for (const name of NPC_EMOTE_NAMES) {
      expect(
        parseReasoningResponse({ intents: [emote(name)] }, { allowMovement: true }),
      ).toEqual([{ kind: "emote", name }]);
    }
    // Out-of-enum gestures are dropped even with the flag on.
    for (const bad of ["dance", "WAVE", "", "salute"]) {
      expect(
        parseReasoningResponse({ intents: [emote(bad)] }, { allowMovement: true }),
      ).toEqual([]);
    }
  });

  it("rejects non-finite goTo targets (NaN / ±Infinity / wrong arity / non-number)", () => {
    const opts = { allowMovement: true } as const;
    expect(parseReasoningResponse({ intents: [goTo([NaN, 0])] }, opts)).toEqual([]);
    expect(parseReasoningResponse({ intents: [goTo([0, Infinity])] }, opts)).toEqual([]);
    expect(parseReasoningResponse({ intents: [goTo([-Infinity, 1])] }, opts)).toEqual([]);
    // Wrong shapes the model might emit.
    expect(
      parseReasoningResponse({ intents: [{ kind: "goTo", target: [1] }] }, opts),
    ).toEqual([]);
    expect(
      parseReasoningResponse({ intents: [{ kind: "goTo", target: ["1", "2"] }] }, opts),
    ).toEqual([]);
    expect(
      parseReasoningResponse({ intents: [{ kind: "goTo" }] }, opts),
    ).toEqual([]);
  });

  it("CLAMPS an out-of-bounds goTo to the walkable nav bounds", () => {
    // A 10×10 grid, cellSize 1, origin [0,0] ⇒ walkable world XZ in [0, 9] × [0, 9].
    const nav = createGridNav({ width: 10, height: 10, cellSize: 1, isWalkable: () => true });
    const navBounds = navBoundsFromGrid(nav);
    expect(navBounds).toEqual({ minX: 0, maxX: 9, minZ: 0, maxZ: 9 });

    const intents = parseReasoningResponse(
      { intents: [goTo([100, -50])] },
      { allowMovement: true, navBounds },
    );
    // The model REQUESTED [100, -50]; the firewall clamps it to the nearest walkable point.
    expect(intents).toEqual([{ kind: "goTo", target: [9, 0] }]);
  });

  it("leaves an in-bounds goTo unchanged when clamping", () => {
    const navBounds: NavBounds = { minX: 0, maxX: 9, minZ: 0, maxZ: 9 };
    const intents = parseReasoningResponse(
      { intents: [goTo([4, 7])] },
      { allowMovement: true, navBounds },
    );
    expect(intents).toEqual([{ kind: "goTo", target: [4, 7] }]);
  });

  it("respects a non-zero grid origin when deriving + clamping bounds", () => {
    // origin [-5, -5], 11×11, cellSize 1 ⇒ walkable world XZ in [-5, 5] × [-5, 5].
    const nav = createGridNav({
      width: 11,
      height: 11,
      cellSize: 1,
      origin: [-5, -5],
      isWalkable: () => true,
    });
    const navBounds = navBoundsFromGrid(nav);
    expect(navBounds).toEqual({ minX: -5, maxX: 5, minZ: -5, maxZ: 5 });

    const intents = parseReasoningResponse(
      { intents: [goTo([-99, 99])] },
      { allowMovement: true, navBounds },
    );
    expect(intents).toEqual([{ kind: "goTo", target: [-5, 5] }]);
  });

  it("admits goTo WITHOUT clamping when navBounds is omitted (finite-only)", () => {
    const intents = parseReasoningResponse(
      { intents: [goTo([1000, -1000])] },
      { allowMovement: true },
    );
    // No bounds ⇒ no clamp; the finite target passes through verbatim.
    expect(intents).toEqual([{ kind: "goTo", target: [1000, -1000] }]);
  });
});

describe("clampToNavBounds — component-wise clamp", () => {
  const bounds: NavBounds = { minX: 0, maxX: 10, minZ: -4, maxZ: 4 };
  it("clamps each axis independently", () => {
    expect(clampToNavBounds([5, 0], bounds)).toEqual([5, 0]);
    expect(clampToNavBounds([-3, 9], bounds)).toEqual([0, 4]);
    expect(clampToNavBounds([20, -9], bounds)).toEqual([10, -4]);
  });
});
