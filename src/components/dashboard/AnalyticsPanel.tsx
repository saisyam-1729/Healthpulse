import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { motion } from "framer-motion";
import { Activity, Radio, Cpu, Clock, Wifi } from "lucide-react";
import { useState, useEffect } from "react";

interface AnalyticsPanelProps {
  chartData: any[];
}

/* ── Custom Tooltip ──────────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl p-3 bg-white/90 dark:bg-[rgba(5,8,22,0.95)] border border-cyan-500/20 backdrop-blur-xl shadow-[0_0_20px_rgba(0,229,255,0.1)]">
        <p className="font-mono text-[9px] mb-2 text-slate-500 dark:text-[#8FB8D8]">{label}</p>
        {payload.map((e: any, i: number) => (
          <div key={i} className="flex items-center gap-2 font-mono text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: e.color }} />
            <span style={{ color: e.color }}>{e.name}:</span>
            <span className="font-bold text-slate-700 dark:text-[#E2F3FF]">{e.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

/* ── Live ECG Waveform Canvas ────────────────────────────────── */
function LiveECGWaveform() {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setOffset(prev => (prev + 2) % 400), 30);
    return () => clearInterval(interval);
  }, []);

  const generateECGPath = () => {
    const points: string[] = [];
    const w = 800;
    for (let x = 0; x < w; x += 1) {
      const pos = (x + offset * 2) % 200;
      let y = 50;
      if (pos > 60 && pos < 65) y = 50 - Math.sin((pos - 60) / 5 * Math.PI) * 8;
      else if (pos > 70 && pos < 73) y = 50 - 35;
      else if (pos > 73 && pos < 76) y = 50 + 15;
      else if (pos > 76 && pos < 82) y = 50 - Math.sin((pos - 76) / 6 * Math.PI) * 5;
      else if (pos > 90 && pos < 100) y = 50 - Math.sin((pos - 90) / 10 * Math.PI) * 10;
      points.push(`${x},${y}`);
    }
    return `M ${points.join(" L ")}`;
  };

  return (
    <div className="w-full h-24 overflow-hidden relative">
      <svg viewBox="0 0 800 100" preserveAspectRatio="none" className="w-full h-full">
        {/* Grid */}
        {Array.from({ length: 20 }, (_, i) => (
          <line key={`vg-${i}`} x1={i * 40} y1="0" x2={i * 40} y2="100" className="stroke-slate-200 dark:stroke-[rgba(0,229,255,0.05)]" strokeWidth="0.5" />
        ))}
        {Array.from({ length: 5 }, (_, i) => (
          <line key={`hg-${i}`} x1="0" y1={i * 25} x2="800" y2={i * 25} className="stroke-slate-200 dark:stroke-[rgba(0,229,255,0.05)]" strokeWidth="0.5" />
        ))}
        {/* ECG line */}
        <path d={generateECGPath()} fill="none" stroke="#0ea5e9" className="dark:stroke-[#00E5FF]" strokeWidth="2"
          style={{ filter: "drop-shadow(0 0 6px rgba(14,165,233,0.5))" }} />
        {/* Glow underneath */}
        <path d={generateECGPath()} fill="none" stroke="#0ea5e9" className="dark:stroke-[#00E5FF]" strokeWidth="4" opacity="0.15"
          style={{ filter: "blur(4px)" }} />
      </svg>
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white dark:from-[#050816] to-transparent opacity-80" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white dark:from-[#050816] to-transparent opacity-80" />
    </div>
  );
}

