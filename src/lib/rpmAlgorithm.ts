import type { SensorReading } from "./firebase";

/**
 * Parses timestamp string or number to milliseconds
 */
export function getReadingTimestampMs(reading?: Partial<SensorReading> | null): number {
  if (!reading) return 0;
  const timeStr = reading.created_at || reading.reading_time;
  if (!timeStr) return 0;
  const num = Number(timeStr);
  if (!isNaN(num) && num > 0) {
    return num < 1e11 ? num * 1000 : num;
  }
  const parsed = new Date(timeStr).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Checks if device is online by comparing the device's own telemetry timestamp with current time.
 * If (currentNow - deviceTime) <= 10 seconds, the device is ONLINE; otherwise OFFLINE.
 */
export function isDeviceOnline(
  reading?: SensorReading | null,
  timeoutSeconds: number = 10,
  currentNow: number = Date.now()
): boolean {
  if (!reading) return false;

  // Extract device's own timestamp (e.g. "2026-09-23T08:51:59.000Z")
  const t = getReadingTimestampMs(reading);
  if (t <= 0) return false;

  const diffMs = currentNow - t;

  // Allow minor clock skew up to -5 seconds, and 10 seconds delay threshold
  return diffMs >= -5000 && diffMs <= timeoutSeconds * 1000;
}

/**
 * Computes 3-second instant RPM from a single reading delta
 * e.g. Count of 1 rotation in 3 seconds => 1 * (60 / 3) = 20 RPM
 */
export function calculateInstantRpm(
  countDelta: number,
  intervalSeconds: number = 3
): number {
  if (countDelta <= 0 || intervalSeconds <= 0) return 0;
  return (countDelta / intervalSeconds) * 60;
}

/**
 * Result of the 60-second rolling RPM calculation
 */
export interface RollingRpmResult {
  rpm: number;             // 60-second rolling RPM (calibrated)
  instantRpm: number;      // Latest 3-second instantaneous RPM
  rollingCount: number;    // Total revolutions counted in the last 60 seconds
  windowSeconds: number;   // Window size in seconds (60s)
  isOnline: boolean;       // Device online heartbeat status (<10s)
  sampleCount: number;     // Number of readings in the window
}

/**
 * Computes 60-Second Rolling Window RPM for a series of device readings.
 * 
 * - Captures up to the last 60 seconds of sensor packets (e.g. 20 packets @ 3s interval).
 * - Sums revolutions in the 60s window and normalizes to Revolutions Per Minute.
 * - Handles machine stop: zero counts immediately drop instant RPM and drain the window.
 * - Handles machine offline / power cut: if no packet received for >10s, RPM immediately clamps to 0.
 */
export function calculateRollingRpm(
  readings: SensorReading[],
  options?: {
    windowSeconds?: number;
    timeoutSeconds?: number;
    currentNow?: number;
  }
): RollingRpmResult {
  const windowSeconds = options?.windowSeconds ?? 60;
  const timeoutSeconds = options?.timeoutSeconds ?? 10;
  const currentNow = options?.currentNow ?? Date.now();

  if (!readings || readings.length === 0) {
    return {
      rpm: 0,
      instantRpm: 0,
      rollingCount: 0,
      windowSeconds,
      isOnline: false,
      sampleCount: 0,
    };
  }

  const latest = readings[0];
  const online = isDeviceOnline(latest, timeoutSeconds, currentNow);

  // If machine is offline (no packets for >30s), force RPM to 0
  if (!online) {
    return {
      rpm: 0,
      instantRpm: 0,
      rollingCount: 0,
      windowSeconds,
      isOnline: false,
      sampleCount: 0,
    };
  }

  const latestTimeMs = getReadingTimestampMs(latest);
  const cutoffTimeMs = latestTimeMs > 0 ? latestTimeMs - windowSeconds * 1000 : 0;

  // Filter all readings inside the 60-second window
  const windowReadings = readings.filter((r) => {
    const t = getReadingTimestampMs(r);
    return cutoffTimeMs === 0 || (t >= cutoffTimeMs && t <= latestTimeMs + 5000);
  });

  if (windowReadings.length === 0) {
    const rawRpm = latest.rpm || 0;
    return {
      rpm: rawRpm,
      instantRpm: rawRpm,
      rollingCount: latest.count || 0,
      windowSeconds,
      isOnline: online,
      sampleCount: 1,
    };
  }

  // 1. Calculate instant RPM from the newest packet & second newest packet if available
  let instantRpm = latest.rpm || 0;
  if (instantRpm === 0) {
    if (windowReadings.length > 1) {
      const prev = windowReadings[1];
      const countDelta = Math.max(0, latest.count - prev.count);
      const timeDeltaSec = Math.max(1, (getReadingTimestampMs(latest) - getReadingTimestampMs(prev)) / 1000);
      instantRpm = calculateInstantRpm(countDelta, isNaN(timeDeltaSec) || timeDeltaSec <= 0 ? 3 : timeDeltaSec);
    } else if (latest.count > 0) {
      // Single reading fallback
      instantRpm = latest.count <= 100 ? calculateInstantRpm(latest.count, 3) : 0;
    }
  }

  // 2. Rolling Window RPM calculation over the 60-second window
  let totalRpmSum = 0;
  let hasRawRpm = false;

  for (const r of windowReadings) {
    if (r.rpm > 0) {
      totalRpmSum += r.rpm;
      hasRawRpm = true;
    }
  }

  const oldestInWindow = windowReadings[windowReadings.length - 1];
  const oldestTimeMs = getReadingTimestampMs(oldestInWindow);
  const elapsedMs = Math.max(latestTimeMs - oldestTimeMs, 3000);
  const elapsedSeconds = Math.min(elapsedMs / 1000, windowSeconds);

  let rollingRpm = 0;
  let rollingCount = 0;

  if (hasRawRpm && windowReadings.length > 0) {
    rollingRpm = totalRpmSum / windowReadings.length;
    rollingCount = windowReadings.reduce((sum, r) => sum + r.count, 0);
  } else if (windowReadings.length > 1) {
    // Cumulative pulse count delta across window
    const maxCount = Math.max(...windowReadings.map((r) => r.count));
    const minCount = Math.min(...windowReadings.map((r) => r.count));
    rollingCount = Math.max(0, maxCount - minCount);
    rollingRpm = (rollingCount / elapsedSeconds) * 60;
  } else {
    rollingRpm = instantRpm;
    rollingCount = latest.count || 0;
  }

  return {
    rpm: Math.max(0, Math.round(rollingRpm * 10) / 10),
    instantRpm: Math.max(0, Math.round(instantRpm * 10) / 10),
    rollingCount,
    windowSeconds,
    isOnline: online,
    sampleCount: windowReadings.length,
  };
}
