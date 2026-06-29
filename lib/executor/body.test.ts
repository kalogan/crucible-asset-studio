import { describe, it, expect } from "vitest";
import { stripNullish } from "./body";

describe("stripNullish", () => {
  it("drops null and undefined object keys", () => {
    expect(stripNullish({ a: 1, b: null, c: undefined, d: "x" })).toEqual({ a: 1, d: "x" });
  });

  it("recurses into nested objects", () => {
    expect(stripNullish({ input: { seed: 0, version: null } })).toEqual({
      input: { seed: 0 },
    });
  });

  it("filters null/undefined out of arrays", () => {
    expect(stripNullish({ images: ["u", null, undefined] })).toEqual({ images: ["u"] });
  });

  it("preserves falsy-but-valid values (0, false, empty string)", () => {
    expect(stripNullish({ seed: 0, flag: false, s: "" })).toEqual({
      seed: 0,
      flag: false,
      s: "",
    });
  });
});
