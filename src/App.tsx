import { useState, useMemo } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { DashboardView } from "@/components/views/DashboardView";
import { LiveView } from "@/components/views/LiveView";
import { DevicesView } from "@/components/views/DevicesView";
import { DataTableView } from "@/components/views/DataTableView";
import { SettingsView } from "@/components/views/SettingsView";
import { useSensorData } from "@/hooks/useSensorData";

function App() {
  const [activeView, setActiveView] = useState("dashboard");
  const { readings, loading, error, lastUpdated, refetch } = useSensorData(10000);

  const deviceCount = useMemo(() => {
    return new Set(readings.map((r) => r.device_id)).size;
  }, [readings]);

  const renderView = () => {
    switch (activeView) {
      case "dashboard":
        return <DashboardView readings={readings} lastUpdated={lastUpdated} />;
      case "live":
        return <LiveView readings={readings} />;
      case "devices":
        return <DevicesView readings={readings} />;
      case "data":
        return <DataTableView readings={readings} />;
      case "settings":
        return <SettingsView />;
      default:
        return <DashboardView readings={readings} lastUpdated={lastUpdated} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex">
      <Sidebar activeView={activeView} onNavigate={setActiveView} deviceCount={deviceCount} />

      <main className="flex-1 min-w-0 overflow-x-hidden">
        <header className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur border-b border-slate-800 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {loading ? (
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Syncing...
              </span>
            ) : error ? (
              <span className="flex items-center gap-1.5 text-rose-400">
                <AlertCircle className="w-3 h-3" />
                {error}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Stream
              </span>
            )}
          </div>
          <button
            onClick={refetch}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </header>

        <div className="p-6">
          {renderView()}
        </div>
      </main>
    </div>
  );
}

export default App;
