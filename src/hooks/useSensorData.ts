import { useEffect, useState, useCallback, useRef } from "react";
import { db, rtdb, type SensorReading } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  addDoc
} from "firebase/firestore";
import {
  ref as dbRef,
  onValue,
  push,
  set as setRtdb
} from "firebase/database";

/**
 * Pushes a new historical sensor reading entry under a device-named collection/node.
 * e.g., Firestore collection: deviceId (e.g. "rpm_meter" or "RPM1")
 * e.g., RTDB path: /{deviceId}/{pushId}
 */
export async function pushHistoricalReading(
  deviceId: string,
  count: number,
  rpm: number,
  readingTime?: string
) {
  const now = new Date();
  const timeStr = readingTime || `${now.toISOString().split("T")[0]} ${now.toTimeString().split(" ")[0]}`;
  const createdAt = now.toISOString();

  const payload = {
    device_id: deviceId,
    count,
    rpm,
    time: timeStr,
    reading_time: timeStr,
    created_at: createdAt,
  };

  try {
    // 1. Push to Firestore collection named after the device (e.g. collection "rpm_meter")
    await addDoc(collection(db, deviceId), payload);

    // 2. Also push to Firestore collection "sensordata"
    await addDoc(collection(db, "sensordata"), payload);

    // 3. Push to Firebase Realtime Database node named after device (e.g. /rpm_meter/{pushId})
    const rtdbDeviceRef = push(dbRef(rtdb, deviceId));
    await setRtdb(rtdbDeviceRef, payload);

    // 4. Also push to RTDB /sensordata/{deviceId}/{pushId}
    const rtdbSensordataRef = push(dbRef(rtdb, `sensordata/${deviceId}`));
    await setRtdb(rtdbSensordataRef, payload);

    return true;
  } catch (err) {
    console.warn(`Error pushing historical reading for ${deviceId}:`, err);
    return false;
  }
}

export function useSensorData(refreshMs = 10000) {
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const mounted = useRef(true);

  // Store collected map of readings by unique ID or key
  const readingsMapRef = useRef<Map<string, SensorReading>>(new Map());

  const processAndSetReadings = useCallback(() => {
    if (!mounted.current) return;
    const all = Array.from(readingsMapRef.current.values());
    all.sort((a, b) => {
      const dateA = new Date(a.created_at || a.reading_time).getTime();
      const dateB = new Date(b.created_at || b.reading_time).getTime();
      return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
    });
    setReadings(all.slice(0, 1000));
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  const parseItem = (key: string, val: any, defaultDeviceId: string): SensorReading | null => {
    if (!val || typeof val !== "object") return null;

    const count = Number(val.count ?? val.c ?? 0);
    const rpm = Number(val.rpm ?? val.r ?? 0);
    const rawTime = val.time || val.reading_time || val.created_at;

    let readingTime = typeof rawTime === "string" ? rawTime : new Date().toLocaleString();
    let createdAt = typeof rawTime === "string" && rawTime.includes("-") ? rawTime : new Date().toISOString();

    return {
      id: key,
      device_id: val.device_id || defaultDeviceId,
      count,
      rpm,
      reading_time: readingTime,
      created_at: createdAt,
    };
  };

  useEffect(() => {
    mounted.current = true;
    setLoading(true);

    const unsubscribers: Array<() => void> = [];

    // 1. Listen to Realtime Database ROOT ("/") for device-named collections/nodes like /rpm_meter, /RPM1, etc.
    try {
      const rootRef = dbRef(rtdb, "/");
      const unsubRoot = onValue(
        rootRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const rootVal = snapshot.val();
            if (rootVal && typeof rootVal === "object") {
              Object.keys(rootVal).forEach((nodeKey) => {
                const nodeVal = rootVal[nodeKey];
                if (!nodeVal || typeof nodeVal !== "object") return;

                // Case A: Single status object (e.g. /rpm_meter -> { count: 18, rpm: 0, time: "..." })
                if ("count" in nodeVal || "rpm" in nodeVal || "time" in nodeVal) {
                  const item = parseItem(`rtdb_${nodeKey}`, nodeVal, nodeKey);
                  if (item) readingsMapRef.current.set(item.id, item);
                } else {
                  // Case B: Collection of historical readings (e.g. /rpm_meter/-Nx123...)
                  Object.keys(nodeVal).forEach((pushKey) => {
                    const childVal = nodeVal[pushKey];
                    if (!childVal || typeof childVal !== "object") return;

                    if ("count" in childVal || "rpm" in childVal || "time" in childVal) {
                      const item = parseItem(`rtdb_${nodeKey}_${pushKey}`, childVal, nodeKey);
                      if (item) readingsMapRef.current.set(item.id, item);
                    } else {
                      // 3rd level nesting (e.g. /sensordata/RPM1/-Nx123...)
                      Object.keys(childVal).forEach((grandChildKey) => {
                        const grandChildVal = childVal[grandChildKey];
                        if (grandChildVal && typeof grandChildVal === "object") {
                          const item = parseItem(`rtdb_${nodeKey}_${pushKey}_${grandChildKey}`, grandChildVal, pushKey);
                          if (item) readingsMapRef.current.set(item.id, item);
                        }
                      });
                    }
                  });
                }
              });
              processAndSetReadings();
            }
          }
          setLoading(false);
        },
        (err) => {
          console.warn("RTDB Root Listener Warning:", err);
          setError(err.message);
          setLoading(false);
        }
      );
      unsubscribers.push(() => unsubRoot());
    } catch (e) {
      console.warn("Failed to subscribe to RTDB Root:", e);
    }

    // 2. Subscribe to Firestore root 'sensordata' collection
    try {
      const sensordataRef = collection(db, "sensordata");
      const unsubFirestore = onSnapshot(
        sensordataRef,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added" || change.type === "modified") {
              const data = change.doc.data();
              const id = change.doc.id;
              readingsMapRef.current.set(id, {
                id,
                device_id: data.device_id || "rpm_meter",
                count: Number(data.count ?? data.c ?? 0),
                rpm: Number(data.rpm ?? data.r ?? 0),
                reading_time: data.reading_time || data.time || new Date().toISOString(),
                created_at: data.created_at || data.time || new Date().toISOString(),
              });
            }
          });
          processAndSetReadings();
        },
        (err) => {
          console.warn("Firestore snapshot warning:", err);
        }
      );
      unsubscribers.push(unsubFirestore);
    } catch (e: any) {
      console.warn("Failed to subscribe to Firestore:", e);
    }

    const timeout = setTimeout(() => {
      if (mounted.current) {
        setLoading(false);
      }
    }, 2000);

    return () => {
      mounted.current = false;
      clearTimeout(timeout);
      unsubscribers.forEach((unsub) => {
        try {
          unsub();
        } catch (e) {}
      });
    };
  }, [processAndSetReadings]);

  const refetch = useCallback(() => {
    setLoading(true);
    processAndSetReadings();
  }, [processAndSetReadings]);

  return { readings, loading, error, lastUpdated, refetch };
}

export function useDeviceReadings(deviceId: string | null, limitCount = 100) {
  const { readings, loading, error, refetch } = useSensorData();

  const deviceReadings = readings
    .filter((r) => !deviceId || r.device_id === deviceId)
    .slice(0, limitCount);

  return { readings: deviceReadings, loading, error, refetch };
}
