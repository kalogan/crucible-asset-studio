import { describe, it, expect } from "vitest";
import { extractImageFromResponse } from "./nanobanana";

describe("extractImageFromResponse", () => {
  it("returns the first inline image from a well-formed response", () => {
    const json = {
      candidates: [
        {
          content: {
            parts: [
              { text: "x" },
              { inlineData: { data: "AAAA", mimeType: "image/png" } },
            ],
          },
        },
      ],
    };
    expect(extractImageFromResponse(json)).toEqual({
      base64: "AAAA",
      mimeType: "image/png",
    });
  });

  it("defaults mimeType to image/png when absent", () => {
    const json = {
      candidates: [{ content: { parts: [{ inlineData: { data: "AAAA" } }] } }],
    };
    expect(extractImageFromResponse(json)).toEqual({
      base64: "AAAA",
      mimeType: "image/png",
    });
  });

  it("returns null for an empty object", () => {
    expect(extractImageFromResponse({})).toBeNull();
  });

  it("returns null for null", () => {
    expect(extractImageFromResponse(null)).toBeNull();
  });

  it("returns null when candidates is empty", () => {
    expect(extractImageFromResponse({ candidates: [] })).toBeNull();
  });

  it("returns null when no part has inlineData", () => {
    const json = { candidates: [{ content: { parts: [{ text: "x" }] } }] };
    expect(extractImageFromResponse(json)).toBeNull();
  });

  it("returns null for arbitrary garbage", () => {
    expect(extractImageFromResponse("nope")).toBeNull();
    expect(extractImageFromResponse(42)).toBeNull();
    expect(extractImageFromResponse({ candidates: [{}] })).toBeNull();
  });
});
