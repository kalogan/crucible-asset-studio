import { describe, it, expect, afterEach } from "vitest";
import {
  getDailyCostCap,
  wouldExceedCap,
  startOfUtcDayIso,
  estimatedSpend,
  DEFAULT_DAILY_COST_CAP,
} from "./budget";

describe("getDailyCostCap", () => {
  afterEach(() => {
    delete process.env.CRUCIBLE_DAILY_COST_CAP;
  });
  it("defaults when unset", () => {
    expect(getDailyCostCap()).toBe(DEFAULT_DAILY_COST_CAP);
  });
  it("reads a valid override", () => {
    process.env.CRUCIBLE_DAILY_COST_CAP = "2.5";
    expect(getDailyCostCap()).toBe(2.5);
  });
  it("ignores an invalid override", () => {
    process.env.CRUCIBLE_DAILY_COST_CAP = "nope";
    expect(getDailyCostCap()).toBe(DEFAULT_DAILY_COST_CAP);
  });
});

describe("wouldExceedCap", () => {
  it("allows when well under the cap", () => {
    expect(wouldExceedCap(0, 5)).toBe(false);
  });
  it("blocks when the next run would cross the cap", () => {
    // cap 0.10; 1 job today (~0.09) + next (~0.09) = 0.18 > 0.10
    expect(wouldExceedCap(1, 0.1)).toBe(true);
  });
});

describe("startOfUtcDayIso", () => {
  it("zeroes the time component (UTC)", () => {
    expect(startOfUtcDayIso(new Date("2026-06-29T15:30:00Z"))).toBe(
      "2026-06-29T00:00:00.000Z",
    );
  });
});

describe("estimatedSpend", () => {
  it("scales with job count", () => {
    expect(estimatedSpend(3)).toBeCloseTo(0.27);
  });
});
