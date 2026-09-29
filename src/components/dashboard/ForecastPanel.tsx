import { useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/services/api";
import {
  buildSeries,
  CHANNELS,
  describeForecastError,
  type Channel,
  type DiffusionInsights,
  type SeriesRow,
} from "@/lib/forecast";

const PREDICTION_STEPS = 6;
const MEASURED = "#0ea5e9";
const ESTIMATE = "#a855f7";
const FORECAST = "#f59e0b";

interface ForecastTooltipProps {
  active?: boolean;
  payload?: { payload: SeriesRow }[];
  label?: string;
  channel: Channel;
}

const ForecastTooltip = ({ active, payload, label, channel }: ForecastTooltipProps) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const { unit, decimals } = CHANNELS[channel];
  const fmt = (v?: number) => (v === undefined ? "" : `${v.toFixed(decimals)} ${unit}`);
  const band = (b?: [number, number]) => (b && b[0] !== b[1] ? ` (range ${b[0].toFixed(decimals)}–${b[1].toFixed(decimals)})` : "");
  return (
    <div className="rounded-xl p-3 bg-white/95 dark:bg-[rgba(5,8,22,0.95)] border border-cyan-500/20 shadow-lg font-mono text-[10px] space-y-1">
      <p className="text-slate-500 dark:text-[#8FB8D8]">{label}</p>
      {row.measured !== undefined && <p style={{ color: MEASURED }}>Measured: {fmt(row.measured)}</p>}
      {row.measured === undefined && row.filled !== undefined && (
        <p style={{ color: ESTIMATE }}>Model estimate: {fmt(row.filled)}{band(row.filledBand)}</p>
      )}
      {row.isForecast && row.forecast !== undefined && (
        <p style={{ color: FORECAST }}>Forecast: {fmt(row.forecast)}{band(row.forecastBand)}</p>
      )}
    </div>
  );
};

export default function ForecastPanel() {
  const [data, setData] = useState<DiffusionInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState<Channel>("heartRate");

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      setData((await api.get(`/diffusion/insights?predictionLength=${PREDICTION_STEPS}`)) as DiffusionInsights);
    } catch (e) {
      setData(null); // never leave an older forecast on screen next to an error
      setError(describeForecastError(e as { status?: number; message?: string }));
    } finally {
      setLoading(false);
    }
  };

  const rows = useMemo(() => (data ? buildSeries(data, channel) : []), [data, channel]);
  const firstForecast = rows.findIndex((r) => r.isForecast);
  const filledSteps = data ? data.context.observed.filter((o) => !o).length : 0;

  return (
    <section
      aria-label="Model-generated forecast"
      className="rounded-2xl p-5 bg-white/60 dark:bg-[#050816]/70 border border-cyan-500/10 shadow-[0_0_20px_rgba(0,229,255,0.04)] backdrop-blur-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-purple-500" />
          <h3 className="font-mono text-[9px] uppercase tracking-[0.2em] font-bold text-slate-700 dark:text-[#E2F3FF]">
            Gap-fill &amp; Forecast (research)
          </h3>
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Model-generated · not measurements
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={run} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
          {data ? "Refresh" : "Generate"}
        </Button>
      </div>

      {!data && !loading && !error && (
        <p className="text-sm text-slate-500 dark:text-[#8FB8D8] py-6">
          Estimates values your sensor missed and projects the next {PREDICTION_STEPS * 5} seconds from your recent readings,
          with an uncertainty range. It can take several seconds to compute.
        </p>
      )}

      {loading && <p role="status" className="text-sm text-slate-500 dark:text-[#8FB8D8] py-6">Computing… this can take up to a few seconds.</p>}

      {error && !loading && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400 my-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {data && (
        <div className={loading ? "opacity-50" : ""}>
          <div className="flex gap-1 mb-2" role="tablist" aria-label="Channel">
            {(Object.keys(CHANNELS) as Channel[]).map((c) => (
              <button
                key={c}
                role="tab"
                aria-selected={c === channel}
                onClick={() => setChannel(c)}
                className={`px-2.5 py-1 rounded-md font-mono text-[10px] border ${
                  c === channel ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-700 dark:text-cyan-300" : "border-transparent text-slate-500 hover:bg-slate-500/10"
                }`}
              >
                {CHANNELS[c].label}
              </button>
            ))}
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(14,165,233,0.1)" />
                <XAxis dataKey="time" tick={{ fill: "rgba(14,165,233,0.6)", fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "rgba(14,165,233,0.6)", fontSize: 9 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} width={38} />
                <Tooltip content={<ForecastTooltip channel={channel} />} />
                {firstForecast > 0 && (
                  <ReferenceArea x1={rows[firstForecast - 1].time} x2={rows[rows.length - 1].time} fill={FORECAST} fillOpacity={0.06} />
                )}
                <Area dataKey="filledBand" stroke="none" fill={ESTIMATE} fillOpacity={0.2} isAnimationActive={false} connectNulls={false} />
                <Area dataKey="forecastBand" stroke="none" fill={FORECAST} fillOpacity={0.2} isAnimationActive={false} connectNulls={false} />
                <Line dataKey="filled" stroke={ESTIMATE} strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3, fill: "transparent", stroke: ESTIMATE, strokeDasharray: "0" }} isAnimationActive={false} connectNulls />
                <Line dataKey="forecast" stroke={FORECAST} strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3, fill: "transparent", stroke: FORECAST, strokeDasharray: "0" }} isAnimationActive={false} connectNulls />
                <Line dataKey="measured" stroke={MEASURED} strokeWidth={2} dot={{ r: 2.5, fill: MEASURED }} isAnimationActive={false} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <ul className="flex flex-wrap gap-x-5 gap-y-1 mt-2 font-mono text-[10px] text-slate-600 dark:text-[#8FB8D8]">
            <li className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2" style={{ borderColor: MEASURED }} />Measured by sensor</li>
            <li className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: ESTIMATE }} />Model estimate for missing readings ({filledSteps})</li>
            <li className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: FORECAST }} />Forecast (shaded band = uncertainty range)</li>
          </ul>

          {data.stale && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              Your latest reading is more than 15 minutes old, so this reflects older data.
            </p>
          )}
          <p className="mt-2 text-[11px] text-slate-500 dark:text-[#8FB8D8]">{data.disclaimer}</p>
        </div>
      )}
    </section>
  );
}
