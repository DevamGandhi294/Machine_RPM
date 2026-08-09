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
    <aside className="w-60 bg-slate-900 text-slate-300 flex flex-col h-screen sticky top-0 shrink-0">
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Gauge className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-sm leading-tight">RPM Monitor</h1>
            <p className="text-xs text-slate-500">Admin Panel</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
              {item.id === "devices" && deviceCount > 0 && (
                <span className="ml-auto text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                  {deviceCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>System Active</span>
        </div>
      </div>
    </aside>
  );
}
