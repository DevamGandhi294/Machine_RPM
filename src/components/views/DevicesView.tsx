import { useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { DeviceCard } from "@/components/DeviceCard";
import { RpmChart } from "@/components/RpmChart";
import type { SensorReading } from "@/lib/firebase";

interface DevicesViewProps {
  readings: SensorReading[];
}

export function DevicesView({ readings }: DevicesViewProps) {
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
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Devices</h2>
        <p className="text-sm text-slate-500 mt-0.5">{deviceList.length} device{deviceList.length !== 1 ? "s" : ""} reporting</p>
      </div>

      {deviceList.length === 0 ? (
        <div className="bg-slate-900/50 backdrop-blur rounded-xl p-10 border border-slate-800 text-center">
          <Activity className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No devices have reported data yet.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {deviceList.map((id) => (
              <DeviceCard
                key={id}
                deviceId={id}
                readings={devices.get(id)!}
                onSelect={() => setSelected(selected === id ? null : id)}
                isSelected={selected === id}
              />
            ))}
          </div>

          {selected && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-white mb-3">{selected} — RPM History</h3>
              <RpmChart readings={devices.get(selected)!} height={260} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
