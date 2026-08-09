import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDLLcSEg1HS_MvqjXLdnT7VgPOHx9rbiaA",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "machinerpm-2afec.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://machinerpm-2afec-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "machinerpm-2afec",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "machinerpm-2afec.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "158686228202",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:158686228202:web:c502ad4faf11ecbd9d7193",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-7Z1FJ3Q6HS",
};

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const rtdb = getDatabase(app);

export interface DeviceConfig {
  machine_id: string;
  is_storing: boolean;           // store data ON / OFF
  frequency_seconds: number;      // frequency in seconds after how much time to store from RTDB
  is_online: boolean;             // online / offline status
  machine_status: "running" | "idle" | "offline"; // machine status (running or not)
}

export interface SensorReading {
  id: string;
  device_id: string;
  count: number;
  rpm: number;
  reading_time: string;
  created_at: string;
  machine_start?: string;
  machine_end?: string;
  uptime?: string;
}

export type ReadingAggregation = {
  device_id: string;
  latest_rpm: number;
  latest_count: number;
  latest_time: string;
  avg_rpm: number;
  max_rpm: number;
  total_readings: number;
};
