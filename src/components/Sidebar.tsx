import { Gauge, Activity, Table, Radio, Settings } from "lucide-react";

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  deviceCount: number;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Gauge },
  { id: "live", label: "Live Monitor", icon: Radio },
  { id: "devices", label: "Devices", icon: Activity },
  { id: "data", label: "Data Table", icon: Table },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({ activeView, onNavigate, deviceCount }: SidebarProps) {
  return (
    <aside className="w-64 bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-300 hidden md:flex flex-col h-screen sticky top-0 shrink-0 border-r border-slate-200 dark:border-slate-800 transition-colors duration-200 shadow-sm dark:shadow-none">
      {/* Brand Header */}
      <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-600 dark:bg-gradient-to-br dark:from-cyan-500 dark:to-blue-600 text-white flex items-center justify-center shadow-md shadow-cyan-600/20">
            <Gauge className="w-5.5 h-5.5 text-white" />
          </div>
          <div>
            <h1 className="text-slate-900 dark:text-white font-bold text-base leading-none tracking-tight">RPM MONITOR</h1>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1">Industrial IoT Web App</p>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-4 py-5 space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                active
                  ? "bg-cyan-600 text-white dark:bg-cyan-500/15 dark:text-cyan-400 dark:border dark:border-cyan-500/30 shadow-md shadow-cyan-600/20"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 font-semibold"
              }`}
            >
              <Icon className={`w-4.5 h-4.5 shrink-0 ${active ? "text-white dark:text-cyan-400" : "text-slate-400 dark:text-slate-500"}`} />
              <span>{item.label}</span>
              {item.id === "devices" && deviceCount > 0 && (
                <span className={`ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                  active ? "bg-white text-cyan-800 dark:bg-cyan-400 dark:text-slate-950" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                }`}>
                  {deviceCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* System Status Footer */}
      <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
        <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50" />
          <span>System Online</span>
        </div>
      </div>
    </aside>
  );
}
