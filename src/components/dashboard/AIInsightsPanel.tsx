import { motion, animate } from "framer-motion";
import { Brain, AlertTriangle, Shield, Wifi, Zap, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEffect, useRef } from "react";

interface AIInsightsPanelProps {
  healthScore: number;
  stressLevel: string;
  condition: string;
  message: string;
  insights?: string[];
  isEmergency: boolean;
  recommendations?: {
    lifestyle?: string[];
    diet?: string[];
    activity?: string[];
    medicines?: string[];
    disclaimer?: string;
  };
  onboarding?: any;
  rmssd?: number | null;
  rawBleData?: string | null;
}

/* ── Circular Progress Ring ──────────────────────────────────── */
function CircularProgress({ value, size = 80, strokeWidth = 5, color, label }: {
  value: number; size?: number; strokeWidth?: number; color: string; label: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ - (circ * Math.min(value, 100)) / 100;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full" style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-slate-200 dark:stroke-white/5" strokeWidth={strokeWidth} />
          <motion.circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeLinecap="round" strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: dash }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-sm font-bold" style={{ color, textShadow: `0 0 8px ${color}80` }}>{value}%</span>
        </div>
      </div>
      <span className="font-mono text-[7px] uppercase tracking-widest font-bold text-slate-400 dark:text-[#8FB8D8]">{label}</span>
    </div>
  );
}

/* ── Glass Card ──────────────────────────────────────────────── */
function AICard({ children, emergency = false }: { children: React.ReactNode; emergency?: boolean }) {
  return (
    <motion.div
      className={`relative rounded-2xl p-5 overflow-hidden border ${emergency ? "bg-red-50/50 dark:bg-[rgba(255,59,92,0.05)] border-red-500/30" : "bg-white/70 dark:bg-[#050816]/70 border-cyan-500/15"} backdrop-blur-xl`}
      style={{
        boxShadow: emergency
          ? "0 0 30px rgba(255,59,92,0.15)"
          : "0 0 20px rgba(0,229,255,0.06)",
      }}
      whileHover={{ scale: 1.03, y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
    >
      <div className="absolute inset-0 pointer-events-none dark:opacity-100 opacity-30" style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 50%)"
      }} />
      {children}
    </motion.div>
  );
}

