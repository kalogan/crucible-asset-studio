import { describe, expect, it } from "vitest";
import { parseRepoUrl, toSlug, titleCase, mapRepoToProject } from "./repo";

describe("parseRepoUrl", () => {
  it("parses https URLs", () => {
    expect(parseRepoUrl("https://github.com/kalogan/storm-break-hockey")).toEqual({
      owner: "kalogan",
      repo: "storm-break-hockey",
    });
  });
  it("strips .git and trailing slash", () => {
    expect(parseRepoUrl("https://github.com/kalogan/project-mmo.git/")).toEqual({
      owner: "kalogan",
      repo: "project-mmo",
    });
  });
  it("parses owner/repo shorthand", () => {
    expect(parseRepoUrl("kalogan/corrupted-void")).toEqual({
      owner: "kalogan",
      repo: "corrupted-void",
    });
  });
  it("parses git@ ssh form", () => {
    expect(parseRepoUrl("git@github.com:kalogan/woodturning-studio.git")).toEqual({
      owner: "kalogan",
      repo: "woodturning-studio",
    });
  });
  it("ignores extra path/query after the repo", () => {
    expect(parseRepoUrl("https://github.com/kalogan/meteor/tree/main?x=1")).toEqual({
      owner: "kalogan",
      repo: "meteor",
    });
  });
  it("rejects junk", () => {
    expect(parseRepoUrl("")).toBeNull();
    expect(parseRepoUrl("not a repo")).toBeNull();
    expect(parseRepoUrl("https://example.com/foo")).toBeNull();
  });
});

describe("toSlug", () => {
  it("kebab-cases", () => {
    expect(toSlug("Storm Break Hockey")).toBe("storm-break-hockey");
    expect(toSlug("Corrupted_Veil!!")).toBe("corrupted-veil");
    expect(toSlug("--Meteor--")).toBe("meteor");
  });
});

describe("titleCase", () => {
  it("turns a slug into a display name", () => {
    expect(titleCase("storm-break-hockey")).toBe("Storm Break Hockey");
    expect(titleCase("woodturning_studio")).toBe("Woodturning Studio");
  });
});

describe("mapRepoToProject", () => {
  it("maps GitHub metadata to project fields", () => {
    expect(
      mapRepoToProject({
        name: "rhythm-tower",
        description: "  A rhythm climber.  ",
        homepage: "https://rhythm.example",
        html_url: "https://github.com/kalogan/rhythm-tower",
      }),
    ).toEqual({
      slug: "rhythm-tower",
      name: "Rhythm Tower",
      description: "A rhythm climber.",
      url: "https://rhythm.example",
      repo_url: "https://github.com/kalogan/rhythm-tower",
    });
  });
  it("nulls empty description/homepage", () => {
    const m = mapRepoToProject({
      name: "meteor",
      description: null,
      homepage: "",
      html_url: "https://github.com/kalogan/meteor",
    });
    expect(m.description).toBeNull();
    expect(m.url).toBeNull();
  });
});
