import { describe, it, expect } from "vitest";
import { computeStressScore } from "./stress";

describe("computeStressScore with missing readings", () => {
  it("does not treat a missing heart rate as a very low one", () => {
    const missing = computeStressScore({ heartRate: null, temperature: 36.6 });
    const zero = computeStressScore({ heartRate: 0, temperature: 36.6 });
    const normal = computeStressScore({ heartRate: 72, temperature: 36.6 });
    expect(missing).toBe(normal);
    expect(zero).toBe(normal);
  });
  it("does not treat a missing temperature as a very low one", () => {
    expect(computeStressScore({ heartRate: 72, temperature: null })).toBe(computeStressScore({ heartRate: 72 }));
  });
  it("still scores real out-of-range readings", () => {
    expect(computeStressScore({ heartRate: 130, temperature: 36.6 })).toBeGreaterThan(computeStressScore({ heartRate: 72, temperature: 36.6 }));
  });
});
