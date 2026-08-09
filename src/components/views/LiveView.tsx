import { useEffect, useState, useMemo } from "react";
import { Radio, Activity } from "lucide-react";
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
          Live Monitor
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">Real-time RPM readings — auto-refreshes every 10 seconds</p>
      </div>

      {deviceList.length === 0 ? (
        <div className="bg-slate-900/50 backdrop-blur rounded-xl p-10 border border-slate-800 text-center">
          <Activity className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No devices reporting yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            {deviceList.map((id) => {
              const devReadings = devices.get(id) ?? [];
              const rpm = devReadings[0]?.rpm ?? 0;
              const active = selected === id;
              return (
                <button
                  key={id}
                  onClick={() => setSelected(id)}
                  className={`w-full text-left bg-slate-900/50 backdrop-blur rounded-xl p-4 border transition-all ${
                    active ? "border-cyan-500/40 ring-1 ring-cyan-500/20" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${rpm > 0 ? "bg-emerald-500 animate-pulse" : "bg-slate-600"}`} />
                      <span className="text-white font-medium text-sm">{id}</span>
                    </div>
                    <span className="text-cyan-400 font-bold text-lg tabular-nums">{rpm.toFixed(0)}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {selected && (
              <>
                <div className="bg-slate-900/50 backdrop-blur rounded-xl p-5 border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-white">{selected} — Current Reading</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${latest && latest.rpm > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800 text-slate-500"}`}>
                      {latest && latest.rpm > 0 ? "Running" : "Idle"}
                    </span>
                  </div>
                  {latest ? (
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-slate-500">RPM</p>
                        <p className="text-3xl font-bold text-cyan-400 tabular-nums">{latest.rpm.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Count</p>
                        <p className="text-3xl font-bold text-white tabular-nums">{latest.count}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Time</p>
                        <p className="text-sm font-medium text-slate-300 mt-1.5">{latest.reading_time}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm">No readings for this device.</p>
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
