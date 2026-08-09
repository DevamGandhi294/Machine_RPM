import { DataTable } from "@/components/DataTable";
import type { SensorReading } from "@/lib/firebase";

interface DataTableViewProps {
  readings: SensorReading[];
}

export function DataTableView({ readings }: DataTableViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Data Table</h2>
        <p className="text-sm text-slate-500 mt-0.5">{readings.length} total readings across all devices</p>
      </div>
      <DataTable readings={readings} />
    </div>
  );
}
