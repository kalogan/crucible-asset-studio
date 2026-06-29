import { describe, it, expect } from "vitest";
import { Project, Canon, AssetSpec, Job, Asset } from "./index";
import {
  goldenProject,
  goldenCanon,
  goldenAssetSpec,
  goldenJob,
  goldenAsset,
} from "./__fixtures__/golden";

describe("schema golden fixtures (row contract)", () => {
  it("parses a project row", () => {
    expect(Project.parse(goldenProject)).toMatchObject({ slug: "wayfinders" });
  });

  it("parses a canon row", () => {
    expect(Canon.parse(goldenCanon).lora_status).toBe("none");
  });

  it("parses an asset_spec row", () => {
    expect(AssetSpec.parse(goldenAssetSpec).asset_type).toBe("model_3d");
  });

  it("parses a job row", () => {
    expect(Job.parse(goldenJob).status).toBe("succeeded");
  });

  it("parses an asset row in_review", () => {
    expect(Asset.parse(goldenAsset).stage).toBe("in_review");
  });
});

describe("schema rejects bad data", () => {
  it("rejects a non-kebab slug", () => {
    expect(() => Project.parse({ ...goldenProject, slug: "Bad Slug" })).toThrow();
  });

  it("rejects an unknown asset stage", () => {
    expect(() => Asset.parse({ ...goldenAsset, stage: "teleported" })).toThrow();
  });

  it("rejects an invalid lora_status", () => {
    expect(() => Canon.parse({ ...goldenCanon, lora_status: "trained" })).toThrow();
  });
});