/* ── Scrolling Logs ──────────────────────────────────────────── */
function ScrollingLogs() {
  const [logs] = useState([
    { time: "00:01:23", msg: "ESP32 heartbeat received", type: "info" },
    { time: "00:01:24", msg: "SpO2 sensor calibrated", type: "info" },
    { time: "00:01:25", msg: "AI prediction engine: cycle complete", type: "success" },
    { time: "00:01:26", msg: "Temperature sensor: reading stable", type: "info" },
    { time: "00:01:28", msg: "Data packet synced to cloud", type: "success" },
    { time: "00:01:30", msg: "Neural network inference: 12ms", type: "info" },
    { time: "00:01:32", msg: "Biometric hash verified", type: "success" },
    { time: "00:01:34", msg: "WebSocket keepalive: OK", type: "info" },
  ]);

  return (
    <div className="overflow-hidden h-full relative">
      <motion.div
        className="flex flex-col gap-1.5"
        animate={{ y: [0, -120] }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
      >
        {[...logs, ...logs].map((log, i) => (
          <div key={i} className="flex items-center gap-2 font-mono text-[9px]">
            <span className="text-slate-400 dark:text-[rgba(143,184,216,0.4)]">{log.time}</span>
            <span className="w-1 h-1 rounded-full" style={{
              background: log.type === "success" ? "#10b981" : "#0ea5e9",
              boxShadow: `0 0 4px ${log.type === "success" ? "#10b981" : "#0ea5e9"}`
            }} />
            <span className={log.type === "success" ? "text-emerald-600 dark:text-[#00F5D4]" : "text-cyan-700 dark:text-[#E2F3FF]"}>{log.msg}</span>
          </div>
        ))}
      </motion.div>
      <div className="absolute bottom-0 left-0 w-full h-8 pointer-events-none bg-gradient-to-t from-slate-100 dark:from-[#050816] to-transparent opacity-90" />
    </div>
  );
}

/* ── Glass Card ──────────────────────────────────────────────── */
function BottomCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={`relative rounded-2xl overflow-hidden bg-white/70 dark:bg-[#050816]/80 backdrop-blur-xl border border-cyan-500/10 shadow-[0_0_25px_rgba(0,229,255,0.05)] ${className}`}
      whileHover={{ scale: 1.01, boxShadow: "0 0 40px rgba(0,229,255,0.1)" }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <div className="absolute inset-0 pointer-events-none dark:opacity-100 opacity-30" style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 50%)"
      }} />
      {children}
    </motion.div>
  );
}

