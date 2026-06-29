import { describe, it, expect } from "vitest";
import { captionFor, contentFromFilename } from "./captions";

describe("contentFromFilename", () => {
  it("strips extension and normalizes separators", () => {
    expect(contentFromFilename("Arctic_Fox-front.png")).toBe("arctic fox front");
  });
});

describe("captionFor", () => {
  it("formats trigger, content, style tags", () => {
    expect(captionFor("wyfndrstyle", "arctic fox", ["faceted low-poly", "3/4 view"])).toBe(
      "wyfndrstyle, arctic fox, faceted low-poly, 3/4 view",
    );
  });
  it("drops empty parts", () => {
    expect(captionFor("wyfndrstyle", "barrel")).toBe("wyfndrstyle, barrel");
    expect(captionFor("", "barrel", [""])).toBe("barrel");
  });
});
