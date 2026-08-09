import { useMemo } from "react";
import { Activity, Gauge, TrendingUp, Database, Radio } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { RpmChart } from "@/components/RpmChart";
import type { SensorReading } from "@/lib/firebase";

interface DashboardViewProps {
  readings: SensorReading[];
  lastUpdated: Date | null;
}

export function DashboardView({ readings, lastUpdated }: DashboardViewProps) {
  const stats = useMemo(() => {
    const devices = new Map<string, SensorReading[]>();
    for (const r of readings) {
      if (!devices.has(r.device_id)) devices.set(r.device_id, []);
      const arr = devices.get(r.device_id)!;
      if (arr.length < 100) arr.push(r);
    }

    const deviceList = Array.from(devices.keys()).sort();
    const totalReadings = readings.length;
    const allRpms = readings.map((r) => r.rpm);
    const avgRpm = totalReadings > 0 ? allRpms.reduce((s, r) => s + r, 0) / totalReadings : 0;
    const maxRpm = totalReadings > 0 ? Math.max(...allRpms) : 0;

    const latestPerDevice = deviceList.map((id) => {
      const devReadings = devices.get(id)!;
      return devReadings[0];
    });
    const totalCurrentRpm = latestPerDevice.reduce((s, r) => s + (r?.rpm ?? 0), 0);

    return {
      deviceCount: deviceList.length,
      totalReadings,
      avgRpm,
      maxRpm,
      totalCurrentRpm,
      devices: devices,
      deviceList,
    };
  }, [readings]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Dashboard</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : "Loading..."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Devices"
          value={stats.deviceCount}
          icon={Radio}
          color="cyan"
        />
        <StatCard
          label="Current Total RPM"
          value={stats.totalCurrentRpm.toFixed(0)}
          unit="rpm"
          icon={Gauge}
          color="emerald"
        />
        <StatCard
          label="Average RPM"
          value={stats.avgRpm.toFixed(0)}
          unit="rpm"
          icon={TrendingUp}
          color="amber"
        />
        <StatCard
          label="Total Readings"
          value={stats.totalReadings}
          icon={Database}
          color="blue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {stats.deviceList.length > 0 ? (
          stats.deviceList.map((deviceId) => (
            <RpmChart key={deviceId} readings={stats.devices.get(deviceId)!} />
          ))
        ) : (
          <div className="col-span-2 bg-slate-900/50 backdrop-blur rounded-xl p-10 border border-slate-800 text-center">
            <Activity className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No sensor data yet. Waiting for devices to report...</p>
          </div>
        )}
      </div>
    </div>
  );
}
