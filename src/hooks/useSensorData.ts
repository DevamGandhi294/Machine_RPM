import { useEffect, useState, useCallback, useRef } from "react";
import { db, rtdb, type SensorReading, type DeviceConfig } from "@/lib/firebase";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  onSnapshot,
  collectionGroup
} from "firebase/firestore";
import {
  ref as dbRef,
  onValue,
  push,
  set as setRtdb
} from "firebase/database";

const lastStoreTimeMap = new Map<string, number>();
const knownDevices = new Set<string>();

/**
 * Pushes a new historical reading entry
 */
export async function pushHistoricalReading(
  deviceId: string,
  count: number,
  rpm: number,
  readingTime?: string,
  extraFields?: { machine_start?: string; machine_end?: string; uptime?: string; vib_peak_g?: number; vib_rms_g?: number }
) {
  const now = new Date();
  const timeStr = readingTime || `${now.toISOString().split("T")[0]} ${now.toTimeString().split(" ")[0]}`;
  const createdAt = now.toISOString();

  const payload: Omit<SensorReading, "id"> = {
    device_id: deviceId,
    count,
    rpm,
    vib_peak_g: extraFields?.vib_peak_g ?? 0,
    vib_rms_g: extraFields?.vib_rms_g ?? 0,
    reading_time: timeStr,
    created_at: createdAt,
    machine_start: extraFields?.machine_start || timeStr,
    machine_end: extraFields?.machine_end || timeStr,
    uptime: extraFields?.uptime || "0d 00:00:00",
  };

  try {
    // 1. Ensure parent document exists and store in batch document
    await storeReadingInFirestoreSubcollection(deviceId, payload);

    // 2. Update Realtime DB live node
    const rtdbRef = push(dbRef(rtdb, deviceId));
    await setRtdb(rtdbRef, { ...payload, time: timeStr });
    await setRtdb(dbRef(rtdb, deviceId), { ...payload, time: timeStr });

    return true;
  } catch (err) {
    console.warn(`Error pushing historical reading for ${deviceId}:`, err);
    return false;
  }
}

/**
 * Updates device document in Firestore "devices" collection WITHOUT last_updated field
 * Defaults for all 5 fields are only written when the document is first created —
 * writing them on every call would overwrite user-set values such as
 * frequency_seconds and is_storing (merge only protects fields absent from the payload).
 */
