import { useEffect, useState, useMemo } from "react";
import { Radio, Activity, Clock, PlayCircle, StopCircle, Gauge, Hash, Timer } from "lucide-react";
import { RpmChart } from "@/components/RpmChart";
import { useDeviceReadings } from "@/hooks/useSensorData";
import type { SensorReading } from "@/lib/firebase";

interface LiveViewProps {
  readings: SensorReading[];
}

export function LiveView({ readings }: LiveViewProps) {
  const devices = useMemo(() => {
    const map = new Map<string, SensorReading[]>();
    for (const r of readings) {
      if (!map.has(r.device_id)) map.set(r.device_id, []);
      const arr = map.get(r.device_id)!;
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Radio className="w-5 h-5 text-cyan-400" />
          Live Data Panel
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Real-time machine status, RPM, uptime, and start/stop timestamps
        </p>
      </div>

      {deviceList.length === 0 ? (
        <div className="bg-slate-900/50 backdrop-blur rounded-xl p-10 border border-slate-800 text-center">
          <Activity className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No devices reporting yet. Connect your hardware or start auto-recorder in Settings.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Device Selection Sidebar */}
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Active Devices</h3>
            {deviceList.map((id) => {
              const devReadings = devices.get(id) ?? [];
              const devLatest = devReadings[0];
              const rpm = devLatest?.rpm ?? 0;
              const active = selected === id;
              const uptimeStr = devLatest?.uptime || "";

              return (
                <button
                  key={id}
                  onClick={() => setSelected(id)}
                  className={`w-full text-left bg-slate-900/50 backdrop-blur rounded-xl p-4 border transition-all ${
                    active ? "border-cyan-500/50 ring-1 ring-cyan-500/30 bg-slate-900/80" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${rpm > 0 ? "bg-emerald-500 animate-pulse" : "bg-cyan-500"}`} />
                      <div>
                        <span className="text-white font-semibold text-sm">{id}</span>
                        {uptimeStr && (
                          <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                            <Timer className="w-3 h-3 text-cyan-400" />
                            {uptimeStr}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-cyan-400 font-bold text-lg tabular-nums block">{rpm.toFixed(0)} <span className="text-xs text-slate-500 font-normal">RPM</span></span>
                      <span className="text-xs text-slate-400 tabular-nums">Count: {devLatest?.count ?? 0}</span>
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
                <div className="bg-slate-900/50 backdrop-blur rounded-xl p-6 border border-slate-800 space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Gauge className="w-5 h-5 text-cyan-400" />
                        {selected} — Telemetry Overview
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">Live machine parameters from Firebase</p>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${latest && latest.rpm > 0 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-slate-800 text-slate-400 border border-slate-700"}`}>
                      {latest && latest.rpm > 0 ? "Running" : "Idle"}
                    </span>
                  </div>

                  {latest ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {/* Metric 1: RPM */}
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                          <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                          <span>RPM</span>
                        </div>
                        <p className="text-3xl font-extrabold text-cyan-400 tabular-nums">{latest.rpm.toFixed(0)}</p>
                      </div>

                      {/* Metric 2: Count */}
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                          <Hash className="w-3.5 h-3.5 text-amber-400" />
                          <span>Count</span>
                        </div>
                        <p className="text-3xl font-extrabold text-white tabular-nums">{latest.count}</p>
                      </div>

                      {/* Metric 3: Uptime */}
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                          <Timer className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Uptime</span>
                        </div>
                        <p className="text-xl font-bold text-emerald-400 font-mono mt-1">{latest.uptime || "0d 00:00:00"}</p>
                      </div>

                      {/* Metric 4: Machine Start */}
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                          <PlayCircle className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Machine Start</span>
                        </div>
                        <p className="text-xs font-mono text-slate-200 mt-2 font-medium">{latest.machine_start || "N/A"}</p>
                      </div>

                      {/* Metric 5: Machine End */}
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                          <StopCircle className="w-3.5 h-3.5 text-rose-400" />
                          <span>Machine End</span>
                        </div>
                        <p className="text-xs font-mono text-slate-200 mt-2 font-medium">{latest.machine_end || "N/A"}</p>
                      </div>

                      {/* Metric 6: Time */}
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                          <Clock className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Last Time</span>
                        </div>
                        <p className="text-xs font-mono text-slate-200 mt-2 font-medium">{latest.reading_time}</p>
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
