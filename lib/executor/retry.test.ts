import { describe, it, expect } from "vitest";
import { withRetry, HttpError, parseRetryAfter } from "./retry";

const noSleep = async () => {};
const fixedRandom = () => 0.5;

describe("withRetry", () => {
  it("retries a 429 then succeeds", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new HttpError(429, "rate limited");
        return "ok";
      },
      { sleep: noSleep, random: fixedRandom },
    );
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("gives up after exhausting retries and rethrows", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new HttpError(503, "unavailable");
        },
        { retries: 2, sleep: noSleep, random: fixedRandom },
      ),
    ).rejects.toThrow(/unavailable/);
    expect(calls).toBe(3); // initial + 2 retries
  });

  it("does not retry a non-retryable error", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new HttpError(400, "bad request");
        },
        { sleep: noSleep, random: fixedRandom },
      ),
    ).rejects.toThrow(/bad request/);
    expect(calls).toBe(1);
  });
});

describe("parseRetryAfter", () => {
  it("parses a seconds value", () => {
    expect(parseRetryAfter("2", 0)).toBe(2000);
  });

  it("parses an HTTP-date relative to now", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    expect(parseRetryAfter("Thu, 01 Jan 2026 00:00:05 GMT", now)).toBe(5000);
  });

  it("returns undefined for a missing header", () => {
    expect(parseRetryAfter(null, 0)).toBeUndefined();
  });
});
