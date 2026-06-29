import { describe, it, expect } from "vitest";
import { catalogKeyFor, buildStoragePath, recipeString } from "./paths";

describe("catalogKeyFor", () => {
  it("derives a prop catalog key from a title", () => {
    expect(catalogKeyFor("Ticket Booth")).toBe("prop.ticket-booth");
  });
});

describe("buildStoragePath", () => {
  it("scopes the path by project slug", () => {
    expect(buildStoragePath("wayfinders", "prop.ticket-booth", "glb")).toBe(
      "wayfinders/prop.ticket-booth.glb",
    );
  });

  it("sanitizes unexpected characters in the key", () => {
    expect(buildStoragePath("noir-station", "prop.weird key!", "png")).toBe(
      "noir-station/prop.weird-key-.png",
    );
  });
});

describe("recipeString", () => {
  it("returns the value when present", () => {
    expect(recipeString({ title: "Barrel" }, "title", "x")).toBe("Barrel");
  });
  it("falls back when missing or non-string", () => {
    expect(recipeString({}, "title", "fallback")).toBe("fallback");
    expect(recipeString({ title: 3 }, "title", "fallback")).toBe("fallback");
  });
});
