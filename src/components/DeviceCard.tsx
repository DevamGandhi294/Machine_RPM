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
  const trendColor = diff > 0.5 ? "text-emerald-600 dark:text-emerald-400" : diff < -0.5 ? "text-rose-600 dark:text-rose-400" : "text-slate-400";
  const TrendIcon = trendIcon;

  const avgRpm = readings.length > 0
    ? readings.reduce((s, r) => s + r.rpm, 0) / readings.length
    : 0;
  const maxRpm = readings.length > 0 ? Math.max(...readings.map((r) => r.rpm)) : 0;

  return (
    <button
      onClick={onSelect}
      className={`text-left bg-white/90 dark:bg-slate-900/50 backdrop-blur rounded-xl p-5 border transition-all shadow-sm dark:shadow-none ${
        isSelected
          ? "border-cyan-500/50 ring-1 ring-cyan-500/30"
          : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center ring-1 ring-cyan-500/20">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-slate-900 dark:text-white font-semibold text-sm">
              {latest?.machine_name || deviceId}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono font-medium">IoT: {latest?.device_id || deviceId}</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{readings.length} readings</span>
            </div>
          </div>
        </div>
        <div className={`flex items-center gap-1 text-xs font-semibold ${trendColor}`}>
          <TrendIcon className="w-3 h-3" />
          <span className="tabular-nums">{Math.abs(diff).toFixed(1)}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Current</p>
          <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">{currentRpm.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Average</p>
          <p className="text-lg font-bold text-slate-700 dark:text-slate-300 tabular-nums">{avgRpm.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Peak</p>
          <p className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">{maxRpm.toFixed(0)}</p>
        </div>
      </div>

      {latest && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-3 border-t border-slate-100 dark:border-slate-800 pt-2 font-mono">
          Last: {latest.reading_time}
        </p>
      )}
    </button>
  );
}
