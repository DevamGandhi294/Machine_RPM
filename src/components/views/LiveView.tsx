import { useEffect, useState, useMemo } from "react";
import { Radio, Activity, Clock, PlayCircle, StopCircle, Gauge, Hash, Timer, Ruler, Calculator, Layers, TrendingUp, Zap, Target, Hourglass } from "lucide-react";
import { RpmChart } from "@/components/RpmChart";
import { useDeviceReadings } from "@/hooks/useSensorData";
import { calculateRollingRpm } from "@/lib/rpmAlgorithm";
import type { SensorReading } from "@/lib/firebase";

interface LiveViewProps {
  readings: SensorReading[];
}

export function LiveView({ readings }: LiveViewProps) {
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [rollDiameter, setRollDiameter] = useState<number>(90); // Default 90 mm
  const [ppr, setPpr] = useState<number>(1); // Default 1 Pulse per Revolution
  const [targetBatchMeters, setTargetBatchMeters] = useState<number>(1000); // Target Order Batch (Meters)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const devices = useMemo(() => {
    const map = new Map<string, SensorReading[]>();
    for (const r of readings) {
      const key = r.machine_id || r.device_id;
      if (!map.has(key)) map.set(key, []);
      const arr = map.get(key)!;
      if (arr.length < 100) arr.push(r);
    }
    return map;
  }, [readings]);

  const deviceList = Array.from(devices.keys()).sort();
  const [selected, setSelected] = useState<string | null>(deviceList[0] ?? null);

  useEffect(() => {
    if (!selected && deviceList.length > 0) setSelected(deviceList[0]);
  }, [deviceList, selected]);

  const { readings: deviceReadings } = useDeviceReadings(selected, 100);
  const latest = deviceReadings[0];
  const machineDisplayName = latest?.machine_name || selected;
  const iotDeviceId = latest?.device_id || selected;

  const selectedRpmMetrics = calculateRollingRpm(deviceReadings, {
    currentNow: currentTime,
    windowSeconds: 60,
    timeoutSeconds: 10,
  });

  // Roll Diameter & Pulse Calculations
  const pi = 3.1416;
  const validDiameter = rollDiameter > 0 ? rollDiameter : 90;
  const validPpr = ppr > 0 ? ppr : 1;

  // 1. Roll Circumference (mm & m)
  const circumferenceMm = pi * validDiameter; // e.g. 3.1416 * 90 = 282.744 mm
  const circumferenceM = circumferenceMm / 1000; // e.g. 0.282744 m

  // 2. Material per Pulse
  const materialPerPulseM = circumferenceM / validPpr; // e.g. 0.282744 m / 1 = 0.282744 m
  const materialPerPulseCm = materialPerPulseM * 100; // e.g. 28.2744 cm

  // 3. Live Total Material Production Length
  const currentCount = latest?.count ?? 0;
  const totalMaterialM = currentCount * materialPerPulseM; // Total meters produced
  const totalMaterialCm = totalMaterialM * 100;

  // 4. Line Production Speed (Meters / Minute - MPM)
  const lineSpeedMpm = selectedRpmMetrics.rpm * materialPerPulseM;

  // New Production Parameters (MPH, Batch %, ETA)
  const hourlyProductionMph = lineSpeedMpm * 60; // Meters per Hour
  const hourlyProductionKmh = hourlyProductionMph / 1000; // km/hour

  const batchProgressPct = targetBatchMeters > 0 ? Math.min(100, (totalMaterialM / targetBatchMeters) * 100) : 0;
  const remainingMeters = Math.max(0, targetBatchMeters - totalMaterialM);
  const etaMinutes = lineSpeedMpm > 0 && remainingMeters > 0 ? Math.round(remainingMeters / lineSpeedMpm) : 0;
  const etaFormatted = etaMinutes >= 60 ? `${Math.floor(etaMinutes / 60)}h ${etaMinutes % 60}m` : `${etaMinutes} mins`;

  // Interactive Test Inputs & Calculations
  const [testPulses, setTestPulses] = useState<number>(1000);
  const [targetMeters, setTargetMeters] = useState<number>(100);

  const testMetersOutput = testPulses * materialPerPulseM;
  const testCmOutput = testMetersOutput * 100;

  const targetPulsesRequired = materialPerPulseM > 0 ? Math.round(targetMeters / materialPerPulseM) : 0;
  const targetRotationsRequired = targetPulsesRequired / validPpr;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Radio className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          Live Data Panel
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Real-time machine status, RPM (60s calibrated), production output report, and telemetry from connected IoT devices
        </p>
      </div>

      {deviceList.length === 0 ? (
        <div className="bg-white/90 dark:bg-slate-900/50 backdrop-blur rounded-xl p-10 border border-slate-200/80 dark:border-slate-800 text-center shadow-sm dark:shadow-none">
          <Activity className="w-10 h-10 text-slate-400 dark:text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">No devices reporting yet. Connect your hardware or start auto-recorder in Settings.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Device Selection Sidebar */}
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-2">Connected Machines</h3>
            {deviceList.map((id) => {
              const devReadings = devices.get(id) ?? [];
              const devLatest = devReadings[0];
              const metrics = calculateRollingRpm(devReadings, {
                currentNow: currentTime,
                windowSeconds: 60,
                timeoutSeconds: 10,
              });
              const rpm = metrics.rpm;
              const isOnline = metrics.isOnline;
              const active = selected === id;
              const name = devLatest?.machine_name || id;
              const iotId = devLatest?.device_id || id;
              const uptimeStr = devLatest?.uptime || "";

              return (
                <button
                  key={id}
                  onClick={() => setSelected(id)}
                  className={`w-full text-left bg-white/90 dark:bg-slate-900/50 backdrop-blur rounded-xl p-4 border transition-all shadow-sm dark:shadow-none ${
                    active ? "border-cyan-500/50 ring-1 ring-cyan-500/30 bg-cyan-500/5 dark:bg-slate-900/80" : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${isOnline && rpm > 0 ? "bg-emerald-500 animate-pulse" : isOnline ? "bg-amber-500" : "bg-slate-400"}`} />
                      <div>
                        <span className="text-slate-900 dark:text-white font-semibold text-sm block leading-tight">{name}</span>
                        <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono block mt-0.5 font-medium">IoT: {iotId}</span>
                        {uptimeStr && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                            <Timer className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                            {uptimeStr}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-cyan-600 dark:text-cyan-400 font-bold text-lg tabular-nums block">{rpm.toFixed(0)} <span className="text-xs text-slate-400 font-normal">RPM</span></span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">Count: {devLatest?.count ?? 0}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Main Telemetry & Metrics Panel */}
          <div className="lg:col-span-2 space-y-4">
            {selected && (
              <>
                <div className="bg-white/90 dark:bg-slate-900/50 backdrop-blur rounded-xl p-6 border border-slate-200/80 dark:border-slate-800 space-y-6 shadow-sm dark:shadow-none">
                  <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Gauge className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                        {machineDisplayName}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>Live telemetry from Firebase</span>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <span className="text-cyan-600 dark:text-cyan-400 font-mono font-medium">Connected IoT: {iotDeviceId}</span>
                      </p>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${selectedRpmMetrics.isOnline && selectedRpmMetrics.rpm > 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" : selectedRpmMetrics.isOnline ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"}`}>
                      {!selectedRpmMetrics.isOnline ? "Offline" : selectedRpmMetrics.rpm > 0 ? "Running" : "Idle"}
                    </span>
                  </div>

                  {latest ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                      {/* Metric 1: RPM */}
                      <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1 font-medium">
                          <Gauge className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                          <span>RPM (60s)</span>
                        </div>
                        <p className="text-3xl font-extrabold text-cyan-600 dark:text-cyan-400 tabular-nums">{selectedRpmMetrics.rpm.toFixed(0)}</p>
                      </div>

                      {/* Metric 2: Count */}
                      <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1 font-medium">
                          <Hash className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>Count</span>
                        </div>
                        <p className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">{latest.count}</p>
                      </div>

                      {/* Metric 3: Vibration Peak (g) */}
                      <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1 font-medium">
                          <span className="flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                            <span>Vib Peak (g)</span>
                          </span>
                          <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono">vib_peak_g</span>
                        </div>
                        <p className="text-3xl font-extrabold text-purple-600 dark:text-purple-400 tabular-nums font-mono">
                          {(latest.vib_peak_g ?? 0).toFixed(2)} <span className="text-xs text-slate-500 font-normal">g</span>
                        </p>
                      </div>

                      {/* Metric 4: Vibration RMS (g) */}
                      <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1 font-medium">
                          <span className="flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>Vib RMS (g)</span>
                          </span>
                          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">vib_rms_g</span>
                        </div>
                        <p className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 tabular-nums font-mono">
                          {(latest.vib_rms_g ?? 0).toFixed(2)} <span className="text-xs text-slate-500 font-normal">g</span>
                        </p>
                      </div>

                      {/* Metric 5: Uptime */}
                      <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1 font-medium">
                          <Timer className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Uptime</span>
                        </div>
                        <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1">{latest.uptime || "0d 00:00:00"}</p>
                      </div>

                      {/* Metric 6: Machine Start */}
                      <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1 font-medium">
                          <PlayCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Machine Start</span>
                        </div>
                        <p className="text-xs font-mono text-slate-800 dark:text-slate-200 mt-2 font-medium">{latest.machine_start || "N/A"}</p>
                      </div>

                      {/* Metric 7: Machine End */}
                      <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1 font-medium">
                          <StopCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          <span>Machine End</span>
                        </div>
                        <p className="text-xs font-mono text-slate-800 dark:text-slate-200 mt-2 font-medium">{latest.machine_end || "N/A"}</p>
                      </div>

                      {/* Metric 8: Time */}
                      <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1 font-medium">
                          <Clock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                          <span>Last Time</span>
                        </div>
                        <p className="text-xs font-mono text-slate-800 dark:text-slate-200 mt-2 font-medium">{latest.reading_time}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm">No readings recorded for this device.</p>
                  )}
                </div>

                {/* Production Report & Roll Diameter Pulse Calculator */}
                <div className="bg-white/90 dark:bg-slate-900/50 backdrop-blur rounded-xl p-6 border border-slate-200/80 dark:border-slate-800 space-y-6 shadow-sm dark:shadow-none">
                  {/* Report Header & Calibration Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Ruler className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        Production Output Report & Roll Calculations
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Real-time material length, MPM speed, hourly rate, and target batch progress (<span className="font-mono">π × Diameter</span>)
                      </p>
                    </div>

                    {/* Calibration Inputs */}
                    <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 flex-wrap">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                          Roll Diameter (mm)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="2000"
                          value={rollDiameter}
                          onChange={(e) => setRollDiameter(Number(e.target.value))}
                          className="w-24 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs rounded-md px-2 py-1 border border-slate-300 dark:border-slate-700 font-mono font-bold focus:border-cyan-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                          Encoder PPR
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10000"
                          value={ppr}
                          onChange={(e) => setPpr(Number(e.target.value))}
                          className="w-16 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs rounded-md px-2 py-1 border border-slate-300 dark:border-slate-700 font-mono font-bold focus:border-cyan-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                          Target Order (m)
                        </label>
                        <input
                          type="number"
                          min="10"
                          max="100000"
                          value={targetBatchMeters}
                          onChange={(e) => setTargetBatchMeters(Number(e.target.value))}
                          className="w-24 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs rounded-md px-2 py-1 border border-slate-300 dark:border-slate-700 font-mono font-bold focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 6 Key Production Parameter Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                    {/* KPI 1: Total Production Output (Meters) */}
                    <div className="bg-emerald-500/5 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-500/20">
                      <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 mb-1 font-semibold">
                        <span className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5" />
                          <span>Total Material Output</span>
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Length</span>
                      </div>
                      <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {totalMaterialM.toFixed(2)} <span className="text-sm font-normal text-slate-500">m</span>
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                        = {totalMaterialCm.toFixed(1)} cm
                      </p>
                    </div>

                    {/* KPI 2: Line Speed (MPM) */}
                    <div className="bg-cyan-500/5 dark:bg-cyan-950/30 p-4 rounded-xl border border-cyan-500/20">
                      <div className="flex items-center justify-between text-xs text-cyan-700 dark:text-cyan-400 mb-1 font-semibold">
                        <span className="flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>Line Speed (MPM)</span>
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">m/min</span>
                      </div>
                      <p className="text-3xl font-black text-cyan-600 dark:text-cyan-400 tabular-nums">
                        {lineSpeedMpm.toFixed(1)} <span className="text-xs font-normal text-slate-500">m/min</span>
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                        @{selectedRpmMetrics.rpm.toFixed(0)} RPM
                      </p>
                    </div>

                    {/* KPI 3: Material per Pulse */}
                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1 font-medium">
                        <span className="flex items-center gap-1.5">
                          <Calculator className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>Material / Pulse</span>
                        </span>
                        <span className="text-[10px] font-mono">Circumference</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums font-mono">
                        {materialPerPulseM.toFixed(5)} <span className="text-xs font-normal text-slate-500">m</span>
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-mono">
                        {materialPerPulseCm.toFixed(3)} cm / pulse
                      </p>
                    </div>

                    {/* KPI 4: Hourly Production Rate (MPH) */}
                    <div className="bg-indigo-500/5 dark:bg-indigo-950/30 p-4 rounded-xl border border-indigo-500/20">
                      <div className="flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-400 mb-1 font-semibold">
                        <span className="flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5" />
                          <span>Hourly Rate (MPH)</span>
                        </span>
                        <span className="text-[10px] font-mono">Rate</span>
                      </div>
                      <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums font-mono">
                        {hourlyProductionMph.toFixed(0)} <span className="text-xs font-normal text-slate-500">m/hr</span>
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                        = {hourlyProductionKmh.toFixed(2)} km/hr
                      </p>
                    </div>

                    {/* KPI 5: Target Batch Order Progress (%) */}
                    <div className="bg-purple-500/5 dark:bg-purple-950/30 p-4 rounded-xl border border-purple-500/20">
                      <div className="flex items-center justify-between text-xs text-purple-700 dark:text-purple-400 mb-1 font-semibold">
                        <span className="flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5" />
                          <span>Target Progress</span>
                        </span>
                        <span className="text-[10px] font-mono">{targetBatchMeters} m Target</span>
                      </div>
                      <p className="text-2xl font-black text-purple-600 dark:text-purple-400 tabular-nums font-mono">
                        {batchProgressPct.toFixed(1)}%
                      </p>
                      <div className="w-full bg-purple-200 dark:bg-purple-950 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div
                          className="bg-purple-600 dark:bg-purple-400 h-full rounded-full transition-all duration-300"
                          style={{ width: `${batchProgressPct}%` }}
                        />
                      </div>
                    </div>

                    {/* KPI 6: Estimated Time to Completion (ETA) */}
                    <div className="bg-amber-500/5 dark:bg-amber-950/30 p-4 rounded-xl border border-amber-500/20">
                      <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 mb-1 font-semibold">
                        <span className="flex items-center gap-1.5">
                          <Hourglass className="w-3.5 h-3.5" />
                          <span>Estimated Time (ETA)</span>
                        </span>
                        <span className="text-[10px] font-mono">Completion</span>
                      </div>
                      <p className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums font-mono">
                        {selectedRpmMetrics.rpm > 0 ? etaFormatted : "Stopped"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                        {remainingMeters.toFixed(0)} m remaining
                      </p>
                    </div>
                  </div>

                  {/* Interactive Test Input Calculator Box */}
                  <div className="bg-slate-50 dark:bg-slate-950/80 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Calculator className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                        Interactive Production Test Calculators
                      </h4>
                      <span className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 font-medium">
                        Input Test Data $\rightarrow$ See Instant Output
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Test 1: Input Test Pulses -> Output Production Meters */}
                      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Hash className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            Input Test Pulses (Count)
                          </label>
                          <span className="text-[10px] text-slate-500 font-mono">Pulse $\rightarrow$ Meters</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            value={testPulses}
                            onChange={(e) => setTestPulses(Number(e.target.value))}
                            placeholder="Enter pulses (e.g. 1000)"
                            className="bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white text-sm font-bold font-mono rounded-lg px-3 py-2 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 focus:outline-none w-full"
                          />
                        </div>
                        <div className="bg-emerald-500/10 dark:bg-emerald-950/50 p-3 rounded-lg border border-emerald-500/30 flex items-center justify-between">
                          <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Calculated Material Output:</span>
                          <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                            {testMetersOutput.toFixed(2)} m <span className="text-xs font-normal text-slate-500">({testCmOutput.toFixed(1)} cm)</span>
                          </span>
                        </div>
                      </div>

                      {/* Test 2: Input Target Meters -> Output Required Pulses */}
                      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Ruler className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                            Input Target Material (Meters)
                          </label>
                          <span className="text-[10px] text-slate-500 font-mono">Meters $\rightarrow$ Pulses</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={targetMeters}
                            onChange={(e) => setTargetMeters(Number(e.target.value))}
                            placeholder="Enter target meters (e.g. 100)"
                            className="bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white text-sm font-bold font-mono rounded-lg px-3 py-2 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 focus:outline-none w-full"
                          />
                        </div>
                        <div className="bg-cyan-500/10 dark:bg-cyan-950/50 p-3 rounded-lg border border-cyan-500/30 flex items-center justify-between">
                          <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Required Pulses / Rotations:</span>
                          <span className="text-lg font-black text-cyan-600 dark:text-cyan-400 font-mono">
                            {targetPulsesRequired} <span className="text-xs font-normal text-slate-500">pulses ({targetRotationsRequired.toFixed(1)} revs)</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <RpmChart readings={deviceReadings} height={240} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