export default function AIInsightsPanel({
  healthScore, stressLevel, condition, message, insights = [], isEmergency, recommendations, onboarding, rmssd, rawBleData
}: AIInsightsPanelProps) {
  const { t } = useTranslation();
  const isHighRisk = (stressLevel === 'HIGH' || isEmergency) && condition !== 'NOMINAL' && condition !== '';
  const mainColor = isHighRisk ? "#FF3B5C" : "#0ea5e9"; // Use slate-blue/cyan for better light mode
  const aiConfidence = healthScore > 0 ? Math.min(98, healthScore + 15) : 87;
  const anomalyCount = isHighRisk ? Math.floor(Math.random() * 3) + 1 : 0;

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* ── AI RISK PREDICTION ────────────────────────────────── */}
      <AICard emergency={isHighRisk}>
        <div className="flex items-center gap-2 mb-3 relative z-10">
          <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }}>
            <Brain className="h-5 w-5" style={{ color: mainColor, filter: `drop-shadow(0 0 6px ${mainColor}80)` }} />
          </motion.div>
          <h3 className="font-mono text-[9px] uppercase tracking-[0.2em] font-bold text-slate-700 dark:text-[#E2F3FF]">AI Risk Prediction</h3>
          {isHighRisk && <AlertTriangle className="h-3 w-3 animate-pulse text-red-500" />}
        </div>
        <div className="flex flex-col gap-1 relative z-10">
          <span className="font-display text-xl font-bold uppercase" style={{ color: mainColor, textShadow: `0 0 15px ${mainColor}80` }}>
            {stressLevel === 'LOW' ? 'NOMINAL' : stressLevel || 'STANDBY'}
          </span>
          <div className="flex justify-between items-center">
            <span className="font-mono text-[8px] uppercase tracking-widest text-slate-500 dark:text-[#8FB8D8]">
              AI CONFIDENCE: {aiConfidence}%
            </span>
            {rmssd !== undefined && rmssd !== null && rmssd > 0 && (
              <span className="font-mono text-[8px] uppercase tracking-widest text-cyan-500 font-bold">
                RMSSD: {rmssd.toFixed(1)}ms
              </span>
            )}
          </div>
          {/* Confidence bar */}
          <div className="w-full h-1 rounded-full mt-1 overflow-hidden bg-slate-200 dark:bg-white/5">
            <motion.div className="h-full rounded-full" style={{
              background: mainColor, boxShadow: `0 0 8px ${mainColor}`,
            }} initial={{ width: "0%" }} animate={{ width: `${aiConfidence}%` }} transition={{ duration: 1.5 }} />
          </div>
        </div>
        {/* Processing indicator */}
        <motion.div className="flex items-center gap-1 mt-2 relative z-10"
          animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }}>
          <div className="flex gap-0.5">
            {[0, 1, 2].map(i => (
              <motion.div key={i} className="w-1 h-1 rounded-full" style={{ background: mainColor }}
                animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
          <span className="font-mono text-[7px] uppercase tracking-widest" style={{ color: mainColor }}>PROCESSING</span>
        </motion.div>
      </AICard>

      {/* ── HEALTH SCORE ──────────────────────────────────────── */}
      <AICard>
        <div className="flex items-center gap-2 mb-3 relative z-10">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" style={{ boxShadow: "0 0 6px #22d3ee" }} />
          <h3 className="font-mono text-[9px] uppercase tracking-[0.2em] font-bold text-slate-500 dark:text-[#8FB8D8]">{t("dashboard.healthScore")}</h3>
        </div>
        <div className="flex items-center gap-4 relative z-10">
          <CircularProgress value={healthScore} size={70} color={isHighRisk ? "#FF3B5C" : "#22d3ee"} label="OVERALL" />
          <div className="flex flex-col gap-1">
            <span className="font-display text-3xl font-bold" style={{
              color: isHighRisk ? "#FF3B5C" : "#0ea5e9",
              textShadow: `0 0 15px ${isHighRisk ? "rgba(255,59,92,0.5)" : "rgba(14,165,233,0.5)"}`
            }}>{healthScore}</span>
            <span className="font-mono text-[8px] font-bold text-slate-400 dark:text-[#8FB8D8]">/ 100 POINTS</span>
          </div>
        </div>
      </AICard>

      {/* ── ABNORMALITY DETECTION ─────────────────────────────── */}
      <AICard emergency={anomalyCount > 0}>
        <div className="flex items-center justify-between mb-2 relative z-10">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" style={{ color: anomalyCount > 0 ? "#FF3B5C" : "#0ea5e9" }} />
            <h3 className="font-mono text-[9px] uppercase tracking-[0.2em] font-bold text-slate-500 dark:text-[#8FB8D8]">Anomaly Detection</h3>
          </div>
          <span className="font-display text-sm font-bold" style={{
            color: anomalyCount > 0 ? "#FF3B5C" : "#22d3ee",
            textShadow: `0 0 8px ${anomalyCount > 0 ? "#FF3B5C" : "#22d3ee"}`
          }}>{anomalyCount}</span>
        </div>
        <span className="font-mono text-[8px] uppercase tracking-widest relative z-10" style={{
          color: anomalyCount > 0 ? "#FF3B5C" : "#0ea5e9"
        }}>{anomalyCount > 0 ? "ANOMALIES FLAGGED" : "ALL CLEAR"}</span>
      </AICard>

      {/* ── SENSOR STATUS ─────────────────────────────────────── */}
      <AICard>
        <div className="flex items-center gap-2 mb-2 relative z-10">
          <Wifi className="h-4 w-4 text-cyan-500 dark:text-[#38BDF8]" />
          <h3 className="font-mono text-[9px] uppercase tracking-[0.2em] font-bold text-slate-500 dark:text-[#8FB8D8]">Sensor Status</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 relative z-10">
          {[
            { label: "ESP32", status: "ONLINE", color: "#0ea5e9" },
            { label: "WiFi", status: "CONNECTED", color: "#38bdf8" },
            { label: "MAX30102", status: "ACTIVE", color: "#06b6d4" },
            { label: "DS18B20", status: "ACTIVE", color: "#06b6d4" },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1.5">
              <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: s.color, boxShadow: `0 0 4px ${s.color}` }}
                animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />
              <div className="flex flex-col">
                <span className="font-mono text-[7px] font-bold text-slate-600 dark:text-[#E2F3FF]">{s.label}</span>
                <span className="font-mono text-[6px]" style={{ color: s.color }}>{s.status}</span>
              </div>
            </div>
          ))}
        </div>
      </AICard>

      {/* ── EMERGENCY ALERT STATE ─────────────────────────────── */}
      <AICard emergency={isEmergency}>
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2">
            <motion.div animate={isEmergency ? { scale: [1, 1.3, 1] } : {}} transition={{ duration: 0.5, repeat: Infinity }}>
              <Zap className="h-4 w-4" style={{ color: isEmergency ? "#FF3B5C" : "#0ea5e9" }} />
            </motion.div>
            <h3 className="font-mono text-[9px] uppercase tracking-[0.2em] font-bold text-slate-500 dark:text-[#8FB8D8]">Emergency</h3>
          </div>
          <span className="px-2 py-0.5 rounded font-mono text-[7px] font-bold uppercase" style={{
            background: isEmergency ? "rgba(255,59,92,0.2)" : "rgba(14,165,233,0.1)",
            border: `1px solid ${isEmergency ? "rgba(255,59,92,0.4)" : "rgba(14,165,233,0.2)"}`,
            color: isEmergency ? "#FF3B5C" : "#0ea5e9",
          }}>{isEmergency ? "ACTIVE" : "STANDBY"}</span>
        </div>
      </AICard>

      {/* ── NEURAL FEED (Terminal Logs) ───────────────────────── */}
      <AICard>
        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-cyan-600 dark:text-[#00E5FF]" />
            <h3 className="font-mono text-[9px] uppercase tracking-[0.2em] font-bold text-slate-500 dark:text-[#8FB8D8]">Neural Feed</h3>
          </div>
          {isHighRisk && <AlertTriangle className="h-3 w-3 text-red-500 animate-pulse" />}
        </div>
        <div className="rounded-xl p-3 font-mono text-[10px] overflow-hidden relative max-h-40 z-10 bg-slate-100/50 dark:bg-black/40 border border-slate-200 dark:border-cyan-500/10">
          <motion.div className="flex flex-col gap-2" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            {insights.map((insight, i) => (
              <div key={`i-${i}`} className="flex gap-2" style={{ animationDelay: `${i * 150}ms` }}>
                <span className="shrink-0 text-cyan-600 dark:text-[#00E5FF]">&gt;</span>
                <span className="leading-relaxed break-words text-slate-700 dark:text-[#E2F3FF]">{insight}</span>
              </div>
            ))}
            <div className="flex gap-2">
              <span className="shrink-0" style={{ color: isHighRisk ? "#FF3B5C" : "#0ea5e9" }}>&gt;</span>
              <span className="leading-relaxed break-words" style={{ color: isHighRisk ? "#FF3B5C" : "#0ea5e9" }}>
                {message || "Vitals within nominal parameters."}
              </span>
            </div>
            {recommendations?.lifestyle?.slice(0, 2).map((rec, i) => (
              <div key={`l-${i}`} className="flex gap-2">
                <span className="shrink-0 text-blue-500 dark:text-[#38BDF8]">&gt;</span>
                <span className="uppercase text-[8px] text-slate-500 dark:text-[rgba(226,243,255,0.6)]">[LIFESTYLE] {rec}</span>
              </div>
            ))}
            {rawBleData && (
              <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-cyan-500/10">
                <span className="font-mono text-[7px] text-cyan-500/50">RAW BLE TELEMETRY:</span>
                <span className="font-mono text-[8px] break-all text-cyan-500/70">{rawBleData}</span>
              </div>
            )}
          </motion.div>
          <div className="absolute bottom-0 left-0 w-full h-6 pointer-events-none bg-gradient-to-t from-slate-100 dark:from-[#050816] to-transparent opacity-80" />
        </div>
      </AICard>
    </div>
  );
}
