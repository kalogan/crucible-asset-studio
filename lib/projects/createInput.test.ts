import { describe, it, expect } from "vitest";
import { parseCreateProjectForm } from "./createInput";

describe("parseCreateProjectForm", () => {
  it("derives a slug from the name", () => {
    expect(parseCreateProjectForm("Deception Station")).toEqual({
      name: "Deception Station",
      slug: "deception-station",
    });
  });

  it("trims surrounding whitespace", () => {
    expect(parseCreateProjectForm("  Wayfinders  ")).toEqual({
      name: "Wayfinders",
      slug: "wayfinders",
    });
  });

  it("rejects too-short names", () => {
    expect(() => parseCreateProjectForm("a")).toThrow(/at least 2/);
  });

  it("rejects names that yield no slug", () => {
    expect(() => parseCreateProjectForm("!!!")).toThrow(/valid slug/);
  });
});