export default function AnalyticsPanel({ chartData }: AnalyticsPanelProps) {
  return (
    <div className="flex flex-col gap-4">

      {/* ── LIVE ECG WAVEFORM ─────────────────────────────────── */}
      <BottomCard className="p-5">
        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="flex items-center gap-2">
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}>
              <Activity className="h-4 w-4 text-cyan-600 dark:text-[#00E5FF]" style={{ filter: "drop-shadow(0 0 6px rgba(0,229,255,0.5))" }} />
            </motion.div>
            <h3 className="font-mono text-[9px] uppercase tracking-[0.2em] font-bold text-slate-700 dark:text-[#E2F3FF]">
              Live ECG Waveform
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <motion.div className="flex items-center gap-1" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}>
              <Radio className="h-3 w-3 text-emerald-500 dark:text-[#00F5D4]" />
              <span className="font-mono text-[7px] uppercase text-emerald-600 dark:text-[#00F5D4]">LIVE</span>
            </motion.div>
          </div>
        </div>
        <LiveECGWaveform />
      </BottomCard>

      {/* ── CHARTS ROW ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Heart Rate Trend */}
        <BottomCard className="p-5 h-[250px] flex flex-col">
          <div className="flex items-center gap-2 mb-3 relative z-10">
            <span className="h-1.5 w-1.5 rounded-full animate-pulse bg-cyan-500 dark:bg-[#00E5FF]" style={{ boxShadow: "0 0 6px rgba(0,229,255,0.6)" }} />
            <h3 className="font-mono text-[9px] uppercase tracking-[0.2em] font-bold text-slate-700 dark:text-[#E2F3FF]">Heart Rate Trend</h3>
          </div>
          <div className="flex-1 w-full min-h-0 relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(14,165,233,0.1)" />
                <XAxis dataKey="time" tick={{ fill: 'rgba(14,165,233,0.5)', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(14,165,233,0.5)', fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="hr" name="HR (BPM)" stroke="#0ea5e9" strokeWidth={2} fill="url(#hrGrad)"
                  dot={false} activeDot={{ r: 4, fill: "#0ea5e9", stroke: "white", strokeWidth: 2 }}
                  style={{ filter: "drop-shadow(0 0 6px rgba(14,165,233,0.4))" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </BottomCard>

        {/* Stress & Temp */}
        <BottomCard className="p-5 h-[250px] flex flex-col">
          <div className="flex items-center gap-2 mb-3 relative z-10">
            <span className="h-1.5 w-1.5 rounded-full animate-pulse bg-pink-500 dark:bg-[#FF006E]" style={{ boxShadow: "0 0 6px rgba(255,0,110,0.6)" }} />
            <h3 className="font-mono text-[9px] uppercase tracking-[0.2em] font-bold text-slate-700 dark:text-[#E2F3FF]">AI Stress & Temp Metrics</h3>
          </div>
          <div className="flex-1 w-full min-h-0 relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(14,165,233,0.1)" />
                <XAxis dataKey="time" tick={{ fill: 'rgba(14,165,233,0.5)', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(14,165,233,0.5)', fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="temp" name="Temp (°C)" stroke="#f59e0b" strokeWidth={2} dot={false}
                  style={{ filter: "drop-shadow(0 0 4px rgba(245,158,11,0.4))" }} />
                <Line type="monotone" dataKey="stress" name="Stress" stroke="#ec4899" strokeWidth={2} dot={false}
                  activeDot={{ r: 4, fill: "#ec4899", stroke: "white", strokeWidth: 2 }}
                  style={{ filter: "drop-shadow(0 0 6px rgba(236,72,153,0.5))" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </BottomCard>
      </div>

      {/* ── BOTTOM ROW: Logs + IoT Status ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sensor Logs */}
        <BottomCard className="p-5 h-40 lg:col-span-2 flex flex-col">
          <div className="flex items-center gap-2 mb-3 relative z-10">
            <Cpu className="h-3 w-3 text-blue-500 dark:text-[#38BDF8]" />
            <h3 className="font-mono text-[9px] uppercase tracking-[0.2em] font-bold text-slate-700 dark:text-[#E2F3FF]">Real-Time Sensor Logs</h3>
          </div>
          <div className="flex-1 overflow-hidden relative z-10">
            <ScrollingLogs />
          </div>
        </BottomCard>

        {/* IoT Device Status */}
        <BottomCard className="p-5 h-40 flex flex-col">
          <div className="flex items-center gap-2 mb-3 relative z-10">
            <Wifi className="h-3 w-3 text-emerald-500 dark:text-[#00F5D4]" />
            <h3 className="font-mono text-[9px] uppercase tracking-[0.2em] font-bold text-slate-700 dark:text-[#E2F3FF]">IoT Status</h3>
          </div>
          <div className="flex flex-col gap-2 relative z-10">
            {[
              { label: "ESP32 WiFi", status: "Connected", color: "#10b981", darkColor: "#00F5D4" },
              { label: "Data Stream", status: "Active", color: "#0ea5e9", darkColor: "#00E5FF" },
              { label: "Cloud Sync", status: "Real-time", color: "#3b82f6", darkColor: "#38BDF8" },
              { label: "Latency", status: "12ms", color: "#10b981", darkColor: "#00F5D4" },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between font-mono text-[9px]">
                <span className="text-slate-500 dark:text-[#8FB8D8]">{item.label}</span>
                <div className="flex items-center gap-1.5">
                  <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: item.color, boxShadow: `0 0 4px ${item.color}` }}
                    animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />
                  <span style={{ color: item.color }}>{item.status}</span>
                </div>
              </div>
            ))}
          </div>
        </BottomCard>
      </div>
    </div>
  );
}
