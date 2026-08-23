import { useState, useMemo } from "react";
import { RefreshCw, AlertCircle, Gauge } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { DashboardView } from "@/components/views/DashboardView";
import { LiveView } from "@/components/views/LiveView";
import { DevicesView } from "@/components/views/DevicesView";
import { DataTableView } from "@/components/views/DataTableView";
import { SettingsView } from "@/components/views/SettingsView";
import { useSensorData } from "@/hooks/useSensorData";

function AppContent() {
  const [activeView, setActiveView] = useState("dashboard");
  const { theme } = useTheme();
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
    <div className={`min-h-screen flex transition-colors duration-200 ${
      theme === "dark" ? "dark bg-slate-950 text-slate-200" : "bg-slate-100 text-slate-900"
    }`}>
      {/* Desktop Sidebar (Hidden on Mobile) */}
      <Sidebar activeView={activeView} onNavigate={setActiveView} deviceCount={deviceCount} />

      {/* Main App Workspace */}
      <main className="flex-1 min-w-0 flex flex-col min-h-screen overflow-x-hidden">
        {/* Sticky App Header */}
        <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-4 sm:px-6 py-3 flex items-center justify-between transition-colors duration-200 shadow-sm dark:shadow-none">
          {/* Mobile App Branding Title (Hidden on Desktop) */}
          <div className="flex items-center gap-2.5 md:hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20">
              <Gauge className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-slate-900 dark:text-white font-bold text-xs leading-tight">RPM Monitor</h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Live IoT Web App</p>
            </div>
          </div>

          {/* Sync Status Badge */}
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            {loading ? (
              <span className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400 font-medium">
                <RefreshCw className="w-3 h-3 animate-spin text-cyan-600 dark:text-cyan-400" />
                Syncing...
              </span>
            ) : error ? (
              <span className="flex items-center gap-1.5 text-rose-500 dark:text-rose-400">
                <AlertCircle className="w-3 h-3" />
                {error}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="hidden sm:inline">Live Stream</span>
              </span>
            )}
          </div>

          {/* Actions: Refresh Button & Theme Toggle Switch */}
          <div className="flex items-center gap-2">
            <ThemeToggle />

            <button
              onClick={refetch}
              className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800 px-3 py-1.5 rounded-xl transition-all shadow-sm active:scale-95 font-medium"
            >
              <RefreshCw className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </header>

        {/* View Content Container with Bottom Padding for Mobile Nav */}
        <div className="flex-1 p-4 sm:p-6 pb-24 md:pb-6 max-w-7xl w-full mx-auto">
          {renderView()}
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar with Icons (Shown on Mobile) */}
      <BottomNav activeView={activeView} onNavigate={setActiveView} deviceCount={deviceCount} />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
