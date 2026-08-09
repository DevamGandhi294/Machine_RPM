import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Search, Download } from "lucide-react";
import type { SensorReading } from "@/lib/firebase";

interface DataTableProps {
  readings: SensorReading[];
}

export function DataTable({ readings }: DataTableProps) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const pageSize = 15;

  const filtered = useMemo(() => {
    if (!search) return readings;
    const q = search.toLowerCase();
    return readings.filter(
      (r) =>
        r.device_id.toLowerCase().includes(q) ||
        r.reading_time.toLowerCase().includes(q) ||
        (r.uptime && r.uptime.toLowerCase().includes(q))
    );
  }, [readings, search]);

  const pageCount = Math.ceil(filtered.length / pageSize);
  const currentPage = Math.min(page, Math.max(pageCount - 1, 0));
  const pageData = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const exportToCSV = () => {
    if (!filtered || filtered.length === 0) return;

    const headers = ["Device ID", "RPM", "Count", "Uptime", "Machine Start", "Machine End", "Reading Time", "Received At"];
    const rows = filtered.map((r) => [
      `"${r.device_id}"`,
      r.rpm.toFixed(1),
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
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur rounded-xl border border-slate-800 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-white">All Telemetry Readings</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-medium">
            {filtered.length} records
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3.5 py-2 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            title="Download CSV report"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>

          <div className="relative flex-1 sm:w-60">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search device or time..."
              className="bg-slate-800 text-slate-200 text-sm rounded-lg pl-9 pr-3 py-2 w-full border border-slate-700 focus:border-cyan-500 focus:outline-none placeholder:text-slate-600"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800">
              <th className="px-5 py-3 font-medium">Device Collection</th>
              <th className="px-5 py-3 font-medium">RPM</th>
              <th className="px-5 py-3 font-medium">Count</th>
              <th className="px-5 py-3 font-medium">Uptime</th>
              <th className="px-5 py-3 font-medium">Machine Start</th>
              <th className="px-5 py-3 font-medium">Machine End</th>
              <th className="px-5 py-3 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-600">
                  No readings found
                </td>
              </tr>
            ) : (
              pageData.map((r) => (
                <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-500" />
                      <span className="text-slate-200 font-semibold">{r.device_id}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3 text-cyan-400 font-semibold tabular-nums">{r.rpm.toFixed(1)}</td>
                  <td className="px-5 py-3 text-slate-400 tabular-nums">{r.count}</td>
                  <td className="px-5 py-3 text-emerald-400 font-mono text-xs">{r.uptime || "—"}</td>
                  <td className="px-5 py-3 text-slate-400 font-mono text-xs">{r.machine_start || "—"}</td>
                  <td className="px-5 py-3 text-slate-400 font-mono text-xs">{r.machine_end || "—"}</td>
                  <td className="px-5 py-3 text-slate-400 font-mono text-xs">{r.reading_time}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800">
          <span className="text-xs text-slate-500">
            Page {currentPage + 1} of {pageCount} — {filtered.length} readings total
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(currentPage - 1, 0))}
              disabled={currentPage === 0}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(Math.min(currentPage + 1, pageCount - 1))}
              disabled={currentPage >= pageCount - 1}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
