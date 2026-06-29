import { describe, expect, it } from "vitest";
import {
  buildFacets,
  matchesFacet,
  filterByFacet,
  sortByNewest,
  countByType,
  type FacetedAsset,
} from "./filter";

const A = (type: string, tags: string[], createdAt = "2026-06-29T00:00:00Z"): FacetedAsset => ({
  type,
  tags,
  createdAt,
});

describe("buildFacets", () => {
  it("unions types + origin tags, sorted", () => {
    const items = [A("prop", ["Skyhold"]), A("creature", ["Glacial Aurora"]), A("biome", [])];
    expect(buildFacets(items)).toEqual(["Glacial Aurora", "Skyhold", "biome", "creature", "prop"]);
  });

  it("does not duplicate a tag that equals a type", () => {
    const items = [A("prop", ["prop", "Skyhold"])];
    expect(buildFacets(items)).toEqual(["Skyhold", "prop"]);
  });

  it("dedupes repeated tags across items", () => {
    const items = [A("prop", ["Skyhold"]), A("prop", ["Skyhold"])];
    expect(buildFacets(items)).toEqual(["Skyhold", "prop"]);
  });
});

describe("matchesFacet", () => {
  const item = A("prop", ["Skyhold"]);
  it("matches all, type, and tag", () => {
    expect(matchesFacet(item, "all")).toBe(true);
    expect(matchesFacet(item, "prop")).toBe(true);
    expect(matchesFacet(item, "Skyhold")).toBe(true);
  });
  it("rejects non-matches", () => {
    expect(matchesFacet(item, "creature")).toBe(false);
    expect(matchesFacet(item, "Frost")).toBe(false);
  });
});

describe("filterByFacet", () => {
  const items = [A("prop", ["Skyhold"]), A("creature", ["Frost"]), A("prop", ["Frost"])];
  it("returns a copy for 'all'", () => {
    const out = filterByFacet(items, "all");
    expect(out).toHaveLength(3);
    expect(out).not.toBe(items);
  });
  it("filters by type", () => {
    expect(filterByFacet(items, "prop")).toHaveLength(2);
  });
  it("filters by tag (across types)", () => {
    expect(filterByFacet(items, "Frost")).toHaveLength(2);
  });
});

describe("sortByNewest", () => {
  it("orders by createdAt descending", () => {
    const items = [
      A("prop", [], "2026-01-01T00:00:00Z"),
      A("creature", [], "2026-06-01T00:00:00Z"),
      A("biome", [], "2026-03-01T00:00:00Z"),
    ];
    expect(sortByNewest(items).map((i) => i.type)).toEqual(["creature", "biome", "prop"]);
  });
  it("does not mutate the input", () => {
    const items = [A("a", [], "2026-01-01T00:00:00Z"), A("b", [], "2026-02-01T00:00:00Z")];
    const before = items.map((i) => i.type);
    sortByNewest(items);
    expect(items.map((i) => i.type)).toEqual(before);
  });
});

describe("countByType", () => {
  it("tallies per type", () => {
    const items = [A("prop", []), A("prop", []), A("creature", [])];
    expect(countByType(items)).toEqual({ prop: 2, creature: 1 });
  });
});
