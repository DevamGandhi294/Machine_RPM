import { Gauge, Radio, Cpu, Table, Settings } from "lucide-react";

interface BottomNavProps {
  activeView: string;
  onNavigate: (view: string) => void;
  deviceCount: number;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Gauge },
  { id: "live", label: "Live", icon: Radio },
  { id: "devices", label: "Devices", icon: Cpu },
  { id: "data", label: "Data", icon: Table },
  { id: "settings", label: "Settings", icon: Settings },
];

export function BottomNav({ activeView, onNavigate, deviceCount }: BottomNavProps) {
  return (
    <nav aria-label="Mobile Bottom Navigation" className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 px-2 py-1.5 shadow-2xl transition-colors duration-200">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                active
                  ? "text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 font-semibold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${active ? "scale-110" : ""}`} />
                {item.id === "devices" && deviceCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 text-[9px] font-bold bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 px-1.5 py-0.2 rounded-full font-mono shadow-sm">
                    {deviceCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight leading-none font-medium">{item.label}</span>
              {active && (
                <span className="w-1 h-1 rounded-full bg-cyan-600 dark:bg-cyan-400 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
