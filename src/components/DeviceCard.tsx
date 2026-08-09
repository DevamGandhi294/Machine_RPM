import { Gauge, ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { SensorReading } from "@/lib/firebase";

interface DeviceCardProps {
  deviceId: string;
  readings: SensorReading[];
  onSelect: () => void;
  isSelected: boolean;
}

export function DeviceCard({ deviceId, readings, onSelect, isSelected }: DeviceCardProps) {
  const latest = readings[0];
  const previous = readings[1];
  const currentRpm = latest?.rpm ?? 0;
  const prevRpm = previous?.rpm ?? 0;
  const diff = currentRpm - prevRpm;
  const trendIcon = diff > 0.5 ? ArrowUp : diff < -0.5 ? ArrowDown : Minus;
  const trendColor = diff > 0.5 ? "text-emerald-400" : diff < -0.5 ? "text-rose-400" : "text-slate-500";
  const TrendIcon = trendIcon;

  const avgRpm = readings.length > 0
    ? readings.reduce((s, r) => s + r.rpm, 0) / readings.length
    : 0;
  const maxRpm = readings.length > 0 ? Math.max(...readings.map((r) => r.rpm)) : 0;

  return (
    <button
      onClick={onSelect}
      className={`text-left bg-slate-900/50 backdrop-blur rounded-xl p-5 border transition-all ${
        isSelected
          ? "border-cyan-500/40 ring-1 ring-cyan-500/20"
          : "border-slate-800 hover:border-slate-700"
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center ring-1 ring-cyan-500/20">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">{deviceId}</h3>
            <p className="text-xs text-slate-500">{readings.length} readings</p>
          </div>
        </div>
        <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
          <TrendIcon className="w-3 h-3" />
          <span className="tabular-nums">{Math.abs(diff).toFixed(1)}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-slate-500">Current</p>
          <p className="text-lg font-bold text-white tabular-nums">{currentRpm.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Average</p>
          <p className="text-lg font-bold text-slate-300 tabular-nums">{avgRpm.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Peak</p>
          <p className="text-lg font-bold text-amber-400 tabular-nums">{maxRpm.toFixed(0)}</p>
        </div>
      </div>

      {latest && (
        <p className="text-xs text-slate-600 mt-3 border-t border-slate-800 pt-2">
          Last: {latest.reading_time}
        </p>
      )}
    </button>
  );
}
