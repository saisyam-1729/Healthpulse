import { describe, it, expect } from "vitest";
import { buildSeries, describeForecastError, type DiffusionInsights, type Reading } from "./forecast";

const r = (hr: number | null): Reading => ({ heartRate: hr, spo2: hr === null ? null : 98, temperature: hr === null ? null : 36.6 });
const ts = (i: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, i * 5)).toISOString();

// 6 context steps; steps 2 and 3 are gaps. 2 forecast steps.
const insights: DiffusionInsights = {
  generated: true,
  disclaimer: "model-generated",
  stepSeconds: 5,
  observedSteps: 4,
  latestReadingAt: ts(5),
  stale: false,
  context: {
    timestamps: [0, 1, 2, 3, 4, 5].map(ts),
    observed: [true, true, false, false, true, true],
    measured: [r(70), r(71), r(null), r(null), r(74), r(75)],
    imputed: [r(70), r(71), r(72), r(73), r(74), r(75)],
    lower: [r(70), r(71), r(70), r(71), r(74), r(75)],
    upper: [r(70), r(71), r(74), r(75), r(74), r(75)],
  },
  forecast: {
    timestamps: [6, 7].map(ts),
    mean: [r(76), r(77)],
    lower: [r(74), r(74)],
    upper: [r(78), r(80)],
  },
};

describe("buildSeries", () => {
  const rows = buildSeries(insights, "heartRate");

  it("has one row per context step plus one per forecast step", () => {
    expect(rows).toHaveLength(8);
    expect(rows.map((x) => x.isForecast)).toEqual([false, false, false, false, false, false, true, true]);
  });

  it("puts real sensor values only in `measured`, never model estimates", () => {
    expect(rows.map((x) => x.measured)).toEqual([70, 71, undefined, undefined, 74, 75, undefined, undefined]);
  });

  it("fills gaps with model estimates and their uncertainty band", () => {
    expect(rows[2].filled).toBe(72);
    expect(rows[2].filledBand).toEqual([70, 74]);
    expect(rows[3].filled).toBe(73);
  });

  it("anchors the dashed fill to the neighbouring measured points so the line connects", () => {
    expect(rows[1].filled).toBe(71);
    expect(rows[4].filled).toBe(74);
    expect(rows[0].filled).toBeUndefined();
    expect(rows[5].filled).toBeUndefined();
  });

  it("starts the forecast at the last context point and keeps its band", () => {
    expect(rows[5].forecast).toBe(75);
    expect(rows[6].forecast).toBe(76);
    expect(rows[7].forecastBand).toEqual([74, 80]);
  });

  it("supports the other channels", () => {
    expect(buildSeries(insights, "spo2")[0].measured).toBe(98);
    expect(buildSeries(insights, "temperature")[2].measured).toBeUndefined();
  });
});

describe("describeForecastError", () => {
  it("explains a missing model", () => {
    expect(describeForecastError({ status: 503, message: "Diffusion model checkpoint not loaded." })).toMatch(/not been trained or loaded/);
  });
  it("distinguishes an unavailable service", () => {
    expect(describeForecastError({ status: 503, message: "Diffusion service is unavailable" })).toMatch(/unavailable/);
  });
  it("uses the server message for too little data", () => {
    expect(describeForecastError({ status: 422, message: "Not enough recent readings (3 of the last 24 steps; need at least 6)." })).toMatch(/Not enough recent readings/);
  });
  it("handles timeouts, expired sessions and unknown errors", () => {
    expect(describeForecastError({ status: 504 })).toMatch(/too long/);
    expect(describeForecastError({ status: 401 })).toMatch(/sign in/);
    expect(describeForecastError({})).toBe("Could not generate a forecast.");
  });
});

import { isForecastPanelEnabled } from "./forecast";

describe("isForecastPanelEnabled", () => {
  it("is hidden for regular users by default", () => {
    expect(isForecastPanelEnabled("user", undefined)).toBe(false);
    expect(isForecastPanelEnabled(undefined, undefined)).toBe(false);
  });
  it("is visible to admins", () => {
    expect(isForecastPanelEnabled("admin", undefined)).toBe(true);
  });
  it("can be switched on for everyone with the build flag", () => {
    expect(isForecastPanelEnabled("user", "true")).toBe(true);
    expect(isForecastPanelEnabled("user", "false")).toBe(false);
  });
});
