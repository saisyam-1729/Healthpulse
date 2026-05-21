import { motion, useAnimation } from "framer-motion";
import { useEffect, useState, useMemo } from "react";

interface HumanBodyViewProps {
  heartRate: number;
  fingerPresent: boolean;
  status: 'connected' | 'disconnected' | 'connecting';
  painAreas?: string[];
}

/* ── Floating particles ───────────────────────────────────────── */
function HolographicParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      dur: Math.random() * 8 + 6,
      delay: Math.random() * 5,
    })), []);

  return (
    <g className="holographic-particles">
      {particles.map(p => (
        <motion.circle
          key={p.id}
          cx={p.x} cy={p.y * 2.5} r={p.size * 0.3}
          fill="rgba(0,229,255,0.5)"
          animate={{ cy: [p.y * 2.5, p.y * 2.5 - 30, p.y * 2.5], opacity: [0.2, 0.8, 0.2] }}
          transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
        />
      ))}
    </g>
  );
}

/* ── Floating organ labels ────────────────────────────────────── */
const organLabels = [
  { label: "BRAIN", x: 50, y: 18, color: "#38BDF8" },
  { label: "HEART", x: 22, y: 68, color: "#FF3B5C" },
  { label: "LUNGS", x: 78, y: 62, color: "#00E5FF" },
  { label: "LIVER", x: 80, y: 88, color: "#00F5D4" },
  { label: "SPINE", x: 20, y: 110, color: "#38BDF8" },
];

function FloatingLabels() {
  return (
    <g>
      {organLabels.map((o, i) => (
        <motion.g key={o.label}
          initial={{ opacity: 0, x: o.x > 50 ? 10 : -10 }}
          animate={{ opacity: [0.4, 0.9, 0.4], x: 0 }}
          transition={{ duration: 3, repeat: Infinity, delay: i * 0.8 }}
        >
          {/* Connector line */}
          <line
            x1={o.x > 50 ? o.x - 5 : o.x + 5} y1={o.y}
            x2={o.x > 50 ? o.x - 15 : o.x + 15} y2={o.y}
            stroke={o.color} strokeWidth="0.3" opacity="0.5"
          />
          <circle cx={o.x > 50 ? o.x - 5 : o.x + 5} cy={o.y} r="1" fill={o.color} opacity="0.8" />
          <text
            x={o.x} y={o.y + 1}
            fill={o.color} fontSize="3" fontFamily="monospace"
            textAnchor={o.x > 50 ? "start" : "end"}
            opacity="0.7"
          >
            {o.label}
          </text>
        </motion.g>
      ))}
    </g>
  );
}

