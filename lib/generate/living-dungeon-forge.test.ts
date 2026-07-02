import { describe, expect, it } from "vitest";
import {
  ART_BIBLE,
  artBibleFromCanon,
  buildSystemPlayer,
  buildSystemEnemies,
  buildPlayerUserMessage,
  buildEnemyUserMessage,
  assembleFallbackPrompt,
  mutationById,
  variantById,
  poseById,
  forgeOptionsForProject,
  mutationInOptions,
  variantInOptions,
  PLAYER_MUTATIONS,
  PLAYER_VARIANTS,
  POSES,
} from "./living-dungeon-forge";
import type { Canon, CanonInsert } from "@/lib/schema";
import { livingDungeonCanon } from "@/lib/canon/seeds/living-dungeon";
import { gyreCanon } from "@/lib/canon/seeds/gyre";

// Seeds are CanonInsert; the forge only reads style_guide + negative_prompt, so we
// pad them into a full Canon row for the mapping tests.
function asCanon(insert: CanonInsert): Canon {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    reference_imgs: [],
    lora_ref: null,
    lora_trigger: null,
    lora_status: "none",
    style_guide: {},
    prompt_prefix: "",
    prompt_suffix: "",
    negative_prompt: "",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...insert,
  } as Canon;
}

const LD_CANON = asCanon(livingDungeonCanon("p1"));
const GYRE_CANON = asCanon(gyreCanon("p2"));

describe("artBibleFromCanon", () => {
  it("with no canon falls back to the Living Dungeon ART_BIBLE", () => {
    expect(artBibleFromCanon(null)).toEqual(ART_BIBLE);
  });

  it("maps the Living Dungeon canon → its theme / palette / forbidden / character theme", () => {
    const b = artBibleFromCanon(LD_CANON);
    // theme = north_star
    expect(b.theme).toBe(LD_CANON.style_guide.north_star);
    // colorSpec = palette hexes joined
    expect(b.colorSpec).toBe("#4e2329, #8a3a41, #4dbbc0, #0a0a12");
    // forbidden = negative_prompt → "NO x, NO y, …"
    expect(b.forbidden).toBe(
      "NO metal, NO stone, NO sci-fi tech, NO human faces, NO text, NO outlines, " +
        "NO 3d render, NO photorealistic, NO smooth gradients",
    );
    // no character_theme on LD → falls back to north_star + native-humanoid tail
    expect(b.playerTheme).toContain(String(LD_CANON.style_guide.north_star));
    expect(b.playerTheme).toContain("a humanoid character native to this world");
  });

  it("maps the GYRE canon → GYRE's theme / palette / forbidden / character theme", () => {
    const b = artBibleFromCanon(GYRE_CANON);
    expect(b.theme).toBe(GYRE_CANON.style_guide.north_star);
    // GYRE_COLORS Room-1 cold set
    expect(b.colorSpec).toBe("#20242c, #2b2e33, #151a2b, #cdd6e6, #3a4a66");
    expect(b.forbidden).toContain("NO bright");
    expect(b.forbidden).toContain("NO photorealistic");
    expect(b.forbidden).toContain("NO smooth-shaded");
    // GYRE authored a character_theme → it wins (no native-humanoid fallback tail)
    expect(b.playerTheme).toContain("The Unspooled / Hollows / Wardens");
    expect(b.playerTheme).not.toContain("a humanoid character native to this world");
  });
});

describe("system prompts interpolate the canon-derived bible", () => {
  it("player prompt carries the GYRE character theme + palette + forbidden", () => {
    const b = artBibleFromCanon(GYRE_CANON);
    const sys = buildSystemPlayer(b);
    expect(sys).toContain(b.playerTheme);
    expect(sys).toContain(b.colorSpec);
    expect(sys).toContain(b.forbidden);
    // Template is verbatim regardless of canon.
    expect(sys).toContain("You are an expert pixel art character designer for 2D games.");
    expect(sys).toContain("Respond with ONLY the image generation prompt. 80-150 words.");
  });

  it("enemy prompt carries the GYRE theme + palette + forbidden", () => {
    const b = artBibleFromCanon(GYRE_CANON);
    const sys = buildSystemEnemies(b);
    expect(sys).toContain(b.theme);
    expect(sys).toContain(`Colors ONLY: ${b.colorSpec}`);
    expect(sys).toContain(b.forbidden);
  });
});

