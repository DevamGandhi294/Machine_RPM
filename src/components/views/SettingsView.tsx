import { useState, useEffect } from "react";
import { Radio, Clock, Code, Copy, Check, Play, Square, Database, Plus } from "lucide-react";
import { firebaseConfig } from "@/lib/firebase";
import { pushHistoricalReading } from "@/hooks/useSensorData";

export function SettingsView() {
  const [selectedDevice, setSelectedDevice] = useState("RPM1");
  const [customDevice, setCustomDevice] = useState("");
  const [intervalSec, setIntervalSec] = useState(5);
  const [isLogging, setIsLogging] = useState(false);
  const [loggedCount, setLoggedCount] = useState(0);
  const [lastLoggedMessage, setLastLoggedMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const activeDeviceName = customDevice.trim() || selectedDevice;
  const databaseUrl = firebaseConfig.databaseURL;

  // Auto logger interval effect
  useEffect(() => {
    if (!isLogging) return;

    const timer = setInterval(async () => {
      const rpmVal = Math.floor(Math.random() * 500 + 1200);
      const countVal = loggedCount + 1;
      const vibPeak = Number((Math.random() * 2 + 0.5).toFixed(2));
      const vibRms = Number((vibPeak * 0.707).toFixed(2));
      setLoggedCount((prev) => prev + 1);

      const ok = await pushHistoricalReading(activeDeviceName, countVal, rpmVal, undefined, {
        vib_peak_g: vibPeak,
        vib_rms_g: vibRms,
      });
      if (ok) {
        setLastLoggedMessage(`[${new Date().toLocaleTimeString()}] Pushed record to '${activeDeviceName}': ${rpmVal} RPM | Vib: ${vibPeak}g`);
      }
    }, intervalSec * 1000);

    return () => clearInterval(timer);
  }, [isLogging, intervalSec, activeDeviceName, loggedCount]);

  const handleManualPush = async () => {
    const rpmVal = Math.floor(Math.random() * 500 + 1200);
    const countVal = loggedCount + 1;
    const vibPeak = Number((Math.random() * 2 + 0.5).toFixed(2));
    const vibRms = Number((vibPeak * 0.707).toFixed(2));
    setLoggedCount((prev) => prev + 1);
    const ok = await pushHistoricalReading(activeDeviceName, countVal, rpmVal, undefined, {
      vib_peak_g: vibPeak,
      vib_rms_g: vibRms,
    });
    if (ok) {
      setLastLoggedMessage(`[${new Date().toLocaleTimeString()}] Manually pushed record to '${activeDeviceName}': ${rpmVal} RPM | Vib: ${vibPeak}g`);
      setTimeout(() => setLastLoggedMessage(null), 3000);
    }
  };

  const arduinoSnippet = `// ---------- Firebase Config for ESP8266 / ESP32 ----------
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>

#define FIREBASE_HOST "${databaseUrl.replace("https://", "")}"
#define DEVICE_NAME   "${activeDeviceName}"  // Collection / Node name: e.g. ${activeDeviceName}
#define POST_INTERVAL ${intervalSec * 1000}       // Store historical data every ${intervalSec} seconds

unsigned long lastPostTime = 0;
uint32_t totalCount = 0;

bool pushHistoricalData(uint32_t count, float rpm, float vibPeak, float vibRms) {
  if (WiFi.status() != WL_CONNECTED) return false;

  std::unique_ptr<BearSSL::WiFiClientSecure> client(new BearSSL::WiFiClientSecure);
  client->setInsecure();

  // POST appends a new unique push-ID entry under the device collection node (e.g. /${activeDeviceName}.json)
  String url = "https://" + String(FIREBASE_HOST) + "/" + String(DEVICE_NAME) + ".json";
  
  String body = "{\\"count\\":" + String(count) +
                ",\\"rpm\\":" + String(rpm, 1) +
                ",\\"vib_peak_g\\":" + String(vibPeak, 2) +
                ",\\"vib_rms_g\\":" + String(vibRms, 2) +
                ",\\"device_id\\":\\"" + String(DEVICE_NAME) + "\\"" +
                ",\\"time\\":\\"" + isoTime() + "\\"}";

  HTTPClient https;
  if (!https.begin(*client, url)) return false;

  https.addHeader("Content-Type", "application/json");
  int code = https.POST(body);
  https.end();

  Serial.printf("Firebase POST HTTP Code: %d  Data: %s\\n", code, body.c_str());
  return code > 0 && code < 400;
}

void loop() {
  if (millis() - lastPostTime >= POST_INTERVAL) {
    lastPostTime = millis();
    totalCount++;
    float currentRPM = readSensorRPM();
    float vibPeak = readVibPeak();
    float vibRMS = readVibRMS();
    pushHistoricalData(totalCount, currentRPM, vibPeak, vibRMS);
  }
}`;

  const copyText = () => {
    navigator.clipboard.writeText(arduinoSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Historical Data & Storage Settings</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Configure collection names per device, auto-store interval, and view historical logging
        </p>
      </div>

      {/* Historical Data Auto-Recorder */}
      <div className="bg-white/90 dark:bg-slate-900/50 backdrop-blur rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 space-y-4 shadow-sm dark:shadow-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Continuous Historical Data Recorder</h3>
          </div>
          {isLogging && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-1 rounded-full animate-pulse border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
              Recording every {intervalSec}s ({loggedCount} saved)
            </span>
          )}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Store historical RPM entries every few seconds under the selected device collection name (e.g. <code className="text-cyan-600 dark:text-cyan-400 font-mono text-xs font-semibold">{activeDeviceName}</code>).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Target Collection/Device */}
          <div>
            <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1 font-medium">Target Device Collection</label>
            <div className="flex gap-2">
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 focus:outline-none w-full font-medium"
              >
                <option value="RPM1">RPM1</option>
                <option value="rpm_meter">rpm_meter</option>
                <option value="RPM2">RPM2</option>
                <option value="RPM3">RPM3</option>
              </select>
            </div>
          </div>

          {/* Custom Device Name */}
          <div>
            <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1 font-medium">Custom Device Name (Optional)</label>
            <input
              type="text"
              value={customDevice}
              onChange={(e) => setCustomDevice(e.target.value)}
              placeholder="e.g. motor_sensor_1"
              className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 focus:outline-none w-full placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
            />
          </div>

          {/* Store Interval */}
          <div>
            <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1 flex items-center gap-1 font-medium">
              <Clock className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
              Recording Interval
            </label>
            <select
              value={intervalSec}
              onChange={(e) => setIntervalSec(Number(e.target.value))}
              className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-300 dark:border-slate-700 focus:border-cyan-500 focus:outline-none w-full font-medium"
            >
              <option value={1}>Every 1 Second</option>
              <option value={2}>Every 2 Seconds</option>
              <option value={5}>Every 5 Seconds</option>
              <option value={10}>Every 10 Seconds</option>
              <option value={30}>Every 30 Seconds</option>
            </select>
          </div>
        </div>

        {/* Start / Stop Controls */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={() => setIsLogging(!isLogging)}
            className={`flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-lg transition-all shadow-md ${
              isLogging
                ? "bg-rose-600 hover:bg-rose-500 text-white"
                : "bg-cyan-600 hover:bg-cyan-500 text-white"
            }`}
          >
            {isLogging ? <Square className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white" />}
            {isLogging ? "Stop Auto-Recorder" : "Start Auto-Recorder"}
          </button>

          <button
            onClick={handleManualPush}
            className="flex items-center gap-1.5 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            Store 1 Entry Now
          </button>
        </div>

        {lastLoggedMessage && (
          <p className="text-xs text-cyan-700 dark:text-cyan-400 font-mono bg-cyan-50 dark:bg-slate-950 p-2.5 rounded-lg border border-cyan-200 dark:border-slate-800 font-medium">
            {lastLoggedMessage}
          </p>
        )}
      </div>

      {/* ESP8266 Historical Logging Code Snippet */}
      <div className="bg-white/90 dark:bg-slate-900/50 backdrop-blur rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 space-y-4 shadow-sm dark:shadow-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">ESP8266 / ESP32 Historical Logging C++ Snippet</h3>
          </div>
          <button
            onClick={copyText}
            className="flex items-center gap-1.5 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 px-3 py-1.5 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 font-medium"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Upload this sketch to your microcontroller. It automatically appends a new historical entry to collection <code className="text-cyan-600 dark:text-cyan-400 font-mono text-xs font-semibold">{activeDeviceName}</code> every <code className="text-cyan-600 dark:text-cyan-400 font-mono text-xs font-semibold">{intervalSec}</code> seconds:
        </p>
        <pre className="bg-slate-950 rounded-lg p-4 border border-slate-800 text-xs text-slate-300 overflow-x-auto font-mono leading-relaxed">
{arduinoSnippet}
        </pre>
      </div>

      {/* Database Schema Info */}
      <div className="bg-white/90 dark:bg-slate-900/50 backdrop-blur rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 space-y-3 shadow-sm dark:shadow-none">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Firebase Storage Architecture</h3>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Device Collection Node</p>
            <p className="text-cyan-600 dark:text-cyan-400 font-mono font-bold">/{activeDeviceName}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Historical Record Strategy</p>
            <p className="text-emerald-600 dark:text-emerald-400 font-bold">Unique Push IDs / Timestamps</p>
          </div>
        </div>
      </div>
    </div>
  );
}
