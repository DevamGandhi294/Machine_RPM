import { useMemo, useState, useEffect } from "react";
import { Activity, Gauge, TrendingUp, Database, Radio } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { RpmChart } from "@/components/RpmChart";
import { calculateRollingRpm } from "@/lib/rpmAlgorithm";
import type { SensorReading } from "@/lib/firebase";

interface DashboardViewProps {
  readings: SensorReading[];
  lastUpdated: Date | null;
}

export function DashboardView({ readings, lastUpdated }: DashboardViewProps) {
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    const machines = new Map<string, SensorReading[]>();
    for (const r of readings) {
      const key = r.machine_id || r.device_id;
      if (!machines.has(key)) machines.set(key, []);
      const arr = machines.get(key)!;
      if (arr.length < 100) arr.push(r);
    }

    const machineList = Array.from(machines.keys()).sort();
    const totalReadings = readings.length;

    let totalCurrentRpm = 0;
    let activeOnlineCount = 0;
    const rollingRpms: number[] = [];

    machineList.forEach((id) => {
      const devReadings = machines.get(id)!;
      const rpmMetrics = calculateRollingRpm(devReadings, {
        currentNow: currentTime,
        windowSeconds: 60,
        timeoutSeconds: 10,
      });

      if (rpmMetrics.isOnline) {
        activeOnlineCount += 1;
        totalCurrentRpm += rpmMetrics.rpm;
        if (rpmMetrics.rpm > 0) {
          rollingRpms.push(rpmMetrics.rpm);
        }
      }
    });

    const avgRpm = rollingRpms.length > 0 ? rollingRpms.reduce((s, r) => s + r, 0) / rollingRpms.length : 0;
    const allRpms = readings.map((r) => r.rpm);
    const maxRpm = allRpms.length > 0 ? Math.max(...allRpms) : 0;

    return {
      deviceCount: machineList.length,
      activeOnlineCount,
      totalReadings,
      avgRpm,
      maxRpm,
      totalCurrentRpm,
      machines,
      machineList,
    };
  }, [readings, currentTime]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Dashboard</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
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
        {stats.machineList.length > 0 ? (
          stats.machineList.map((machineId) => {
            const machineReadings = stats.machines.get(machineId)!;
            const latest = machineReadings[0];
            return (
              <RpmChart
                key={machineId}
                readings={machineReadings}
                title={latest?.machine_name || machineId}
                subtitle={latest?.device_id ? `Connected IoT Device: ${latest.device_id}` : undefined}
              />
            );
          })
        ) : (
          <div className="col-span-2 bg-white/90 dark:bg-slate-900/50 backdrop-blur rounded-xl p-10 border border-slate-200/80 dark:border-slate-800 text-center shadow-sm dark:shadow-none">
            <Activity className="w-10 h-10 text-slate-400 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">No sensor data yet. Waiting for devices to report...</p>
          </div>
        )}
      </div>
    </div>
  );
}
