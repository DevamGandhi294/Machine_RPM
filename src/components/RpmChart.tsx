import { useMemo } from "react";
import type { SensorReading } from "@/lib/firebase";

interface RpmChartProps {
  readings: SensorReading[];
  height?: number;
}

export function RpmChart({ readings, height = 200 }: RpmChartProps) {
  const chartData = useMemo(() => {
    const sorted = [...readings].reverse();
    return sorted.slice(-60);
  }, [readings]);

  const { points, maxRpm, minRpm } = useMemo(() => {
    if (chartData.length === 0) return { points: [], maxRpm: 0, minRpm: 0 };
    const rpms = chartData.map((r) => r.rpm);
    const max = Math.max(...rpms, 1);
    const min = Math.min(...rpms, 0);
    const range = max - min || 1;
    const w = 100;
    const h = 100;
    const pts = chartData.map((r, i) => {
      const x = (i / Math.max(chartData.length - 1, 1)) * w;
      const y = h - ((r.rpm - min) / range) * h;
      return { x, y, rpm: r.rpm };
    });
    return { points: pts, maxRpm: max, minRpm: min };
  }, [chartData]);

  const pathD = useMemo(() => {
    if (points.length === 0) return "";
    return points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(" ");
  }, [points]);

  const areaD = useMemo(() => {
    if (points.length === 0) return "";
    return `${pathD} L 100 100 L 0 100 Z`;
  }, [pathD, points]);

  return (
    <div className="bg-slate-900/50 backdrop-blur rounded-xl p-5 border border-slate-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">RPM Trend</h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-500">Max: <span className="text-rose-400 font-medium tabular-nums">{maxRpm.toFixed(0)}</span></span>
          <span className="text-slate-500">Min: <span className="text-cyan-400 font-medium tabular-nums">{minRpm.toFixed(0)}</span></span>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex items-center justify-center text-slate-600 text-sm" style={{ height }}>
          No data yet
        </div>
      ) : (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ height, width: "100%" }}
          className="overflow-visible"
        >
          <defs>
            <linearGradient id="rpmGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0, 25, 50, 75, 100].map((y) => (
            <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#1e293b" strokeWidth="0.3" />
          ))}

          <path d={areaD} fill="url(#rpmGradient)" />
          <path d={pathD} fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
    </div>
  );
}
