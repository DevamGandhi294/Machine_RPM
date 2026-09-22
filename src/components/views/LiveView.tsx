import { useEffect, useState, useMemo } from "react";
import { Radio, Activity, Clock, PlayCircle, StopCircle, Gauge, Hash, Timer } from "lucide-react";
import { RpmChart } from "@/components/RpmChart";
import { useDeviceReadings } from "@/hooks/useSensorData";
import { calculateRollingRpm } from "@/lib/rpmAlgorithm";
import type { SensorReading } from "@/lib/firebase";

interface LiveViewProps {
  readings: SensorReading[];
}

export function LiveView({ readings }: LiveViewProps) {
  const [currentTime, setCurrentTime] = useState(() => Date.now());

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Radio className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          Live Data Panel
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Real-time machine status, RPM (60s calibrated), uptime, and telemetry from connected IoT devices
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

                <RpmChart readings={deviceReadings} height={240} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
