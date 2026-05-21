import { getStressColor, getStressLevel, type StressLevel } from "@/lib/stress";

interface StressGaugeProps {
  score: number;
}

export default function StressGauge({ score }: StressGaugeProps) {
  const level = getStressLevel(score);
  const color = getStressColor(level);
  const angle = (score / 100) * 180;

  const r = 80;
  const cx = 100;
  const cy = 95;

  const startX = cx - r;
  const startY = cy;

  const endAngleRad = (Math.PI * (180 - angle)) / 180;
  const endX = cx + r * Math.cos(endAngleRad);
  const endY = cy - r * Math.sin(endAngleRad);

  const largeArc = angle > 180 ? 1 : 0;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 120" className="w-48 h-28">
        {/* Background arc */}
        <path
          d={`M ${startX} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Score arc */}
        {score > 0 && (
          <path
            d={`M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
          />
        )}
        <text x={cx} y={cy - 10} textAnchor="middle" className="text-3xl font-bold fill-foreground" style={{ fontSize: 32, fontWeight: '800' }}>
          {score}
        </text>
        <text x={cx} y={cy + 5} textAnchor="middle" className="fill-muted-foreground/80 font-bold" style={{ fontSize: 10, letterSpacing: '0.05em' }}>
          / 100
        </text>
        <text x={cx} y={cy + 18} textAnchor="middle" className="fill-muted-foreground font-bold tracking-tighter" style={{ fontSize: 8 }}>
          SEVERITY
        </text>
      </svg>
      <span className="mt-2 text-sm font-bold" style={{ color }}>{level} Stress</span>
    </div>
  );
}