export default function HumanBodyView({ heartRate, fingerPresent, status, painAreas = [] }: HumanBodyViewProps) {
  const isPulsing = status === 'connected' && heartRate > 0;
  const pulseDuration = heartRate > 0 ? 60 / heartRate : 1;
  const [scanY, setScanY] = useState(0);

  // Scan line animation
  useEffect(() => {
    const interval = setInterval(() => {
      setScanY(prev => (prev >= 250 ? 0 : prev + 1));
    }, 20);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-[400px] md:h-[600px] flex items-center justify-center overflow-hidden rounded-2xl"
      style={{
        background: "linear-gradient(180deg, rgba(5,8,22,0.95) 0%, rgba(7,17,31,0.98) 50%, rgba(11,19,43,0.95) 100%)",
        border: "1px solid rgba(0,229,255,0.15)",
        boxShadow: "0 0 60px rgba(0,229,255,0.08), inset 0 0 60px rgba(0,229,255,0.03)",
      }}
    >
      {/* Background medical grid */}
      <div className="absolute inset-0 opacity-[0.07]" style={{
        backgroundImage: `
          linear-gradient(rgba(0,229,255,0.6) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,229,255,0.6) 1px, transparent 1px)`,
        backgroundSize: '30px 30px'
      }} />

      {/* Radial vignette */}
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse at center, transparent 30%, rgba(5,8,22,0.8) 100%)"
      }} />

      {/* Scanning beam */}
      <motion.div
        className="absolute left-0 w-full h-[2px] pointer-events-none z-20"
        style={{
          background: "linear-gradient(to right, transparent, rgba(0,229,255,0.8), rgba(0,245,212,0.6), rgba(0,229,255,0.8), transparent)",
          boxShadow: "0 0 20px rgba(0,229,255,0.6), 0 0 60px rgba(0,229,255,0.3)",
        }}
        animate={{ top: ["0%", "100%"] }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      />

      {/* SVG Human Body */}
      <div className="relative z-10 w-full h-full flex justify-center items-center p-4">
        <svg
          viewBox="0 0 100 250"
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-auto max-h-[90%]"
          style={{ filter: "drop-shadow(0 0 15px rgba(0,229,255,0.3))" }}
        >
          <defs>
            {/* Holographic body gradient */}
            <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#00F5D4" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="bodyFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.05" />
              <stop offset="50%" stopColor="#00F5D4" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.05" />
            </linearGradient>
            {/* Heart glow */}
            <radialGradient id="heartGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FF3B5C" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#FF006E" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#FF3B5C" stopOpacity="0" />
            </radialGradient>
            {/* Neural glow filter */}
            <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="strongGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Circular scanner beneath body */}
          <motion.ellipse
            cx="50" cy="235" rx="25" ry="5"
            fill="none" stroke="#00E5FF" strokeWidth="0.5" opacity="0.4"
            animate={{ rx: [20, 30, 20], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          <motion.ellipse
            cx="50" cy="235" rx="18" ry="3"
            fill="none" stroke="#00F5D4" strokeWidth="0.3" opacity="0.3"
            animate={{ rx: [15, 22, 15], opacity: [0.1, 0.4, 0.1] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
          />

          {/* Radar scan rings around body */}
          {[60, 80, 100].map((r, i) => (
            <motion.circle
              key={`radar-${i}`}
              cx="50" cy="120" r={r * 0.4}
              fill="none" stroke="#00E5FF" strokeWidth="0.2"
              opacity="0.15"
              strokeDasharray="2 4"
              animate={{ r: [r * 0.35, r * 0.45, r * 0.35], opacity: [0.05, 0.2, 0.05] }}
              transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.8 }}
            />
          ))}

          <HolographicParticles />

          {/* ── FULL BODY OUTLINE ── */}
          <motion.g
            filter="url(#neonGlow)"
            animate={{ y: [0, -1.5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Body fill (semi-transparent) */}
            <g fill="url(#bodyFill)" stroke="url(#bodyGrad)" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round">
              {/* Head */}
              <ellipse cx="50" cy="22" rx="11" ry="13" />
              {/* Neck */}
              <rect x="45" y="34" width="10" height="6" rx="2" />
              {/* Torso */}
              <path d="M 33 40 Q 50 38 67 40 L 70 42 L 72 55 L 70 90 L 68 105 L 65 110 L 55 112 L 50 113 L 45 112 L 35 110 L 32 105 L 30 90 L 28 55 L 30 42 Z" />
              {/* Left arm */}
              <path d="M 28 44 L 22 48 L 16 65 L 12 85 L 10 100 L 8 110 L 10 112 L 12 110 L 15 98 L 18 82 L 22 68 L 26 55" />
              {/* Right arm */}
              <path d="M 72 44 L 78 48 L 84 65 L 88 85 L 90 100 L 92 110 L 90 112 L 88 110 L 85 98 L 82 82 L 78 68 L 74 55" />
              {/* Left leg */}
              <path d="M 40 112 L 38 130 L 36 155 L 35 180 L 34 200 L 33 220 L 32 232 L 30 237 L 32 240 L 38 240 L 39 237 L 38 230 L 39 215 L 40 195 L 42 170 L 44 145 L 46 125 L 48 113" />
              {/* Right leg */}
              <path d="M 60 112 L 62 130 L 64 155 L 65 180 L 66 200 L 67 220 L 68 232 L 70 237 L 68 240 L 62 240 L 61 237 L 62 230 L 61 215 L 60 195 L 58 170 L 56 145 L 54 125 L 52 113" />
            </g>

            {/* ── SKELETAL HINTS ── */}
            <g stroke="rgba(0,229,255,0.15)" strokeWidth="0.4" fill="none">
              {/* Spine */}
              <path d="M 50 35 L 50 112" strokeDasharray="1.5 2" />
              {/* Ribs */}
              {[50, 58, 66, 74, 82].map((y, i) => (
                <path key={`rib-${i}`} d={`M 35 ${y} Q 50 ${y + 4} 65 ${y}`} />
              ))}
              {/* Pelvis */}
              <path d="M 38 108 Q 50 118 62 108" />
              {/* Skull cross */}
              <ellipse cx="50" cy="20" rx="7" ry="9" />
            </g>

            {/* ── CIRCULATORY SYSTEM ── */}
            <g stroke="rgba(255,59,92,0.25)" strokeWidth="0.3" fill="none">
              {/* Aorta */}
              <motion.path
                d="M 50 60 L 50 70 L 48 85 L 45 100 L 42 112"
                strokeDasharray="2 3"
                animate={{ strokeDashoffset: [0, -20] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              />
              <motion.path
                d="M 50 60 L 50 70 L 52 85 L 55 100 L 58 112"
                strokeDasharray="2 3"
                animate={{ strokeDashoffset: [0, -20] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              />
              {/* To arms */}
              <motion.path
                d="M 48 55 L 35 60 L 22 75 L 15 95"
                strokeDasharray="2 3"
                animate={{ strokeDashoffset: [0, -15] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
              />
              <motion.path
                d="M 52 55 L 65 60 L 78 75 L 85 95"
                strokeDasharray="2 3"
                animate={{ strokeDashoffset: [0, -15] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
              />
            </g>

            {/* ── NEURAL PATHWAYS ── */}
            <g stroke="rgba(56,189,248,0.2)" strokeWidth="0.3" fill="none" filter="url(#neonGlow)">
              <motion.path
                d="M 50 22 L 50 35 L 48 50 L 50 70 L 50 90 L 50 112"
                strokeDasharray="1 3"
                animate={{ strokeDashoffset: [0, -30] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              />
              <motion.path
                d="M 50 35 L 30 50 L 15 80 L 10 105"
                strokeDasharray="1 3"
                animate={{ strokeDashoffset: [0, -25] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
              />
              <motion.path
                d="M 50 35 L 70 50 L 85 80 L 90 105"
                strokeDasharray="1 3"
                animate={{ strokeDashoffset: [0, -25] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "linear", delay: 0.3 }}
              />
              {/* Down to legs */}
              <motion.path
                d="M 50 112 L 40 140 L 36 180 L 34 220"
                strokeDasharray="1 3"
                animate={{ strokeDashoffset: [0, -30] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              />
              <motion.path
                d="M 50 112 L 60 140 L 64 180 L 66 220"
                strokeDasharray="1 3"
                animate={{ strokeDashoffset: [0, -30] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear", delay: 0.5 }}
              />
            </g>

            {/* ── BREATHING CHEST ANIMATION ── */}
            <motion.ellipse
              cx="50" cy="70" rx="16" ry="22"
              fill="none" stroke="rgba(0,229,255,0.08)" strokeWidth="0.5"
              animate={{ ry: [22, 24, 22], rx: [16, 17.5, 16] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* ── HEART (GLOWING) ── */}
            <g transform="translate(47, 58)">
              {/* Heart glow aura */}
              <motion.circle
                cx="3" cy="3" r="8"
                fill="url(#heartGlow)"
                animate={isPulsing ? { r: [6, 12, 6], opacity: [0.3, 0.6, 0.3] } : {}}
                transition={{ duration: pulseDuration, repeat: Infinity, ease: "easeInOut" }}
              />
              {/* Heart shape */}
              <motion.path
                d="M 3 0 C 1 -4 -5 -4 -5 0 C -5 4 3 10 3 10 C 3 10 11 4 11 0 C 11 -4 5 -4 3 0 Z"
                fill="rgba(255,59,92,0.85)"
                stroke="#FF006E"
                strokeWidth="0.5"
                filter="url(#strongGlow)"
                animate={isPulsing ? {
                  scale: [1, 1.25, 1],
                } : { scale: 1 }}
                transition={isPulsing ? {
                  duration: pulseDuration,
                  repeat: Infinity,
                  ease: "easeInOut"
                } : {}}
              />
              {/* Pulse ripple from heart */}
              {isPulsing && [1, 2, 3].map(i => (
                <motion.circle
                  key={`pulse-${i}`}
                  cx="3" cy="3" r="5"
                  fill="none" stroke="#FF3B5C" strokeWidth="0.3"
                  animate={{ r: [5, 25], opacity: [0.6, 0] }}
                  transition={{ duration: pulseDuration * 2, repeat: Infinity, delay: i * pulseDuration * 0.6 }}
                />
              ))}
            </g>

            {/* ── ORGAN SUBTLE HIGHLIGHTS ── */}
            {/* Brain */}
            <motion.ellipse cx="50" cy="18" rx="6" ry="5" fill="rgba(56,189,248,0.06)" stroke="rgba(56,189,248,0.15)" strokeWidth="0.3"
              animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 4, repeat: Infinity }}
            />
            {/* Lungs */}
            <motion.ellipse cx="42" cy="65" rx="6" ry="10" fill="rgba(0,229,255,0.04)" stroke="rgba(0,229,255,0.12)" strokeWidth="0.3"
              animate={{ ry: [10, 11.5, 10] }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.ellipse cx="58" cy="65" rx="6" ry="10" fill="rgba(0,229,255,0.04)" stroke="rgba(0,229,255,0.12)" strokeWidth="0.3"
              animate={{ ry: [10, 11.5, 10] }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Liver */}
            <motion.ellipse cx="57" cy="88" rx="7" ry="4" fill="rgba(0,245,212,0.04)" stroke="rgba(0,245,212,0.12)" strokeWidth="0.3"
              animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 5, repeat: Infinity }}
            />

            {/* Finger sensor indicator */}
            <g transform="translate(10, 112)">
              <circle cx="0" cy="0" r="3" fill={fingerPresent ? "rgba(0,245,212,0.7)" : "transparent"}
                stroke={fingerPresent ? "#00F5D4" : "rgba(0,229,255,0.2)"} strokeWidth="0.5" />
              {fingerPresent && (
                <motion.circle cx="0" cy="0" r="3" fill="none" stroke="#00F5D4" strokeWidth="0.5"
                  animate={{ scale: [1, 2.5], opacity: [0.8, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
            </g>

            {/* Pain area indicators */}
            {painAreas.map((area, idx) => {
              const n = area.toLowerCase();
              let c = { cx: 50, cy: 125 };
              if (n.includes('head')) c = { cx: 50, cy: 20 };
              else if (n.includes('chest') || n.includes('heart')) c = { cx: 50, cy: 65 };
              else if (n.includes('abdomen') || n.includes('stomach')) c = { cx: 50, cy: 100 };
              else if (n.includes('back')) c = { cx: 50, cy: 85 };
              else if (n.includes('left arm')) c = { cx: 18, cy: 85 };
              else if (n.includes('right arm')) c = { cx: 82, cy: 85 };
              else if (n.includes('left leg')) c = { cx: 38, cy: 180 };
              else if (n.includes('right leg')) c = { cx: 62, cy: 180 };
              else if (n.includes('joints')) c = { cx: 50, cy: 140 };

              return (
                <g key={idx} transform={`translate(${c.cx}, ${c.cy})`}>
                  <circle cx="0" cy="0" r="4" fill="rgba(255,59,92,0.3)" stroke="#FF3B5C" strokeWidth="0.5" />
                  <motion.circle cx="0" cy="0" r="4" fill="none" stroke="#FF006E" strokeWidth="0.4"
                    animate={{ scale: [1, 3], opacity: [0.8, 0] }}
                    transition={{ duration: 2, repeat: Infinity, delay: idx * 0.4 }}
                  />
                </g>
              );
            })}
          </motion.g>

          {/* Floating organ labels */}
          <FloatingLabels />
        </svg>
      </div>

      {/* Corner HUD overlays */}
      <div className="absolute top-4 left-4 z-20">
        <p className="font-mono text-[9px] tracking-[0.2em] uppercase" style={{ color: "#00E5FF", textShadow: "0 0 10px rgba(0,229,255,0.5)" }}>
          SYS_STATUS: <span className={status === 'connected' ? 'text-green-400' : 'text-yellow-400'}>{status.toUpperCase()}</span>
        </p>
        <p className="font-mono text-[8px] tracking-widest uppercase" style={{ color: "#8FB8D8" }}>
          SENSOR: {fingerPresent ? 'LOCKED' : 'STANDBY'}
        </p>
        <p className="font-mono text-[8px] tracking-widest uppercase mt-1" style={{ color: "#8FB8D8" }}>
          {heartRate > 0 ? `BPM: ${heartRate}` : 'AWAITING SIGNAL'}
        </p>
      </div>

      <div className="absolute bottom-4 right-4 z-20 text-right">
        <p className="font-mono text-[8px] tracking-widest uppercase" style={{ color: "rgba(143,184,216,0.5)" }}>
          HOLOGRAPHIC DIGITAL TWIN v3.1
        </p>
        <p className="font-mono text-[8px] tracking-widest uppercase" style={{ color: "rgba(143,184,216,0.5)" }}>
          AI_SCAN_ENGINE: ACTIVE
        </p>
      </div>

      {/* Top-right: Body rotation indicator */}
      <div className="absolute top-4 right-4 z-20">
        <motion.div
          className="w-8 h-8 rounded-full border border-cyan-500/30 flex items-center justify-center"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        >
          <div className="w-1 h-1 rounded-full bg-cyan-400" />
        </motion.div>
      </div>
    </div>
  );
}
