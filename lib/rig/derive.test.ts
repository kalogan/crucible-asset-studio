import { describe, expect, it } from "vitest";
import { deriveRiggedMeta } from "./derive";

describe("deriveRiggedMeta", () => {
  it("suffixes the art-kit id and label from the source", () => {
    expect(deriveRiggedMeta({ label: "Hero", artKitId: "local.hero" })).toEqual({
      artKitId: "local.hero-rigged",
      label: "Hero (rigged)",
      assetType: "character",
      kind: "model",
    });
  });

  it("slugifies the label when there is no art-kit id", () => {
    const m = deriveRiggedMeta({ label: "Ice Golem #2", artKitId: null });
    expect(m.artKitId).toBe("ice-golem-2-rigged");
    expect(m.label).toBe("Ice Golem #2 (rigged)");
  });

  it("is idempotent — re-rigging a rigged asset does not stack suffixes", () => {
    const m = deriveRiggedMeta({ label: "Hero (rigged)", artKitId: "local.hero-rigged" });
    expect(m.artKitId).toBe("local.hero-rigged");
    expect(m.label).toBe("Hero (rigged)");
  });

  it("falls back to stable defaults for empty input", () => {
    expect(deriveRiggedMeta({ label: "   ", artKitId: null })).toEqual({
      artKitId: "asset-rigged",
      label: "Asset (rigged)",
      assetType: "character",
      kind: "model",
    });
  });
});
