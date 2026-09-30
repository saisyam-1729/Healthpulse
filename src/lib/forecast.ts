export type Channel = "heartRate" | "spo2" | "temperature";

export interface Reading {
  heartRate: number | null;
  spo2: number | null;
  temperature: number | null;
}

/** Response of GET /api/diffusion/insights. Everything under `context.imputed`/`forecast` is model-generated. */
export interface DiffusionInsights {
  generated: true;
  disclaimer: string;
  stepSeconds: number;
  observedSteps: number;
  latestReadingAt: string;
  stale: boolean;
  context: {
    timestamps: string[];
    observed: boolean[];
    measured: Reading[];
    imputed: Reading[];
    lower: Reading[];
    upper: Reading[];
  };
  forecast: {
    timestamps: string[];
    mean: Reading[];
    lower: Reading[];
    upper: Reading[];
  };
}

/**
 * The forecast panel is off for regular users: on real data the model is not yet more
 * accurate than interpolation. Visible to admins, or to everyone when
 * VITE_ENABLE_FORECAST_PANEL=true is set at build time (for demos/research builds).
 */
export function isForecastPanelEnabled(
  role?: string | null,
  flag: string | undefined = import.meta.env.VITE_ENABLE_FORECAST_PANEL,
): boolean {
  return flag === "true" || role === "admin";
}

export const CHANNELS: Record<Channel, { label: string; unit: string; decimals: number }> = {
  heartRate: { label: "Heart rate", unit: "bpm", decimals: 0 },
  spo2: { label: "SpO2", unit: "%", decimals: 1 },
  temperature: { label: "Temperature", unit: "°C", decimals: 2 },
};

export interface SeriesRow {
  time: string;
  measured?: number;
  filled?: number;
  filledBand?: [number, number];
  forecast?: number;
  forecastBand?: [number, number];
  isForecast: boolean;
}

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/**
 * Turns one insights payload into chart rows for a single channel.
 * Three visually separate series: measured (real sensor values), filled (model estimate for
 * missing steps) and forecast (future). Filled and forecast lines are anchored to the nearest
 * measured point so the dashed lines connect to the solid one.
 */
export function buildSeries(data: DiffusionInsights, channel: Channel): SeriesRow[] {
  const { context, forecast } = data;
  const n = context.timestamps.length;
  const measuredAt = (i: number) => (context.observed[i] ? context.measured[i]?.[channel] ?? null : null);

  const rows: SeriesRow[] = [];
  for (let i = 0; i < n; i++) {
    const row: SeriesRow = { time: clock(context.timestamps[i]), isForecast: false };
    const m = measuredAt(i);
    if (m !== null) {
      row.measured = m;
      const neighbourMissing = (i > 0 && measuredAt(i - 1) === null) || (i < n - 1 && measuredAt(i + 1) === null);
      if (neighbourMissing) {
        row.filled = m;
        row.filledBand = [m, m];
      }
    } else {
      row.filled = context.imputed[i][channel] ?? undefined;
      const lo = context.lower[i][channel];
      const hi = context.upper[i][channel];
      if (lo !== null && hi !== null) row.filledBand = [lo, hi];
    }
    rows.push(row);
  }

  const last = rows[n - 1];
  const anchor = last.measured ?? last.filled;
  if (anchor !== undefined) {
    last.forecast = anchor;
    last.forecastBand = [anchor, anchor];
  }
  forecast.timestamps.forEach((ts, i) => {
    const mean = forecast.mean[i][channel];
    const lo = forecast.lower[i][channel];
    const hi = forecast.upper[i][channel];
    rows.push({
      time: clock(ts),
      isForecast: true,
      forecast: mean ?? undefined,
      forecastBand: lo !== null && hi !== null ? [lo, hi] : undefined,
    });
  });
  return rows;
}

/** Maps API failures (see backend/routes/diffusionRoutes.js) to messages a user can act on. */
export function describeForecastError(err: { status?: number; message?: string }): string {
  const message = err.message ?? "";
  switch (err.status) {
    case 401:
      return "Your session has expired. Please sign in again.";
    case 422:
      return message || "Not enough recent readings to build a forecast yet. Keep the sensor on for a minute or two.";
    case 429:
      return "Too many forecast requests. Please wait a moment and try again.";
    case 503:
      return /not loaded/i.test(message)
        ? "The forecasting model has not been trained or loaded on the server yet."
        : "The forecasting service is unavailable right now.";
    case 504:
      return "The forecasting service took too long to respond. Please try again.";
    default:
      return message || "Could not generate a forecast.";
  }
}
