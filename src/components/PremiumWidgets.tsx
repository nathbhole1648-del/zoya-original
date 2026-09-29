import React, { useState, useEffect } from "react";
import { Brain, Trash2, Plus, Bell, Calculator, ArrowRightLeft, Check, Sparkles } from "lucide-react";

// --- Types ---
export interface MemoryItem {
  id: string;
  key: string;
  value: string;
  description: string;
}

export interface AlertItem {
  id: string;
  title: string;
  time: string; // HH:MM 24-hr
  type: "alarm" | "reminder";
  triggered: boolean;
}

interface PremiumWidgetsProps {
  smartMemories: MemoryItem[];
  setSmartMemories: React.Dispatch<React.SetStateAction<MemoryItem[]>>;
  alerts: AlertItem[];
  setAlerts: React.Dispatch<React.SetStateAction<AlertItem[]>>;
  accentColor: string;
  gradient: string;
  showToast: (msg: string) => void;
}

export function PremiumWidgets({
  smartMemories,
  setSmartMemories,
  alerts,
  setAlerts,
  accentColor,
  gradient,
  showToast,
}: PremiumWidgetsProps) {
  const [activeSection, setActiveSection] = useState<"memory" | "alerts" | "calc">("memory");

  // --- Smart Memory Local State ---
  const [memKey, setMemKey] = useState("");
  const [memValue, setMemValue] = useState("");
  const [memDesc, setMemDesc] = useState("");

  // --- Alarms & Reminders Local State ---
  const [alertTitle, setAlertTitle] = useState("");
  const [alertTime, setAlertTime] = useState("");
  const [alertType, setAlertType] = useState<"alarm" | "reminder">("reminder");

  // --- Calculator & Converter Local State ---
  const [calcExpr, setCalcExpr] = useState("");
  const [calcResult, setCalcResult] = useState("");
  const [convertType, setConvertType] = useState<"temp" | "length" | "weight">("temp");
  const [convertVal, setConvertVal] = useState("");
  const [convertResult, setConvertResult] = useState("");

  // --- Handlers for Smart Memory ---
  const handleAddMemory = () => {
    if (!memKey.trim() || !memValue.trim()) {
      showToast("Please enter a key and value for Zoya's memory.");
      return;
    }
    const description = memDesc.trim() || `User prefers ${memKey} as ${memValue}.`;
    const newMem: MemoryItem = {
      id: `mem-${Date.now()}`,
      key: memKey.trim(),
      value: memValue.trim(),
      description,
    };
    setSmartMemories((prev) => [newMem, ...prev]);
    setMemKey("");
    setMemValue("");
    setMemDesc("");
    showToast(`🧠 Fact learned: "${description}"`);
  };

  const handleDeleteMemory = (id: string) => {
    setSmartMemories((prev) => prev.filter((m) => m.id !== id));
    showToast("Purged memory item.");
  };

  // --- Handlers for Alarms & Reminders ---
  const handleAddAlert = () => {
    if (!alertTitle.trim()) {
      showToast("Please provide a title for the alert.");
      return;
    }
    if (!alertTime) {
      showToast("Please select a time for the alert.");
      return;
    }
    const newAlert: AlertItem = {
      id: `alert-${Date.now()}`,
      title: alertTitle.trim(),
      time: alertTime,
      type: alertType,
      triggered: false,
    };
    setAlerts((prev) => [...prev, newAlert]);
    setAlertTitle("");
    setAlertTime("");
    showToast(`🔔 Set ${alertType} for ${alertTime}: "${alertTitle}"`);
  };

  const handleDeleteAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    showToast("Alert removed.");
  };

  // --- Calculator & Converter Logic ---
  const handleCalculate = () => {
    if (!calcExpr.trim()) return;
    try {
      // Safe mathematical expression evaluation
      // Matches only numbers, operators, decimals, spaces, and parenthesis to prevent script injection
      const sanitized = calcExpr.replace(/[^0-9+\-*/().\s]/g, "");
      // eslint-disable-next-line no-eval
      const result = eval(sanitized);
      if (result === undefined || isNaN(result)) {
        setCalcResult("Invalid Expression");
      } else {
        setCalcResult(String(result));
      }
    } catch (e) {
      setCalcResult("Evaluation Error");
    }
  };

  const handleConvert = () => {
    const val = parseFloat(convertVal);
    if (isNaN(val)) {
      setConvertResult("Invalid Input");
      return;
    }

    if (convertType === "temp") {
      // Celsius to Fahrenheit
      const f = (val * 9) / 5 + 32;
      setConvertResult(`${val}°C = ${f.toFixed(1)}°F`);
    } else if (convertType === "length") {
      // km to miles
      const mi = val * 0.621371;
      setConvertResult(`${val} km = ${mi.toFixed(2)} miles`);
    } else if (convertType === "weight") {
      // kg to lbs
      const lbs = val * 2.20462;
      setConvertResult(`${val} kg = ${lbs.toFixed(2)} lbs`);
    }
  };

  useEffect(() => {
    if (convertVal) handleConvert();
  }, [convertVal, convertType]);

  return (
    <div className="w-full mt-6 border-t border-white/10 pt-6">
      {/* Selector Subtabs */}
      <div className="flex items-center bg-black/35 rounded-2xl p-1 border border-white/5 mb-4">
        <button
          onClick={() => setActiveSection("memory")}
          className={`flex-1 py-2 text-[10px] uppercase font-mono tracking-wider font-bold rounded-xl transition ${
            activeSection === "memory"
              ? "bg-white/10 text-white shadow"
              : "opacity-45 hover:opacity-100 text-white"
          }`}
        >
          Memory
        </button>
        <button
          onClick={() => setActiveSection("alerts")}
          className={`flex-1 py-2 text-[10px] uppercase font-mono tracking-wider font-bold rounded-xl transition ${
            activeSection === "alerts"
              ? "bg-white/10 text-white shadow"
              : "opacity-45 hover:opacity-100 text-white"
          }`}
        >
          Alarms
        </button>
        <button
          onClick={() => setActiveSection("calc")}
          className={`flex-1 py-2 text-[10px] uppercase font-mono tracking-wider font-bold rounded-xl transition ${
            activeSection === "calc"
              ? "bg-white/10 text-white shadow"
              : "opacity-45 hover:opacity-100 text-white"
          }`}
        >
          Calc
        </button>
      </div>

      {/* --- SECTION: SMART MEMORY INDEX --- */}
      {activeSection === "memory" && (
        <div className="space-y-4">
          <div className="flex items-center gap-1.5">
            <Brain className="w-4 h-4" style={{ color: accentColor }} />
            <span className="text-xs font-bold uppercase tracking-wider font-mono opacity-60">Zoya Smart Memory</span>
          </div>

          {/* Quick Memory Form */}
          <div className="space-y-2 p-3 rounded-2xl bg-white/5 border border-white/5">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Key (e.g. food)"
                value={memKey}
                onChange={(e) => setMemKey(e.target.value)}
                className="bg-black/35 border border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/25"
              />
              <input
                type="text"
                placeholder="Value (e.g. Sushi)"
                value={memValue}
                onChange={(e) => setMemValue(e.target.value)}
                className="bg-black/35 border border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/25"
              />
            </div>
            <input
              type="text"
              placeholder="Descriptive sentence (Zoya remembers this)"
              value={memDesc}
              onChange={(e) => setMemDesc(e.target.value)}
              className="w-full bg-black/35 border border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/25"
            />
            <button
              onClick={handleAddMemory}
              className="w-full py-2 rounded-xl text-xs font-bold text-white shadow hover:scale-[1.01] active:scale-[0.99] transition"
              style={{ backgroundImage: `linear-gradient(to right, ${gradient})` }}
            >
              Learn Fact 🧠
            </button>
          </div>

          {/* Memory List */}
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {smartMemories.length === 0 ? (
              <p className="text-[10px] opacity-40 font-mono italic text-center py-2">Zoya has no recorded memory banks.</p>
            ) : (
              smartMemories.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition group">
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold font-mono uppercase opacity-75" style={{ color: accentColor }}>{m.key}</span>
                      <span className="text-[10px] opacity-40">•</span>
                      <span className="text-[10px] font-semibold truncate opacity-85">{m.value}</span>
                    </div>
                    <p className="text-[10px] opacity-50 truncate mt-0.5">{m.description}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteMemory(m.id)}
                    className="p-1 rounded bg-black/45 hover:bg-rose-500/20 text-rose-400 opacity-0 group-hover:opacity-100 transition duration-200"
                    title="Purge fact"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* --- SECTION: ALARMS & REMINDERS --- */}
      {activeSection === "alerts" && (
        <div className="space-y-4">
          <div className="flex items-center gap-1.5">
            <Bell className="w-4 h-4" style={{ color: accentColor }} />
            <span className="text-xs font-bold uppercase tracking-wider font-mono opacity-60">Alarms & Reminders</span>
          </div>

          {/* Quick Alert Form */}
          <div className="space-y-2 p-3 rounded-2xl bg-white/5 border border-white/5">
            <input
              type="text"
              placeholder="Reminder note (e.g. Drink water)"
              value={alertTitle}
              onChange={(e) => setAlertTitle(e.target.value)}
              className="w-full bg-black/35 border border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/25"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="time"
                value={alertTime}
                onChange={(e) => setAlertTime(e.target.value)}
                className="bg-black/35 border border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/25"
              />
              <select
                value={alertType}
                onChange={(e) => setAlertType(e.target.value as any)}
                className="bg-[#050508] border border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/25"
              >
                <option value="reminder">Reminder</option>
                <option value="alarm">Alarm</option>
              </select>
            </div>
            <button
              onClick={handleAddAlert}
              className="w-full py-2 rounded-xl text-xs font-bold text-white shadow hover:scale-[1.01] active:scale-[0.99] transition"
              style={{ backgroundImage: `linear-gradient(to right, ${gradient})` }}
            >
              Set Alert 🔔
            </button>
          </div>

          {/* Alerts List */}
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {alerts.length === 0 ? (
              <p className="text-[10px] opacity-40 font-mono italic text-center py-2">No active alert timers configured.</p>
            ) : (
              alerts.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition group">
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold" style={{ color: accentColor }}>{a.time}</span>
                      <span className={`text-[8px] uppercase tracking-widest font-mono font-black px-1.5 py-0.5 rounded ${
                        a.type === "alarm" ? "bg-rose-500/15 text-rose-400" : "bg-cyan-500/15 text-cyan-400"
                      }`}>
                        {a.type}
                      </span>
                    </div>
                    <p className="text-[10px] opacity-75 truncate mt-1">{a.title}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteAlert(a.id)}
                    className="p-1 rounded bg-black/45 hover:bg-rose-500/20 text-rose-400 opacity-0 group-hover:opacity-100 transition duration-200"
                    title="Remove alert"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* --- SECTION: CALCULATOR & CONVERTER --- */}
      {activeSection === "calc" && (
        <div className="space-y-4">
          <div className="flex items-center gap-1.5">
            <Calculator className="w-4 h-4" style={{ color: accentColor }} />
            <span className="text-xs font-bold uppercase tracking-wider font-mono opacity-60">Math & Converter</span>
          </div>

          {/* Mini Calculator */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-2">
            <span className="text-[9px] font-mono font-black uppercase opacity-40">Expressive Math Solver</span>
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Math (e.g. 23.5 * 1.05 - 12)"
                value={calcExpr}
                onChange={(e) => setCalcExpr(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCalculate()}
                className="flex-1 bg-black/35 border border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/25"
              />
              <button
                onClick={handleCalculate}
                className="px-3 rounded-xl text-xs font-bold bg-white/10 text-white hover:bg-white/15 transition"
              >
                =
              </button>
            </div>
            {calcResult && (
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-black/25 border border-white/5">
                <span className="text-[10px] font-mono opacity-40">Result:</span>
                <span className="text-xs font-mono font-bold" style={{ color: accentColor }}>{calcResult}</span>
              </div>
            )}
          </div>

          {/* Unit Converter */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-2">
            <span className="text-[9px] font-mono font-black uppercase opacity-40">Dimensional Converter</span>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Value..."
                value={convertVal}
                onChange={(e) => setConvertVal(e.target.value)}
                className="bg-black/35 border border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/25"
              />
              <select
                value={convertType}
                onChange={(e: any) => setConvertType(e.target.value)}
                className="bg-[#050508] border border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/25"
              >
                <option value="temp">°C to °F (Temp)</option>
                <option value="length">km to Miles (Dist)</option>
                <option value="weight">kg to lbs (Mass)</option>
              </select>
            </div>
            {convertResult && (
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-black/25 border border-white/5">
                <span className="text-[10px] font-mono opacity-40">Converted:</span>
                <span className="text-xs font-mono font-bold text-white">{convertResult}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
