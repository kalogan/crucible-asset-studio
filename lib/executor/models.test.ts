import { describe, it, expect } from "vitest";
import { resolveModelRequest, REPLICATE_API } from "./models";

describe("resolveModelRequest", () => {
  it("routes an endpoint model to /models/{owner}/{name}/predictions with { input }", () => {
    const r = resolveModelRequest("black-forest-labs/flux-schnell", { prompt: "x" });
    expect(r.endpoint).toBe(
      `${REPLICATE_API}/models/black-forest-labs/flux-schnell/predictions`,
    );
    expect(r.body).toEqual({ input: { prompt: "x" } });
    expect(r.useWait).toBe(true); // flux-schnell is fast
  });

  it("routes a versioned model to /predictions with the pinned hash", () => {
    const r = resolveModelRequest("firtoz/trellis", { images: ["u"] });
    expect(r.endpoint).toBe(`${REPLICATE_API}/predictions`);
    expect(r.body).toMatchObject({ input: { images: ["u"] } });
    expect(typeof (r.body as { version: string }).version).toBe("string");
    expect(r.useWait).toBe(false);
  });

  it("routes an explicit version to the versioned endpoint regardless of model", () => {
    const r = resolveModelRequest(null, { a: 1 }, "deadbeef");
    expect(r.endpoint).toBe(`${REPLICATE_API}/predictions`);
    expect(r.body).toEqual({ version: "deadbeef", input: { a: 1 } });
  });

  it("marks a non-fast endpoint model as no-wait", () => {
    expect(resolveModelRequest("nightmareai/real-esrgan", {}).useWait).toBe(false);
  });

  it("throws on an unknown model", () => {
    expect(() => resolveModelRequest("acme/nope", {})).toThrow(/Unknown model/);
  });

  it("throws when neither model nor version is given", () => {
    expect(() => resolveModelRequest(null, {})).toThrow();
  });
});