describe("buildSystemPlayer (default LD bible verbatim)", () => {
  it("interpolates the art bible player fields verbatim", () => {
    const sys = buildSystemPlayer(ART_BIBLE);
    expect(sys).toContain(ART_BIBLE.playerTheme);
    expect(sys).toContain(ART_BIBLE.colorSpec);
    expect(sys).toContain(ART_BIBLE.forbidden);
    // The player prompt uses playerTheme, not the room `theme`.
    expect(sys).toContain("- Theme: Human host partially consumed");
    expect(sys).toContain("You are an expert pixel art character designer for 2D games.");
    expect(sys).toContain("Respond with ONLY the image generation prompt. 80-150 words.");
  });
});

describe("buildSystemEnemies (default LD bible verbatim)", () => {
  it("interpolates the art bible enemy fields verbatim", () => {
    const sys = buildSystemEnemies(ART_BIBLE);
    expect(sys).toContain(ART_BIBLE.theme);
    expect(sys).toContain(`Colors ONLY: ${ART_BIBLE.colorSpec}`);
    expect(sys).toContain(ART_BIBLE.forbidden);
    expect(sys).toContain(
      "You are an expert game creature designer specializing in pixel art enemy sprites.",
    );
    expect(sys).toContain("Sprites arranged in a clean grid, each cell isolated on black");
    expect(sys).toContain(
      "Respond with ONLY the image generation prompt. 80-150 words, dense visual descriptors.",
    );
  });
});

describe("per-project forge options (mutations/variants are optional)", () => {
  it("living-dungeon keeps its exact mutation + variant sets", () => {
    const o = forgeOptionsForProject("living-dungeon");
    expect(o.mutations).toBe(PLAYER_MUTATIONS);
    expect(o.variants).toBe(PLAYER_VARIANTS);
  });

  it("gyre has FORMS but no mutations", () => {
    const o = forgeOptionsForProject("gyre");
    expect(o.mutations).toEqual([]);
    expect(o.variants.map((v) => v.id)).toEqual(["unspooled", "hollow", "warden"]);
  });

  it("an unknown project has neither (→ selectors hidden)", () => {
    const o = forgeOptionsForProject("some-other-game");
    expect(o.mutations).toEqual([]);
    expect(o.variants).toEqual([]);
    expect(forgeOptionsForProject(null).variants).toEqual([]);
  });

  it("mutationInOptions is null when the project has no mutations, first-entry fallback otherwise", () => {
    const ld = forgeOptionsForProject("living-dungeon");
    const gyre = forgeOptionsForProject("gyre");
    expect(mutationInOptions(gyre, "anything")).toBeNull();
    expect(mutationInOptions(ld, "nope")).toBe(PLAYER_MUTATIONS[0]);
    expect(mutationInOptions(ld, "membrane-wings")?.id).toBe("membrane-wings");
    expect(variantInOptions(gyre, "warden")?.id).toBe("warden");
    expect(variantInOptions(forgeOptionsForProject(null), "x")).toBeNull();
  });
});

describe("buildPlayerUserMessage", () => {
  it("matches the verbatim LD user-message shape (mutation + variant present)", () => {
    const mutation = mutationById("membrane-wings");
    const variant = variantById("infected");
    const poseLabel = poseById("tpose").poseLabel;
    const msg = buildPlayerUserMessage({ poseLabel, mutation, variant });
    expect(msg).toBe(
      `Sub-type: ${poseLabel}\n` +
        `Mutation: ${mutation.label} — ${mutation.desc}\n` +
        `Color variant: ${variant.label} — ${variant.desc}\n\n` +
        `Generate the image generation prompt.`,
    );
  });

  it("omits the mutation line when a project has no mutations (GYRE)", () => {
    const gyre = forgeOptionsForProject("gyre");
    const variant = variantInOptions(gyre, "warden");
    const poseLabel = poseById("tpose").poseLabel;
    const msg = buildPlayerUserMessage({
      poseLabel,
      mutation: mutationInOptions(gyre, "x"),
      variant,
    });
    expect(msg).not.toContain("Mutation:");
    expect(msg).toContain(`Color variant: ${variant!.label} — ${variant!.desc}`);
    expect(msg).toContain(`Sub-type: ${poseLabel}`);
  });
});

