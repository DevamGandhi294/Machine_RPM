import { useMemo, useState } from "react";
import {
  Activity,
  Plus,
  Download,
  Radio,
  Clock,
  ToggleLeft,
  ToggleRight,
  CheckCircle,
  XCircle,
  Power,
  Cpu,
  Edit3,
  Trash2,
  MapPin,
  X,
  Link as LinkIcon,
  HardDrive
} from "lucide-react";
import { RpmChart } from "@/components/RpmChart";
import { useDevices, updateDeviceConfigInFirestore, deleteDeviceFromFirestore } from "@/hooks/useSensorData";
import type { SensorReading, DeviceConfig } from "@/lib/firebase";

interface DevicesViewProps {
  readings: SensorReading[];
}

export function DevicesView({ readings }: DevicesViewProps) {
  const { devices: firestoreDevices } = useDevices();

  // Modal / Form State for Add or Edit Machine
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMachineId, setEditingMachineId] = useState<string | null>(null);

  // Form Fields
  const [formMachineId, setFormMachineId] = useState("");
  const [formMachineName, setFormMachineName] = useState("");
  const [formDeviceId, setFormDeviceId] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formIsStoring, setFormIsStoring] = useState(true);
  const [formFrequencySeconds, setFormFrequencySeconds] = useState(5);

  // Map readings by hardware device_id or machine_id
  const devicesMap = useMemo(() => {
    const map = new Map<string, SensorReading[]>();
    for (const r of readings) {
      const key = r.machine_id || r.device_id;
      if (!map.has(key)) map.set(key, []);
      const arr = map.get(key)!;
      if (arr.length < 100) arr.push(r);

      // Also map by device_id if different
      if (r.device_id && r.device_id !== key) {
        if (!map.has(r.device_id)) map.set(r.device_id, []);
        const devArr = map.get(r.device_id)!;
        if (devArr.length < 100) devArr.push(r);
      }
    }
    return map;
  }, [readings]);

  // Detected raw IoT Hardware IDs from RTDB/Firestore live readings
  const detectedIotDeviceIds = useMemo(() => {
    const set = new Set<string>();
    for (const r of readings) {
      if (r.device_id) set.add(r.device_id);
    }
    // Add common defaults if empty
    if (set.size === 0) {
      set.add("RPM1");
      set.add("rpm_meter");
      set.add("RPM2");
    }
    return Array.from(set).sort();
  }, [readings]);

  // All Machine IDs (from Firestore + fallback active telemetry)
  const activeMachineIds = useMemo(() => {
    const set = new Set<string>();
    firestoreDevices.forEach((d) => set.add(d.machine_id));
    Array.from(devicesMap.keys()).forEach((id) => set.add(id));
    return Array.from(set).sort();
  }, [devicesMap, firestoreDevices]);

  const [selected, setSelected] = useState<string | null>(activeMachineIds[0] ?? null);

  const getDeviceConfig = (machineId: string): DeviceConfig => {
    const found = firestoreDevices.find((d) => d.machine_id === machineId);
    const devReadings = devicesMap.get(machineId) ?? [];
    const latest = devReadings[0];
    const isRunning = latest && latest.rpm > 0;

    return (
      found || {
        machine_id: machineId,
        machine_name: machineId,
        device_id: machineId,
        location: "Main Floor",
        is_storing: true,
        frequency_seconds: 5,
        is_online: true,
        machine_status: isRunning ? "running" : "idle",
      }
    );
  };

  const openAddModal = () => {
    setEditingMachineId(null);
    const nextId = `MCH-00${firestoreDevices.length + 1}`;
    setFormMachineId(nextId);
    setFormMachineName(`CNC Lathe Machine #${firestoreDevices.length + 1}`);
    setFormDeviceId(detectedIotDeviceIds[0] || "RPM1");
    setFormLocation("Shop Floor A");
    setFormIsStoring(true);
    setFormFrequencySeconds(5);
    setIsModalOpen(true);
  };

  const openEditModal = (config: DeviceConfig) => {
    setEditingMachineId(config.machine_id);
    setFormMachineId(config.machine_id);
    setFormMachineName(config.machine_name || config.machine_id);
    setFormDeviceId(config.device_id || config.machine_id);
    setFormLocation(config.location || "");
    setFormIsStoring(config.is_storing);
    setFormFrequencySeconds(config.frequency_seconds);
    setIsModalOpen(true);
  };

  const handleSaveMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    const machineId = formMachineId.trim();
    if (!machineId) return;

    await updateDeviceConfigInFirestore(machineId, {
      machine_name: formMachineName.trim() || machineId,
      device_id: formDeviceId.trim() || machineId,
      location: formLocation.trim(),
      is_storing: formIsStoring,
      frequency_seconds: formFrequencySeconds,
      is_online: true,
      machine_status: "idle",
    });

    setIsModalOpen(false);
    setSelected(machineId);
  };

  const handleDeleteMachine = async (machineId: string) => {
    if (confirm(`Are you sure you want to delete/unlink Machine '${machineId}'?`)) {
      await deleteDeviceFromFirestore(machineId);
      if (selected === machineId) setSelected(null);
    }
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
    const config = getDeviceConfig(machineId);
    const devReadings = devicesMap.get(machineId) ?? devicesMap.get(config.device_id) ?? [];
    if (devReadings.length === 0) return;

    const headers = [
      "Machine Name",
      "Machine ID",
      "IoT Device ID",
      "RPM",
      "Count",
      "Uptime",
      "Machine Start",
      "Machine End",
      "Reading Time",
      "Received At"
    ];
    const rows = devReadings.map((r) => [
      `"${config.machine_name || r.machine_name || r.device_id}"`,
      `"${r.machine_id || config.machine_id}"`,
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
      {/* Page Title & Add Machine Link Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            Machine & IoT Device Manager
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Register human-readable machine names, link hardware IoT device IDs, and configure auto-storage parameters
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-2 text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-medium px-4 py-2.5 rounded-xl transition-all shadow-md shadow-cyan-950/20 active:scale-95 whitespace-nowrap w-fit"
        >
          <Plus className="w-4 h-4" />
          <span>Link New Machine to IoT Device</span>
        </button>
      </div>

      {/* Machine Linkage Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  {editingMachineId ? "Edit Machine Linkage" : "Register & Link IoT Device"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Connect hardware IoT telemetry streams to a human-readable machine
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMachine} className="space-y-4">
              {/* Field 1: Machine Name */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Machine Name (Client Facing) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formMachineName}
                  onChange={(e) => setFormMachineName(e.target.value)}
                  placeholder="e.g. CNC Lathe Machine #1"
                  className="bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-200 text-sm rounded-lg px-3.5 py-2 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 focus:outline-none w-full placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Field 2: Machine ID / Code */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Machine Code / ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingMachineId)}
                    value={formMachineId}
                    onChange={(e) => setFormMachineId(e.target.value)}
                    placeholder="e.g. MCH-001"
                    className="bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-200 text-sm rounded-lg px-3.5 py-2 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 focus:outline-none w-full font-mono placeholder:text-slate-400 dark:placeholder:text-slate-600 disabled:opacity-50 font-medium"
                  />
                </div>

                {/* Field 3: Linked IoT Hardware Device ID */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1 flex items-center justify-between">
                    <span>Connected IoT Device ID</span>
                    <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold">RTDB Stream</span>
                  </label>
                  <div className="space-y-1.5">
                    <select
                      value={formDeviceId}
                      onChange={(e) => setFormDeviceId(e.target.value)}
                      className="bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-200 text-sm rounded-lg px-3 py-2 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 focus:outline-none w-full font-mono font-medium"
                    >
                      {detectedIotDeviceIds.map((id) => (
                        <option key={id} value={id}>
                          {id} (Detected IoT Stream)
                        </option>
                      ))}
                      <option value="custom">+ Enter Custom Device ID...</option>
                    </select>
                    {formDeviceId === "custom" && (
                      <input
                        type="text"
                        placeholder="Custom Hardware Device ID (e.g. ESP32_01)"
                        onChange={(e) => setFormDeviceId(e.target.value)}
                        className="bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-200 text-xs rounded-lg px-3 py-1.5 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 focus:outline-none w-full font-mono placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Field 4: Location / Department */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Location / Department (Optional)
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="e.g. Shop Floor A - Station 3"
                    className="bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-200 text-sm rounded-lg pl-9 pr-3.5 py-2 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 focus:outline-none w-full placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
                  />
                </div>
              </div>

              {/* Field 5 & 6: Data Storage Controls */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    Auto-Store Historical Sensor Data
                  </span>
                  <button
                    type="button"
                    onClick={() => setFormIsStoring(!formIsStoring)}
                    className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                      formIsStoring
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    {formIsStoring ? <ToggleRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <ToggleLeft className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
                    {formIsStoring ? "ON" : "OFF"}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    Sync Frequency
                  </span>
                  <select
                    value={formFrequencySeconds}
                    onChange={(e) => setFormFrequencySeconds(Number(e.target.value))}
                    className="bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs rounded px-2.5 py-1 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 focus:outline-none font-medium"
                  >
                    <option value={1}>Every 1 Second</option>
                    <option value={2}>Every 2 Seconds</option>
                    <option value={5}>Every 5 Seconds</option>
                    <option value={10}>Every 10 Seconds</option>
                    <option value={30}>Every 30 Seconds</option>
                  </select>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs text-slate-400 hover:text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
                >
                  {editingMachineId ? "Save Changes" : "Connect & Save Machine"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Machine Cards List */}
      {activeMachineIds.length === 0 ? (
        <div className="bg-white/90 dark:bg-slate-900/50 backdrop-blur rounded-xl p-10 border border-slate-200/80 dark:border-slate-800 text-center shadow-sm dark:shadow-none">
          <Activity className="w-10 h-10 text-slate-400 dark:text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">No machines registered in Firestore. Click "Link New Machine to IoT Device" above.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeMachineIds.map((machineId) => {
              const config = getDeviceConfig(machineId);
              const devReadings = devicesMap.get(machineId) ?? devicesMap.get(config.device_id) ?? [];
              const latest = devReadings[0];
              const isSelected = selected === machineId;

              return (
                <div
                  key={machineId}
                  className={`bg-white/90 dark:bg-slate-900/50 backdrop-blur rounded-xl p-5 border transition-all shadow-sm dark:shadow-none ${
                    isSelected ? "border-cyan-500/50 ring-1 ring-cyan-500/30" : "border-slate-200/80 dark:border-slate-800"
                  }`}
                >
                  {/* Card Header: Machine Name, ID & Action Buttons */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold text-xs border border-cyan-500/20 font-mono mt-0.5">
                        {machineId.slice(0, 3)}
                      </div>
                      <div>
                        <h3 className="text-slate-900 dark:text-white font-bold text-base leading-tight">
                          {config.machine_name || machineId}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 dark:bg-cyan-950/60 border border-cyan-500/20 dark:border-cyan-800/50 px-2 py-0.5 rounded flex items-center gap-1 font-medium">
                            <LinkIcon className="w-2.5 h-2.5 text-cyan-600 dark:text-cyan-400" />
                            IoT: {config.device_id || machineId}
                          </span>
                          {config.location && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
                              <MapPin className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500" />
                              {config.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(config)}
                        title="Edit Machine Linkage"
                        className="p-1.5 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteMachine(machineId)}
                        title="Delete Machine"
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div className="flex items-center justify-between mb-3 bg-slate-50 dark:bg-slate-950/60 p-2 rounded-lg border border-slate-200/80 dark:border-slate-800/60">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      Doc: <span className="text-slate-700 dark:text-slate-300 font-medium">{machineId}</span>
                    </span>

                    <div className="flex items-center gap-1.5">
                      {/* Online / Offline */}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${config.is_online ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" : "bg-slate-200 dark:bg-slate-800 text-slate-500"}`}>
                        {config.is_online ? <CheckCircle className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                        {config.is_online ? "ONLINE" : "OFFLINE"}
                      </span>

                      {/* Machine Running / Idle */}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${latest && latest.rpm > 0 ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}>
                        {latest && latest.rpm > 0 ? "RUNNING" : "IDLE"}
                      </span>
                    </div>
                  </div>

                  {/* Telemetry Snapshot */}
                  <div className="grid grid-cols-4 gap-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200/80 dark:border-slate-800/80 mb-4 text-center">
                    <div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">RPM</p>
                      <p className="text-base font-bold text-cyan-600 dark:text-cyan-400 tabular-nums">{latest?.rpm.toFixed(0) ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Count</p>
                      <p className="text-base font-bold text-slate-900 dark:text-white tabular-nums">{latest?.count ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Vib Peak</p>
                      <p className="text-xs font-bold text-purple-600 dark:text-purple-400 tabular-nums font-mono mt-1">{(latest?.vib_peak_g ?? 0).toFixed(2)}g</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Vib RMS</p>
                      <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tabular-nums font-mono mt-1">{(latest?.vib_rms_g ?? 0).toFixed(2)}g</p>
                    </div>
                  </div>

                  {/* Config Controls: Store ON/OFF & Frequency */}
                  <div className="space-y-3 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                        <Power className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                        Store Data (ON/OFF)
                      </span>
                      <button
                        onClick={() => handleToggleStoring(machineId, config.is_storing)}
                        className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                          config.is_storing
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {config.is_storing ? <ToggleRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <ToggleLeft className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
                        {config.is_storing ? "ON" : "OFF"}
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                        Sync Frequency
                      </span>
                      <select
                        value={config.frequency_seconds}
                        onChange={(e) => handleFrequencyChange(machineId, Number(e.target.value))}
                        className="bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs rounded px-2 py-1 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 focus:outline-none font-medium"
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
                  <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800/80">
                    <button
                      onClick={() => setSelected(isSelected ? null : machineId)}
                      className="text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 font-semibold"
                    >
                      {isSelected ? "Hide RPM Chart" : "View RPM Chart"}
                    </button>

                    <button
                      onClick={() => exportDeviceCSV(machineId)}
                      disabled={devReadings.length === 0}
                      className="flex items-center gap-1 text-[11px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-2.5 py-1 rounded transition-colors disabled:opacity-30 border border-slate-200 dark:border-slate-700 font-medium"
                    >
                      <Download className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      Export CSV
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Machine RPM Chart */}
          {selected && (
            <div className="mt-6 bg-white/90 dark:bg-slate-900/50 backdrop-blur rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  {getDeviceConfig(selected).machine_name || selected} — Historical RPM Trend
                </h3>
                <button
                  onClick={() => exportDeviceCSV(selected)}
                  className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition-colors font-medium shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export {selected} CSV
                </button>
              </div>
              <RpmChart readings={devicesMap.get(selected) ?? devicesMap.get(getDeviceConfig(selected).device_id) ?? []} height={260} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
