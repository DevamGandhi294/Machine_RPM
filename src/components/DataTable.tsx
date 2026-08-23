import { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Download,
  Layers,
  Table as TableIcon,
  PlayCircle,
  StopCircle,
  Gauge,
  Hash,
  Timer,
  CheckCircle,
  Radio,
  X,
  Activity,
  Cpu
} from "lucide-react";
import { RpmChart } from "@/components/RpmChart";
import type { SensorReading } from "@/lib/firebase";

interface DataTableProps {
  readings: SensorReading[];
}

export interface MachineSession {
  sessionId: string;
  machine_name: string;
  machine_id: string;
  device_id: string;
  session_start: string;
  session_end?: string;
  is_active: boolean;
  uptime: string;
  max_rpm: number;
  avg_rpm: number;
  max_vib_peak: number;
  avg_vib_rms: number;
  start_count: number;
  end_count: number;
  total_pulses: number;
  readings: SensorReading[];
}

export function DataTable({ readings }: DataTableProps) {
  // Tabs & View Mode State
  const [selectedMachineFilter, setSelectedMachineFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"sessions" | "readings">("sessions");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 12;

  // Modal for inspecting a specific session
  const [inspectSession, setInspectSession] = useState<MachineSession | null>(null);

  // List of unique machines detected
  const machinesList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; device_id: string; count: number }>();
    for (const r of readings) {
      const key = r.machine_id || r.device_id;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: r.machine_name || key,
          device_id: r.device_id,
          count: 0,
        });
      }
      map.get(key)!.count += 1;
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [readings]);

  // Filter readings by selected machine
  const machineFilteredReadings = useMemo(() => {
    if (selectedMachineFilter === "ALL") return readings;
    return readings.filter(
      (r) => (r.machine_id || r.device_id) === selectedMachineFilter || r.device_id === selectedMachineFilter
    );
  }, [readings, selectedMachineFilter]);

  // Group readings into Operational Sessions
  const sessions = useMemo(() => {
    const map = new Map<string, SensorReading[]>();

    for (const r of machineFilteredReadings) {
      const devKey = r.machine_id || r.device_id;
      // Unique key for session: machine_id + machine_start (or fallback to reading_time date string)
      const startKey = r.machine_start && r.machine_start !== "N/A"
        ? r.machine_start
        : (r.reading_time ? r.reading_time.split(" ")[0] : "unknown");

      const sessionKey = `${devKey}___${startKey}`;
      if (!map.has(sessionKey)) map.set(sessionKey, []);
      map.get(sessionKey)!.push(r);
    }

    const sessionList: MachineSession[] = [];

    map.forEach((items, key) => {
      if (items.length === 0) return;

      // Sort chronological (oldest first to find start, latest for end)
      const sorted = [...items].sort((a, b) => {
        const tA = new Date(a.created_at || a.reading_time).getTime();
        const tB = new Date(b.created_at || b.reading_time).getTime();
        return (isNaN(tA) ? 0 : tA) - (isNaN(tB) ? 0 : tB);
      });

      const latest = sorted[sorted.length - 1];
      const oldest = sorted[0];

      const rpms = sorted.map((r) => r.rpm);
      const maxRpm = Math.max(...rpms, 0);
      const avgRpm = Math.round(rpms.reduce((s, val) => s + val, 0) / rpms.length);

      const vibPeaks = sorted.map((r) => r.vib_peak_g ?? 0);
      const maxVibPeak = Number(Math.max(...vibPeaks, 0).toFixed(2));
      const vibRmss = sorted.map((r) => r.vib_rms_g ?? 0);
      const avgVibRms = Number((vibRmss.reduce((s, val) => s + val, 0) / vibRmss.length).toFixed(2));

      const startCount = oldest.count ?? 0;
      const endCount = latest.count ?? 0;
      const totalPulses = Math.max(endCount - startCount, 0);

      const hasEnded = Boolean(latest.machine_end && latest.machine_end !== "N/A" && latest.machine_end !== latest.machine_start);
      const isActive = !hasEnded && latest.rpm > 0;

      sessionList.push({
        sessionId: key,
        machine_name: latest.machine_name || latest.machine_id || latest.device_id,
        machine_id: latest.machine_id || latest.device_id,
        device_id: latest.device_id,
        session_start: latest.machine_start || oldest.reading_time,
        session_end: hasEnded ? latest.machine_end : undefined,
        is_active: isActive,
        uptime: latest.uptime || "0d 00:00:00",
        max_rpm: maxRpm,
        avg_rpm: avgRpm,
        max_vib_peak: maxVibPeak,
        avg_vib_rms: avgVibRms,
        start_count: startCount,
        end_count: endCount,
        total_pulses: totalPulses,
        readings: sorted.reverse(), // latest first for display inside session
      });
    });

    // Sort sessions latest start time first
    return sessionList.sort((a, b) => {
      const tA = new Date(a.session_start).getTime();
      const tB = new Date(b.session_start).getTime();
      return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
    });
  }, [machineFilteredReadings]);

  // Filter sessions by search query
  const filteredSessions = useMemo(() => {
    if (!search) return sessions;
    const q = search.toLowerCase();
    return sessions.filter(
      (s) =>
        s.machine_name.toLowerCase().includes(q) ||
        s.machine_id.toLowerCase().includes(q) ||
        s.device_id.toLowerCase().includes(q) ||
        s.session_start.toLowerCase().includes(q) ||
        (s.session_end && s.session_end.toLowerCase().includes(q))
    );
  }, [sessions, search]);

  // Filter raw readings by search query
  const filteredReadings = useMemo(() => {
    if (!search) return machineFilteredReadings;
    const q = search.toLowerCase();
    return machineFilteredReadings.filter(
      (r) =>
        r.device_id.toLowerCase().includes(q) ||
        (r.machine_name && r.machine_name.toLowerCase().includes(q)) ||
        (r.machine_id && r.machine_id.toLowerCase().includes(q)) ||
        r.reading_time.toLowerCase().includes(q) ||
        (r.uptime && r.uptime.toLowerCase().includes(q))
    );
  }, [machineFilteredReadings, search]);

  // Pagination for Session View
  const sessionPageCount = Math.ceil(filteredSessions.length / pageSize);
  const currentSessionPage = Math.min(page, Math.max(sessionPageCount - 1, 0));
  const pageSessions = filteredSessions.slice(currentSessionPage * pageSize, (currentSessionPage + 1) * pageSize);

  // Pagination for Readings View
  const readingsPageCount = Math.ceil(filteredReadings.length / pageSize);
  const currentReadingsPage = Math.min(page, Math.max(readingsPageCount - 1, 0));
  const pageReadings = filteredReadings.slice(currentReadingsPage * pageSize, (currentReadingsPage + 1) * pageSize);

  // Export CSV Handler
  const exportToCSV = () => {
    if (viewMode === "sessions") {
      if (filteredSessions.length === 0) return;
      const headers = [
        "Machine Name",
        "Machine Code",
        "IoT Device ID",
        "Session Start",
        "Session End",
        "Status",
        "Uptime / Duration",
        "Max RPM",
        "Avg RPM",
        "Max Vib Peak (g)",
        "Avg Vib RMS (g)",
        "Start Count",
        "End Count",
        "Total Readings"
      ];
      const rows = filteredSessions.map((s) => [
        `"${s.machine_name}"`,
        `"${s.machine_id}"`,
        `"${s.device_id}"`,
        `"${s.session_start}"`,
        `"${s.session_end || (s.is_active ? "In Progress" : "Completed")}"`,
        `"${s.is_active ? "Active" : "Completed"}"`,
        `"${s.uptime}"`,
        s.max_rpm,
        s.avg_rpm,
        s.max_vib_peak,
        s.avg_vib_rms,
        s.start_count,
        s.end_count,
        s.readings.length,
      ]);

      const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `machine_sessions_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      if (filteredReadings.length === 0) return;
      const headers = [
        "Machine Name",
        "Machine Code",
        "IoT Device ID",
        "RPM",
        "Vib Peak (g)",
        "Vib RMS (g)",
        "Count",
        "Uptime",
        "Machine Start",
        "Machine End",
        "Reading Time",
        "Received At"
      ];
      const rows = filteredReadings.map((r) => [
        `"${r.machine_name || r.device_id}"`,
        `"${r.machine_id || r.device_id}"`,
        `"${r.device_id}"`,
        r.rpm.toFixed(1),
        (r.vib_peak_g ?? 0).toFixed(2),
        (r.vib_rms_g ?? 0).toFixed(2),
        r.count,
        `"${r.uptime || ""}"`,
        `"${r.machine_start || ""}"`,
        `"${r.machine_end || ""}"`,
        `"${r.reading_time}"`,
        `"${new Date(r.created_at).toLocaleString()}"`,
      ]);

      const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `sensor_readings_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Device / Machine Selection Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <button
          onClick={() => {
            setSelectedMachineFilter("ALL");
            setPage(0);
          }}
          className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl transition-all whitespace-nowrap border ${
            selectedMachineFilter === "ALL"
              ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/40 ring-1 ring-cyan-500/20"
              : "bg-white/80 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          All Machines ({readings.length})
        </button>

        {machinesList.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setSelectedMachineFilter(m.id);
              setPage(0);
            }}
            className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl transition-all whitespace-nowrap border ${
              selectedMachineFilter === m.id
                ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/40 ring-1 ring-cyan-500/20"
                : "bg-white/80 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-500 dark:bg-cyan-400" />
            <span>{m.name}</span>
            <span className="text-[10px] opacity-60 font-mono">({m.count})</span>
          </button>
        ))}
      </div>

      {/* 2. Main Control Bar: View Mode Switcher (Session-wise vs Telemetry) & Search */}
      <div className="bg-white/90 dark:bg-slate-900/50 backdrop-blur rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm dark:shadow-xl transition-colors duration-200">
        {/* View Mode Toggle: Session-wise vs Raw Readings */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <button
            onClick={() => {
              setViewMode("sessions");
              setPage(0);
            }}
            className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all ${
              viewMode === "sessions"
                ? "bg-cyan-600 text-white shadow-md shadow-cyan-950"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Session-wise View ({filteredSessions.length})
          </button>

          <button
            onClick={() => {
              setViewMode("readings");
              setPage(0);
            }}
            className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all ${
              viewMode === "readings"
                ? "bg-cyan-600 text-white shadow-md shadow-cyan-950"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            All Telemetry Readings ({filteredReadings.length})
          </button>
        </div>

        {/* Search & Export Actions */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder={viewMode === "sessions" ? "Search sessions, start time..." : "Search machine, IoT ID, time..."}
              className="bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2.5 w-full border border-slate-200 dark:border-slate-800 focus:border-cyan-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
            />
          </div>

          <button
            onClick={exportToCSV}
            disabled={viewMode === "sessions" ? filteredSessions.length === 0 : filteredReadings.length === 0}
            className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2.5 rounded-xl transition-all disabled:opacity-40 shadow-sm whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* 3. Session Details Inspection Modal */}
      {inspectSession && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-3xl shadow-2xl space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Radio className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  {inspectSession.machine_name} — Session Details
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                  IoT Device ID: <span className="text-cyan-600 dark:text-cyan-400 font-bold">{inspectSession.device_id}</span> • Machine Code: <span className="text-slate-700 dark:text-slate-300">{inspectSession.machine_id}</span>
                </p>
              </div>
              <button
                onClick={() => setInspectSession(null)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Session Stat Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Uptime / Duration</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1 flex items-center gap-1">
                  <Timer className="w-3.5 h-3.5" />
                  {inspectSession.uptime}
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Peak / Avg RPM</p>
                <p className="text-sm font-bold text-cyan-600 dark:text-cyan-400 font-mono mt-1 flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5" />
                  {inspectSession.max_rpm} <span className="text-xs text-slate-400 font-normal">({inspectSession.avg_rpm} avg)</span>
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Vib Peak (g)</p>
                <p className="text-sm font-bold text-purple-600 dark:text-purple-400 font-mono mt-1 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5" />
                  {inspectSession.max_vib_peak.toFixed(2)}g
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Vib RMS (g)</p>
                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 font-mono mt-1 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5" />
                  {inspectSession.avg_vib_rms.toFixed(2)}g
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Count</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white font-mono mt-1 flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  {inspectSession.end_count}
                </p>
              </div>
            </div>

            {/* Session RPM Chart */}
            <RpmChart
              readings={inspectSession.readings}
              height={180}
              title={`${inspectSession.machine_name} — Session Telemetry Trend`}
              subtitle={`Recorded Points: ${inspectSession.readings.length}`}
            />

            {/* Session Readouts Table */}
            <div>
              <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-300 mb-2">Telemetry Readings in Session</h4>
              <div className="bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/80 dark:border-slate-800 max-h-48 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/60 sticky top-0 font-semibold">
                      <th className="px-4 py-2">Time</th>
                      <th className="px-4 py-2">RPM</th>
                      <th className="px-4 py-2">Vib Peak (g)</th>
                      <th className="px-4 py-2">Vib RMS (g)</th>
                      <th className="px-4 py-2">Count</th>
                      <th className="px-4 py-2">Uptime</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/50 font-mono">
                    {inspectSession.readings.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-900/40">
                        <td className="px-4 py-2 text-slate-800 dark:text-slate-300">{r.reading_time}</td>
                        <td className="px-4 py-2 text-cyan-600 dark:text-cyan-400 font-bold">{r.rpm.toFixed(1)}</td>
                        <td className="px-4 py-2 text-purple-600 dark:text-purple-400">{(r.vib_peak_g ?? 0).toFixed(2)}g</td>
                        <td className="px-4 py-2 text-indigo-600 dark:text-indigo-400">{(r.vib_rms_g ?? 0).toFixed(2)}g</td>
                        <td className="px-4 py-2 text-slate-800 dark:text-slate-300">{r.count}</td>
                        <td className="px-4 py-2 text-emerald-600 dark:text-emerald-400">{r.uptime || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200/80 dark:border-slate-800">
              <button
                onClick={() => setInspectSession(null)}
                className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-4 py-2 rounded-lg transition-colors font-medium border border-slate-200 dark:border-slate-700"
              >
                Close Session Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Display View: SESSION-WISE TABLE vs Granular Readings Table */}
      {viewMode === "sessions" ? (
        <div className="bg-white/90 dark:bg-slate-900/50 backdrop-blur rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm dark:shadow-xl transition-colors duration-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80">
                  <th className="px-5 py-3.5 whitespace-nowrap">Machine Name / Code</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Connected IoT Device</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Session Start</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Session End</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Status</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Uptime / Duration</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Max RPM</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Vib Peak (g)</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Vib RMS (g)</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Count</th>
                  <th className="px-5 py-3.5 whitespace-nowrap text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                {pageSessions.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-5 py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
                      <Activity className="w-8 h-8 text-slate-400 dark:text-slate-700 mx-auto mb-2" />
                      No machine sessions recorded yet for this selection.
                    </td>
                  </tr>
                ) : (
                  pageSessions.map((s) => (
                    <tr key={s.sessionId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Machine Name */}
                      <td className="px-5 py-3.5 whitespace-nowrap align-middle">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 dark:bg-cyan-400 shrink-0" />
                          <div>
                            <span className="text-slate-900 dark:text-slate-100 font-bold text-sm block leading-snug">
                              {s.machine_name}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono block font-medium">
                              {s.machine_id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Connected IoT Device */}
                      <td className="px-5 py-3.5 whitespace-nowrap align-middle">
                        <span className="inline-flex items-center text-cyan-700 dark:text-cyan-400 font-mono text-xs bg-cyan-500/10 dark:bg-cyan-950/70 border border-cyan-500/20 dark:border-cyan-800/50 px-2.5 py-1 rounded-md font-semibold">
                          IoT: {s.device_id}
                        </span>
                      </td>

                      {/* Session Start */}
                      <td className="px-5 py-3.5 whitespace-nowrap align-middle text-slate-700 dark:text-slate-200 font-mono text-xs tabular-nums font-medium">
                        <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <PlayCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          {s.session_start}
                        </span>
                      </td>

                      {/* Session End */}
                      <td className="px-5 py-3.5 whitespace-nowrap align-middle text-slate-700 dark:text-slate-200 font-mono text-xs tabular-nums font-medium">
                        {s.session_end ? (
                          <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                            <StopCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                            {s.session_end}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 font-sans italic">—</span>
                        )}
                      </td>

                      {/* Session Status */}
                      <td className="px-5 py-3.5 whitespace-nowrap align-middle">
                        {s.is_active ? (
                          <span className="text-[10px] px-2.5 py-1 rounded-full font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                            IN PROGRESS
                          </span>
                        ) : (
                          <span className="text-[10px] px-2.5 py-1 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1 w-fit">
                            <CheckCircle className="w-3 h-3 text-slate-500" />
                            COMPLETED
                          </span>
                        )}
                      </td>

                      {/* Uptime / Duration */}
                      <td className="px-5 py-3.5 whitespace-nowrap align-middle text-emerald-600 dark:text-emerald-400 font-mono text-xs font-semibold tabular-nums">
                        {s.uptime}
                      </td>

                      {/* Max RPM */}
                      <td className="px-5 py-3.5 whitespace-nowrap align-middle text-cyan-600 dark:text-cyan-400 font-bold text-sm tabular-nums font-mono">
                        {s.max_rpm} <span className="text-[10px] text-slate-500 font-normal">RPM</span>
                      </td>

                      {/* Vib Peak (g) */}
                      <td className="px-5 py-3.5 whitespace-nowrap align-middle text-purple-600 dark:text-purple-400 font-mono text-xs font-semibold tabular-nums">
                        {s.max_vib_peak.toFixed(2)}g
                      </td>

                      {/* Vib RMS (g) */}
                      <td className="px-5 py-3.5 whitespace-nowrap align-middle text-indigo-600 dark:text-indigo-400 font-mono text-xs font-semibold tabular-nums">
                        {s.avg_vib_rms.toFixed(2)}g
                      </td>

                      {/* Count */}
                      <td className="px-5 py-3.5 whitespace-nowrap align-middle text-slate-700 dark:text-slate-300 font-mono text-xs tabular-nums font-medium">
                        {s.end_count}
                      </td>

                      {/* Inspect Action */}
                      <td className="px-5 py-3.5 whitespace-nowrap align-middle text-right">
                        <button
                          onClick={() => setInspectSession(s)}
                          className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-cyan-700 dark:text-cyan-400 font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-sm"
                        >
                          Inspect Session
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Session Pagination */}
          {sessionPageCount > 1 && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Page {currentSessionPage + 1} of {sessionPageCount} — {filteredSessions.length} total sessions
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(currentSessionPage - 1, 0))}
                  disabled={currentSessionPage === 0}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(Math.min(currentSessionPage + 1, sessionPageCount - 1))}
                  disabled={currentSessionPage >= sessionPageCount - 1}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* READINGS TABLE VIEW */
        <div className="bg-white/90 dark:bg-slate-900/50 backdrop-blur rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm dark:shadow-xl transition-colors duration-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80">
                  <th className="px-5 py-3.5 whitespace-nowrap">Machine Name / Code</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Connected IoT Device</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">RPM</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Vib Peak (g)</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Vib RMS (g)</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Count</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Uptime</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Machine Start</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Machine End</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                {pageReadings.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
                      No telemetry readings found matching search criteria.
                    </td>
                  </tr>
                ) : (
                  pageReadings.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap align-middle">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2 h-2 rounded-full bg-cyan-500 shrink-0" />
                          <div>
                            <span className="text-slate-900 dark:text-slate-100 font-semibold text-sm block leading-snug">
                              {r.machine_name || r.device_id}
                            </span>
                            {r.machine_id && r.machine_id !== r.machine_name && (
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono block">
                                {r.machine_id}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap align-middle">
                        <span className="inline-flex items-center text-cyan-700 dark:text-cyan-400 font-mono text-xs bg-cyan-500/10 dark:bg-cyan-950/70 border border-cyan-500/20 dark:border-cyan-800/50 px-2.5 py-1 rounded-md font-semibold">
                          IoT: {r.device_id}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap align-middle">
                        <span className="text-cyan-600 dark:text-cyan-400 font-bold text-sm tabular-nums font-mono">
                          {r.rpm.toFixed(1)}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap align-middle text-purple-600 dark:text-purple-400 font-mono text-xs font-semibold tabular-nums">
                        {(r.vib_peak_g ?? 0).toFixed(2)}g
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap align-middle text-indigo-600 dark:text-indigo-400 font-mono text-xs font-semibold tabular-nums">
                        {(r.vib_rms_g ?? 0).toFixed(2)}g
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap align-middle text-slate-700 dark:text-slate-300 font-mono text-xs tabular-nums font-medium">
                        {r.count}
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap align-middle text-emerald-600 dark:text-emerald-400 font-mono text-xs font-semibold tabular-nums">
                        {r.uptime || "—"}
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap align-middle text-slate-700 dark:text-slate-300 font-mono text-xs tabular-nums font-medium">
                        {r.machine_start || "—"}
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap align-middle text-slate-700 dark:text-slate-300 font-mono text-xs tabular-nums font-medium">
                        {r.machine_end || "—"}
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap align-middle text-slate-500 dark:text-slate-400 font-mono text-xs tabular-nums">
                        {r.reading_time}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Readings Pagination */}
          {readingsPageCount > 1 && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Page {currentReadingsPage + 1} of {readingsPageCount} — {filteredReadings.length} total records
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(currentReadingsPage - 1, 0))}
                  disabled={currentReadingsPage === 0}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(Math.min(currentReadingsPage + 1, readingsPageCount - 1))}
                  disabled={currentReadingsPage >= readingsPageCount - 1}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