export async function updateDeviceConfigInFirestore(
  machineId: string,
  config: Partial<DeviceConfig>
) {
  try {
    const deviceRef = doc(db, "devices", machineId);

    // Existence is cached because syncToFirestore calls this on every reading
    if (!knownDevices.has(machineId)) {
      const snap = await getDoc(deviceRef);
      knownDevices.add(machineId);

      if (!snap.exists()) {
        await setDoc(deviceRef, {
          machine_id: machineId,
          machine_name: config.machine_name || machineId,
          device_id: config.device_id || machineId,
          location: config.location || "",
          is_storing: true,
          frequency_seconds: 5,
          is_online: true,
          machine_status: "idle",
          updated_at: new Date().toISOString(),
          ...config,
        });
        return true;
      }
    }

    await setDoc(
      deviceRef,
      {
        machine_id: machineId,
        updated_at: new Date().toISOString(),
        ...config,
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.warn(`Error updating device config for ${machineId}:`, err);
    return false;
  }
}

/**
 * Deletes machine document from Firestore 'devices' collection
 */
export async function deleteDeviceFromFirestore(machineId: string) {
  try {
    const deviceRef = doc(db, "devices", machineId);
    await deleteDoc(deviceRef);
    knownDevices.delete(machineId);
    return true;
  } catch (err) {
    console.warn(`Error deleting device config for ${machineId}:`, err);
    return false;
  }
}

/**
 * Stores readings in array inside batch documents in subcollection 'devices/{machineId}/sensordata'
 * Each document holds exactly up to 100 elements. Once full (100 elements), a new document is created.
 */
export async function storeReadingInFirestoreSubcollection(
  machineId: string,
  reading: Omit<SensorReading, "id">
) {
  try {
    const nowIso = new Date().toISOString();
    const readingItem: SensorReading = {
      id: `${machineId}_${Date.now()}`,
      ...reading,
      device_id: reading.device_id || machineId,
      machine_id: reading.machine_id || machineId,
      machine_name: reading.machine_name || machineId,
      created_at: reading.created_at || nowIso,
    };

    // 1. Ensure parent document devices/{machineId} exists in Firestore
    await updateDeviceConfigInFirestore(machineId, {
      is_online: true,
      machine_status: reading.rpm > 0 ? "running" : "idle",
    });

    // 2. Metadata document tracking current active batch index
    const metaRef = doc(db, "devices", machineId, "sensordata", "_meta");
    const metaSnap = await getDoc(metaRef);

    let activeBatchIndex = 1;
    if (metaSnap.exists()) {
      activeBatchIndex = Number(metaSnap.data()?.current_batch ?? 1);
    } else {
      await setDoc(metaRef, { current_batch: 1, created_at: nowIso });
    }

    let batchDocRef = doc(db, "devices", machineId, "sensordata", `batch_${activeBatchIndex}`);
    let batchSnap = await getDoc(batchDocRef);

    let readingsArray: SensorReading[] = [];
    if (batchSnap.exists()) {
      const data = batchSnap.data();
      readingsArray = Array.isArray(data.readings) ? data.readings : [];
    }

    // If active document array already has 100 elements, create a NEW batch document (batch_N+1)
    if (readingsArray.length >= 100) {
      activeBatchIndex += 1;
      await setDoc(metaRef, { current_batch: activeBatchIndex, updated_at: nowIso });
      batchDocRef = doc(db, "devices", machineId, "sensordata", `batch_${activeBatchIndex}`);
      readingsArray = [];
    }

    // Append new reading to array and save document
    const updatedArray = [readingItem, ...readingsArray];
    await setDoc(batchDocRef, {
      batch_index: activeBatchIndex,
      count: updatedArray.length,
      updated_at: nowIso,
      readings: updatedArray,
    });

    return true;
  } catch (err) {
    console.warn(`Error storing reading in 100-element batch document for ${machineId}:`, err);
    return false;
  }
}

/**
 * Hook to read devices list from Firestore collection 'devices'
 */
export function useDevices() {
  const [devices, setDevices] = useState<DeviceConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const devicesRef = collection(db, "devices");
    const unsub = onSnapshot(
      devicesRef,
      (snapshot) => {
        const list: DeviceConfig[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          const mId = docSnap.id || d.machine_id;
          list.push({
            machine_id: mId,
            machine_name: d.machine_name || d.name || mId,
            device_id: d.device_id || mId,
            location: d.location || "",
            is_storing: Boolean(d.is_storing ?? true),
            frequency_seconds: Number(d.frequency_seconds ?? 5),
            is_online: Boolean(d.is_online ?? true),
            machine_status: d.machine_status || "idle",
            updated_at: d.updated_at,
          });
        });
        setDevices(list);
        setLoading(false);
      },
      (err) => {
        console.warn("Firestore devices snapshot warning:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return { devices, loading };
}

export function useSensorData(refreshMs = 10000) {
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const mounted = useRef(true);

  const readingsMapRef = useRef<Map<string, SensorReading>>(new Map());
  const deviceConfigsRef = useRef<Map<string, DeviceConfig>>(new Map());

  useEffect(() => {
    const devicesRef = collection(db, "devices");
    const unsub = onSnapshot(devicesRef, (snapshot) => {
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const mId = docSnap.id || d.machine_id;
        const configObj: DeviceConfig = {
          machine_id: mId,
          machine_name: d.machine_name || d.name || mId,
          device_id: d.device_id || mId,
          location: d.location || "",
          is_storing: Boolean(d.is_storing ?? true),
          frequency_seconds: Number(d.frequency_seconds ?? 5),
          is_online: Boolean(d.is_online ?? true),
          machine_status: d.machine_status || "idle",
          updated_at: d.updated_at,
        };
        deviceConfigsRef.current.set(mId, configObj);
      });
    });
    return () => unsub();
  }, []);

  const processAndSetReadings = useCallback(() => {
    if (!mounted.current) return;
    const configsMap = deviceConfigsRef.current;
    const configsList = Array.from(configsMap.values());

    const all = Array.from(readingsMapRef.current.values()).map((r) => {
      const matched = configsList.find(
        (c) => c.device_id === r.device_id || c.machine_id === r.device_id || c.machine_id === r.machine_id
      );
      if (matched) {
        return {
          ...r,
          machine_id: matched.machine_id,
          machine_name: matched.machine_name || matched.machine_id,
        };
      }
      return r;
    });

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

    const devId = val.device_id || defaultDeviceId;
    const count = Number(val.count ?? val.c ?? 0);
    const rpm = Number(val.rpm ?? val.r ?? 0);
    const vibPeakG = Number(val.vib_peak_g ?? val.vib_peak ?? val.v_peak ?? 0);
    const vibRmsG = Number(val.vib_rms_g ?? val.vib_rms ?? val.v_rms ?? 0);
    const rawTime = val.time || val.reading_time || val.created_at;

    let readingTime = typeof rawTime === "string" ? rawTime : new Date().toLocaleString();
    let createdAt = typeof rawTime === "string" && rawTime.includes("-") ? rawTime : new Date().toISOString();

    // Match connected machine by device_id or machine_id
    const matchedConfig = Array.from(deviceConfigsRef.current.values()).find(
      (c) => c.device_id === devId || c.machine_id === devId
    );

    return {
      id: key,
      device_id: devId,
      machine_id: matchedConfig?.machine_id || devId,
      machine_name: matchedConfig?.machine_name || matchedConfig?.machine_id || devId,
      count,
      rpm,
      vib_peak_g: vibPeakG,
      vib_rms_g: vibRmsG,
      reading_time: readingTime,
      created_at: createdAt,
      machine_start: val.machine_start || undefined,
      machine_end: val.machine_end || undefined,
      uptime: val.uptime || undefined,
    };
  };

  const syncToFirestore = async (item: SensorReading) => {
    const machineId = item.device_id;
    const now = Date.now();
    const config = deviceConfigsRef.current.get(machineId) || {
      machine_id: machineId,
      is_storing: true,
      frequency_seconds: 5,
      is_online: true,
      machine_status: item.rpm > 0 ? "running" : "idle",
    };

    const isRunning = item.rpm > 0 ? "running" : "idle";

    // 1. Ensure devices/{machineId} document exists with all 5 fields
    await updateDeviceConfigInFirestore(machineId, {
      is_online: true,
      machine_status: isRunning,
    });

    // 2. Check if is_storing ON and frequency interval passed
    if (config.is_storing) {
      const lastStored = lastStoreTimeMap.get(machineId) || 0;
      const freqMs = (config.frequency_seconds || 5) * 1000;

      if (now - lastStored >= freqMs) {
        lastStoreTimeMap.set(machineId, now);
        await storeReadingInFirestoreSubcollection(machineId, {
          device_id: machineId,
          count: item.count,
          rpm: item.rpm,
          vib_peak_g: item.vib_peak_g ?? 0,
          vib_rms_g: item.vib_rms_g ?? 0,
          reading_time: item.reading_time,
          created_at: item.created_at,
          machine_start: item.machine_start,
          machine_end: item.machine_end,
          uptime: item.uptime,
        });
      }
    }
  };

  useEffect(() => {
    mounted.current = true;
    setLoading(true);

    const unsubscribers: Array<() => void> = [];

    // 1. Realtime DB Root listener for live stream
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

                if ("count" in nodeVal || "rpm" in nodeVal || "time" in nodeVal || "uptime" in nodeVal || "vib_peak_g" in nodeVal) {
                  const item = parseItem(`rtdb_${nodeKey}`, nodeVal, nodeKey);
                  if (item) {
                    readingsMapRef.current.set(item.id, item);
                    syncToFirestore(item);
                  }
                } else {
                  Object.keys(nodeVal).forEach((pushKey) => {
                    const childVal = nodeVal[pushKey];
                    if (!childVal || typeof childVal !== "object") return;

                    if ("count" in childVal || "rpm" in childVal || "time" in childVal || "uptime" in childVal || "vib_peak_g" in childVal) {
                      const item = parseItem(`rtdb_${nodeKey}_${pushKey}`, childVal, nodeKey);
                      if (item) {
                        readingsMapRef.current.set(item.id, item);
                        syncToFirestore(item);
                      }
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

    // 2. Subscribe to Firestore batch documents in subcollection 'sensordata'
    try {
      const sensordataGroupRef = collectionGroup(db, "sensordata");
      const unsubFirestoreGroup = onSnapshot(
        sensordataGroupRef,
        (snapshot) => {
          snapshot.forEach((docSnap) => {
            if (docSnap.id === "_meta") return;
            const data = docSnap.data();

            if (Array.isArray(data.readings)) {
              data.readings.forEach((r: any, idx: number) => {
                const id = r.id || `${docSnap.id}_${idx}`;
                readingsMapRef.current.set(id, {
                  id,
                  device_id: r.device_id || "RPM1",
                  count: Number(r.count ?? 0),
                  rpm: Number(r.rpm ?? 0),
                  vib_peak_g: Number(r.vib_peak_g ?? r.vib_peak ?? 0),
                  vib_rms_g: Number(r.vib_rms_g ?? r.vib_rms ?? 0),
                  reading_time: r.reading_time || r.time || new Date().toISOString(),
                  created_at: r.created_at || r.time || new Date().toISOString(),
                  machine_start: r.machine_start || undefined,
                  machine_end: r.machine_end || undefined,
                  uptime: r.uptime || undefined,
                });
              });
            } else if ("count" in data || "rpm" in data || "time" in data) {
              const id = docSnap.id;
              readingsMapRef.current.set(id, {
                id,
                device_id: data.device_id || "RPM1",
                count: Number(data.count ?? 0),
                rpm: Number(data.rpm ?? 0),
                vib_peak_g: Number(data.vib_peak_g ?? data.vib_peak ?? 0),
                vib_rms_g: Number(data.vib_rms_g ?? data.vib_rms ?? 0),
                reading_time: data.reading_time || data.time || new Date().toISOString(),
                created_at: data.created_at || data.time || new Date().toISOString(),
                machine_start: data.machine_start || undefined,
                machine_end: data.machine_end || undefined,
                uptime: data.uptime || undefined,
              });
            }
          });
          processAndSetReadings();
        },
        (err) => {
          console.warn("Firestore collectionGroup snapshot warning:", err);
        }
      );
      unsubscribers.push(unsubFirestoreGroup);
    } catch (e: any) {
      console.warn("Failed to subscribe to collectionGroup sensordata:", e);
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
