import { describe, it, expect } from "vitest";
import { Canon } from "@/lib/schema";
import { goldenCanon } from "@/lib/schema/__fixtures__/golden";
import { enforceLoraReadiness } from "./lora";

/** A parsed golden canon with LoRA fields overridden for the case under test. */
function canonWith(overrides: Partial<{
  lora_status: "none" | "training" | "ready";
  lora_ref: string | null;
  lora_trigger: string | null;
}>): Canon {
  return Canon.parse({ ...goldenCanon, ...overrides });
}

describe("enforceLoraReadiness", () => {
  it("passes and threads the ref/trigger when the LoRA is ready and present", () => {
    const canon = canonWith({
      lora_status: "ready",
      lora_ref: "kalogan/wayfinders-lora:abc123",
      lora_trigger: "wyfndrstyle",
    });
    const result = enforceLoraReadiness(canon);
    expect(result.ok).toBe(true);
    expect(result.enforced).toBe(true);
    expect(result.loraRef).toBe("kalogan/wayfinders-lora:abc123");
    expect(result.loraTrigger).toBe("wyfndrstyle");
    expect(result.error).toBeUndefined();
  });

  it("FAILS loudly when the LoRA is ready but lora_ref is missing", () => {
    const canon = canonWith({
      lora_status: "ready",
      lora_ref: null,
      lora_trigger: "wyfndrstyle",
    });
    const result = enforceLoraReadiness(canon);
    expect(result.ok).toBe(false);
    expect(result.enforced).toBe(true);
    expect(result.error).toContain("lora_ref");
    expect(result.error).toContain("ready");
    // Never hand back a ref/trigger to thread when it refused.
    expect(result.loraRef).toBeUndefined();
    expect(result.loraTrigger).toBeUndefined();
  });

  it("FAILS loudly when the LoRA is ready but lora_trigger is missing", () => {
    const canon = canonWith({
      lora_status: "ready",
      lora_ref: "kalogan/wayfinders-lora:abc123",
      lora_trigger: null,
    });
    const result = enforceLoraReadiness(canon);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("lora_trigger");
  });

  it("treats a blank (whitespace-only) ref as missing", () => {
    const canon = canonWith({
      lora_status: "ready",
      lora_ref: "   ",
      lora_trigger: "wyfndrstyle",
    });
    expect(enforceLoraReadiness(canon).ok).toBe(false);
  });

  it("does NOT gate when lora_status is 'none' — passes even with no ref", () => {
    const canon = canonWith({ lora_status: "none", lora_ref: null });
    const result = enforceLoraReadiness(canon);
    expect(result.ok).toBe(true);
    expect(result.enforced).toBe(false);
    expect(result.loraRef).toBeUndefined();
  });

  it("does NOT gate when lora_status is 'training' — passes even with no ref", () => {
    const canon = canonWith({ lora_status: "training", lora_ref: null });
    const result = enforceLoraReadiness(canon);
    expect(result.ok).toBe(true);
    expect(result.enforced).toBe(false);
  });

  it("does NOT gate when there is no canon (canon-free generation is allowed)", () => {
    const result = enforceLoraReadiness(null);
    expect(result.ok).toBe(true);
    expect(result.enforced).toBe(false);
  });
});
