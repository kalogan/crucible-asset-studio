import { describe, expect, it } from "vitest";
import {
  ART_BIBLE,
  buildSystemPlayer,
  buildSystemEnemies,
  buildPlayerUserMessage,
  buildEnemyUserMessage,
  assembleFallbackPrompt,
  mutationById,
  variantById,
  poseById,
  PLAYER_MUTATIONS,
  PLAYER_VARIANTS,
  POSES,
} from "./living-dungeon-forge";

describe("buildSystemPlayer", () => {
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

describe("buildSystemEnemies", () => {
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

describe("buildPlayerUserMessage", () => {
  it("matches the verbatim user-message shape", () => {
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

  it("the T-pose is flagged rig-ready and the idle is not", () => {
    expect(poseById("tpose").tpose).toBe(true);
    expect(poseById("idle").tpose).toBe(false);
  });
});
