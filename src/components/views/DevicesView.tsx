import { useMemo, useState } from "react";
import { Activity, Plus, Download, Radio, Clock, ToggleLeft, ToggleRight, CheckCircle, XCircle, Power, Cpu } from "lucide-react";
import { RpmChart } from "@/components/RpmChart";
import { useDevices, updateDeviceConfigInFirestore } from "@/hooks/useSensorData";
import type { SensorReading, DeviceConfig } from "@/lib/firebase";

interface DevicesViewProps {
  readings: SensorReading[];
}

export function DevicesView({ readings }: DevicesViewProps) {
  const { devices: firestoreDevices } = useDevices();
  const [newMachineId, setNewMachineId] = useState("");

  const devicesMap = useMemo(() => {
    const map = new Map<string, SensorReading[]>();
    for (const r of readings) {
      if (!map.has(r.device_id)) map.set(r.device_id, []);
      const arr = map.get(r.device_id)!;
      if (arr.length < 100) arr.push(r);
    }
    return map;
  }, [readings]);

  const activeDeviceIds = useMemo(() => {
    const set = new Set<string>();
    Array.from(devicesMap.keys()).forEach((id) => set.add(id));
    firestoreDevices.forEach((d) => set.add(d.machine_id));
    return Array.from(set).sort();
  }, [devicesMap, firestoreDevices]);

  const [selected, setSelected] = useState<string | null>(activeDeviceIds[0] ?? null);

  const getDeviceConfig = (machineId: string): DeviceConfig => {
    const found = firestoreDevices.find((d) => d.machine_id === machineId);
    const devReadings = devicesMap.get(machineId) ?? [];
    const latest = devReadings[0];
    const isRunning = latest && latest.rpm > 0;

    return found || {
      machine_id: machineId,
      is_storing: true,
      frequency_seconds: 5,
      is_online: true,
      machine_status: isRunning ? "running" : "idle",
    };
  };

  const handleAddMachine = async () => {
    const id = newMachineId.trim();
    if (!id) return;
    await updateDeviceConfigInFirestore(id, {
      is_storing: true,
      frequency_seconds: 5,
      is_online: true,
      machine_status: "idle",
    });
    setNewMachineId("");
    setSelected(id);
  };

  const handleToggleStoring = async (machineId: string, current: boolean) => {
    await updateDeviceConfigInFirestore(machineId, {
      is_storing: !current,
    });
  };

  const handleFrequencyChange = async (machineId: string, seconds: number) => {
    await updateDeviceConfigInFirestore(machineId, {
      frequency_seconds: seconds,
    });
  };

  const exportDeviceCSV = (machineId: string) => {
    const devReadings = devicesMap.get(machineId) ?? [];
    if (devReadings.length === 0) return;

    const headers = ["Machine ID", "RPM", "Count", "Uptime", "Machine Start", "Machine End", "Reading Time", "Received At"];
    const rows = devReadings.map((r) => [
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
    link.setAttribute("download", `${machineId}_sensordata_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            Device Manager (Firestore Collection: "devices")
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure machine storage ON/OFF, sync frequency, online status, and view historical subcollections
          </p>
        </div>

        {/* Machine ID Input Field */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newMachineId}
            onChange={(e) => setNewMachineId(e.target.value)}
            placeholder="New Machine ID (e.g. RPM2)"
            className="bg-slate-900 text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-700 focus:border-cyan-500 focus:outline-none w-48 placeholder:text-slate-600 font-mono"
          />
          <button
            onClick={handleAddMachine}
            className="flex items-center gap-1.5 text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-medium px-3.5 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Machine
          </button>
        </div>
      </div>

      {activeDeviceIds.length === 0 ? (
        <div className="bg-slate-900/50 backdrop-blur rounded-xl p-10 border border-slate-800 text-center">
          <Activity className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No devices registered in Firestore collection "devices". Enter a Machine ID above.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeDeviceIds.map((machineId) => {
              const config = getDeviceConfig(machineId);
              const devReadings = devicesMap.get(machineId) ?? [];
              const latest = devReadings[0];
              const isSelected = selected === machineId;

              return (
                <div
                  key={machineId}
                  className={`bg-slate-900/50 backdrop-blur rounded-xl p-5 border transition-all ${
                    isSelected ? "border-cyan-500/50 ring-1 ring-cyan-500/30" : "border-slate-800"
                  }`}
                >
                  {/* Top Bar: Machine ID & Status Badges */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold text-xs border border-cyan-500/20 font-mono">
                        {machineId.slice(0, 3)}
                      </div>
                      <div>
                        <h3 className="text-white font-bold text-sm font-mono">{machineId}</h3>
                        <span className="text-[10px] text-slate-500 block">
                          subcollection: <span className="text-slate-400 font-mono">sensordata ({devReadings.length}/100)</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {/* Online / Offline Status */}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${config.is_online ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-slate-800 text-slate-500"}`}>
                        {config.is_online ? <CheckCircle className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                        {config.is_online ? "ONLINE" : "OFFLINE"}
                      </span>

                      {/* Machine Status (Running / Idle) */}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${latest && latest.rpm > 0 ? "bg-cyan-500/10 text-cyan-400" : "bg-amber-500/10 text-amber-400"}`}>
                        {latest && latest.rpm > 0 ? "RUNNING" : "IDLE"}
                      </span>
                    </div>
                  </div>

                  {/* Telemetry Snapshot */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800/80 mb-4 text-center">
                    <div>
                      <p className="text-[10px] text-slate-500">RPM</p>
                      <p className="text-lg font-bold text-cyan-400 tabular-nums">{latest?.rpm.toFixed(0) ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">Count</p>
                      <p className="text-lg font-bold text-white tabular-nums">{latest?.count ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">Uptime</p>
                      <p className="text-xs font-semibold text-emerald-400 font-mono mt-1 truncate">{latest?.uptime || "—"}</p>
                    </div>
                  </div>

                  {/* Config Controls: Store ON/OFF & Frequency */}
                  <div className="space-y-3 pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 flex items-center gap-1.5">
                        <Power className="w-3.5 h-3.5 text-cyan-400" />
                        Store Data (ON/OFF)
                      </span>
                      <button
                        onClick={() => handleToggleStoring(machineId, config.is_storing)}
                        className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                          config.is_storing
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {config.is_storing ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4 text-rose-400" />}
                        {config.is_storing ? "ON" : "OFF"}
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-cyan-400" />
                        Sync Frequency
                      </span>
                      <select
                        value={config.frequency_seconds}
                        onChange={(e) => handleFrequencyChange(machineId, Number(e.target.value))}
                        className="bg-slate-950 text-slate-200 text-xs rounded px-2 py-1 border border-slate-700 focus:border-cyan-500 focus:outline-none"
                      >
                        <option value={1}>Every 1s</option>
                        <option value={2}>Every 2s</option>
                        <option value={5}>Every 5s</option>
                        <option value={10}>Every 10s</option>
                        <option value={30}>Every 30s</option>
                        <option value={60}>Every 60s</option>
                      </select>
                    </div>
                  </div>

                  {/* Actions: View Chart & Export CSV */}
                  <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-800/80">
                    <button
                      onClick={() => setSelected(isSelected ? null : machineId)}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
                    >
                      {isSelected ? "Hide Chart" : "View RPM Chart"}
                    </button>

                    <button
                      onClick={() => exportDeviceCSV(machineId)}
                      disabled={devReadings.length === 0}
                      className="flex items-center gap-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded transition-colors disabled:opacity-30"
                    >
                      <Download className="w-3 h-3 text-emerald-400" />
                      Export CSV
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Device RPM Chart */}
          {selected && (
            <div className="mt-6 bg-slate-900/50 backdrop-blur rounded-xl p-5 border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-cyan-400" />
                  {selected} — Historical Trend (Subcollection: "sensordata" max 100 elements)
                </h3>
                <button
                  onClick={() => exportDeviceCSV(selected)}
                  className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export {selected} CSV
                </button>
              </div>
              <RpmChart readings={devicesMap.get(selected) ?? []} height={260} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