describe("buildEnemyUserMessage", () => {
  it("matches the verbatim user-message shape", () => {
    const msg = buildEnemyUserMessage({
      label: "Leech swarm",
      userDescription: "a swarm of pulsing membrane leeches",
    });
    expect(msg).toBe(
      `Asset: Leech swarm\n` +
        `Prompt: a swarm of pulsing membrane leeches\n\n` +
        `Generate the optimized image generation prompt.`,
    );
  });
});

describe("assembleFallbackPrompt", () => {
  it("player fallback carries theme + palette + forbidden + pose", () => {
    const mutation = mutationById("bone-spurs");
    const variant = variantById("purified");
    const pose = poseById("tpose");
    const out = assembleFallbackPrompt({
      mode: "player",
      P: ART_BIBLE,
      poseLabel: pose.poseLabel,
      mutation,
      variant,
    });
    expect(out).toContain(ART_BIBLE.playerTheme); // theme
    expect(out).toContain(ART_BIBLE.colorSpec); // palette
    expect(out).toContain(ART_BIBLE.forbidden); // forbidden
    expect(out).toContain(pose.poseLabel); // pose
  });

  it("player fallback omits mutation/variant lines when null (canon-driven, no sub-types)", () => {
    const bible = artBibleFromCanon(GYRE_CANON);
    const pose = poseById("tpose");
    const out = assembleFallbackPrompt({
      mode: "player",
      P: bible,
      poseLabel: pose.poseLabel,
      mutation: null,
      variant: null,
    });
    expect(out).not.toContain("Mutation:");
    expect(out).not.toContain("Color variant:");
    expect(out).toContain(bible.playerTheme);
    expect(out).toContain(bible.colorSpec);
    expect(out).toContain(bible.forbidden);
  });

  it("enemy fallback carries theme + palette + forbidden", () => {
    const out = assembleFallbackPrompt({
      mode: "enemy",
      P: ART_BIBLE,
      label: "Leech swarm",
      userDescription: "pulsing membrane leeches",
    });
    expect(out).toContain(ART_BIBLE.theme);
    expect(out).toContain(ART_BIBLE.colorSpec);
    expect(out).toContain(ART_BIBLE.forbidden);
    expect(out).toContain("Leech swarm");
  });
});

describe("lookups fall back to the first entry for unknown ids", () => {
  it("mutation/variant/pose defaults", () => {
    expect(mutationById("nope")).toBe(PLAYER_MUTATIONS[0]);
    expect(variantById("nope")).toBe(PLAYER_VARIANTS[0]);
    expect(poseById("nope")).toBe(POSES[0]);
  });

  it("the A-pose and T-pose are flagged rig-ready and the idle is not", () => {
    expect(poseById("apose").tpose).toBe(true);
    expect(poseById("tpose").tpose).toBe(true);
    expect(poseById("idle").tpose).toBe(false);
  });

  it("A-pose is the recommended DEFAULT (first entry) and maps to character-apose", () => {
    expect(POSES[0]!.id).toBe("apose");
    expect(poseById("apose").rigReadyKey).toBe("character-apose");
    expect(poseById("tpose").rigReadyKey).toBe("character-tpose");
    // A non-rig pose has no rigReadyKey → the action falls back to "character".
    expect(poseById("idle").rigReadyKey).toBeUndefined();
  });

  it("A-pose cues describe arms ~40° below horizontal (not a T-pose)", () => {
    const label = poseById("apose").poseLabel.toLowerCase();
    expect(label).toContain("a-pose");
    expect(label).toContain("40 degrees below horizontal");
    expect(label).toContain("elbows slightly bent");
    expect(label).not.toContain("arms extended out horizontally");
  });
});
