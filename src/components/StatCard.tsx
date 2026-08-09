import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  trend?: string;
  color: "cyan" | "emerald" | "amber" | "blue" | "rose";
}

const colorMap = {
  cyan: { bg: "bg-cyan-500/10", text: "text-cyan-400", ring: "ring-cyan-500/20", glow: "shadow-cyan-500/10" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", ring: "ring-emerald-500/20", glow: "shadow-emerald-500/10" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-400", ring: "ring-amber-500/20", glow: "shadow-amber-500/10" },
  blue: { bg: "bg-blue-500/10", text: "text-blue-400", ring: "ring-blue-500/20", glow: "shadow-blue-500/10" },
  rose: { bg: "bg-rose-500/10", text: "text-rose-400", ring: "ring-rose-500/20", glow: "shadow-rose-500/10" },
};

export function StatCard({ label, value, unit, icon: Icon, trend, color }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className="bg-slate-900/50 backdrop-blur rounded-xl p-5 border border-slate-800 hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg ${c.bg} ${c.text} flex items-center justify-center ring-1 ${c.ring}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className="text-xs text-slate-500">{trend}</span>
        )}
      </div>
      <p className="text-2xl font-bold text-white tabular-nums">
        {value}
        {unit && <span className="text-sm font-normal text-slate-500 ml-1">{unit}</span>}
      </p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}
