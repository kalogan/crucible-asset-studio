import { describe, it, expect } from "vitest";
import { slugify, isValidSlug } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Deception Station")).toBe("deception-station");
  });

  it("collapses runs of non-alphanumerics", () => {
    expect(slugify("  Wayfinders --  Animals! ")).toBe("wayfinders-animals");
  });

  it("strips leading/trailing separators", () => {
    expect(slugify("__noir station__")).toBe("noir-station");
  });

  it("strips diacritics", () => {
    expect(slugify("Café Müller")).toBe("cafe-muller");
  });
});

describe("isValidSlug", () => {
  it("accepts clean slugs", () => {
    expect(isValidSlug("deception-station")).toBe(true);
  });

  it("rejects malformed slugs", () => {
    expect(isValidSlug("-bad")).toBe(false);
    expect(isValidSlug("Bad Slug")).toBe(false);
    expect(isValidSlug("double--dash")).toBe(false);
  });
});
