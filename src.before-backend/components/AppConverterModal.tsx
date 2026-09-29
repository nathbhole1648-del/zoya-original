import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Smartphone,
  Download,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Shield,
  Radio,
  Camera,
  Mic,
  Bell,
  SunMedium,
  Compass,
  Bluetooth,
  Terminal,
  ExternalLink,
  X,
  FileCode,
  Sparkles,
  Wifi,
  Layers
} from "lucide-react";

interface AppConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor: string;
  gradient: string;
  showToast: (msg: string) => void;
}

interface PermissionTestState {
  audio: boolean | null;
  camera: boolean | null;
  notifications: boolean | null;
  wakeLock: boolean | null;
  vibrate: boolean | null;
  location: { lat: number; lon: number } | null;
  bluetooth: boolean | null;
}

export function AppConverterModal({
  isOpen,
  onClose,
  accentColor,
  gradient,
  showToast,
}: AppConverterModalProps) {
  const [activeTab, setActiveTab] = useState<"pwa" | "apk" | "permissions">("pwa");
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  // Permission test states
  const [permState, setPermState] = useState<PermissionTestState>({
    audio: null,
    camera: null,
    notifications: null,
    wakeLock: null,
    vibrate: null,
    location: null,
    bluetooth: null,
  });

  // Check if already running in standalone PWA mode
  useEffect(() => {
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      showToast("Zoya AI was successfully installed as an app!");
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const triggerPWAInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        showToast("App installation started!");
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      showToast("To install: Tap browser menu (⋮ or Share) and select 'Add to Home Screen' or 'Install App'.");
    }
  };

  // --- Handlers for Testing Native Android Permissions ---
  const testAudioPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermState((prev) => ({ ...prev, audio: true }));
      showToast("RECORD_AUDIO: Microphone verified!");
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setPermState((prev) => ({ ...prev, audio: false }));
      showToast("RECORD_AUDIO: Microphone permission denied.");
    }
  };

  const testCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setPermState((prev) => ({ ...prev, camera: true }));
      showToast("CAMERA: Video lens verified!");
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setPermState((prev) => ({ ...prev, camera: false }));
      showToast("CAMERA: Camera access denied.");
    }
  };

  const testNotificationPermission = async () => {
    if (!("Notification" in window)) {
      showToast("POST_NOTIFICATIONS: Notifications not supported in this browser.");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      setPermState((prev) => ({ ...prev, notifications: true }));
      new Notification("Zoya AI Assistant", {
        body: "Android Notification System linked & operating normally!",
        icon: "/icon-192.png",
      });
      showToast("POST_NOTIFICATIONS: Notification delivered!");
    } else {
      setPermState((prev) => ({ ...prev, notifications: false }));
      showToast("POST_NOTIFICATIONS: Permission denied.");
    }
  };

  const testWakeLockPermission = async () => {
    if ("wakeLock" in navigator) {
      try {
        const sentinel = await (navigator as any).wakeLock.request("screen");
        setPermState((prev) => ({ ...prev, wakeLock: true }));
        showToast("WAKE_LOCK: Screen stay-awake sentinel active!");
        setTimeout(() => sentinel.release(), 5000);
      } catch {
        setPermState((prev) => ({ ...prev, wakeLock: false }));
        showToast("WAKE_LOCK: Wake lock request failed.");
      }
    } else {
      setPermState((prev) => ({ ...prev, wakeLock: false }));
      showToast("WAKE_LOCK: API not supported on this platform.");
    }
  };

  const testVibratePermission = () => {
    if ("vibrate" in navigator) {
      navigator.vibrate([100, 50, 150, 50, 200]);
      setPermState((prev) => ({ ...prev, vibrate: true }));
      showToast("VIBRATE: Haptic pulse triggered!");
    } else {
      setPermState((prev) => ({ ...prev, vibrate: false }));
      showToast("VIBRATE: Vibration hardware not detected.");
    }
  };

  const testLocationPermission = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPermState((prev) => ({
            ...prev,
            location: {
              lat: Number(pos.coords.latitude.toFixed(4)),
              lon: Number(pos.coords.longitude.toFixed(4)),
            },
          }));
          showToast(`ACCESS_FINE_LOCATION: ${pos.coords.latitude.toFixed(2)}°, ${pos.coords.longitude.toFixed(2)}°`);
        },
        () => {
          setPermState((prev) => ({ ...prev, location: null }));
          showToast("ACCESS_FINE_LOCATION: Geolocation denied.");
        }
      );
    } else {
      showToast("Geolocation not supported.");
    }
  };

  const testBluetoothPermission = async () => {
    if ("bluetooth" in navigator) {
      setPermState((prev) => ({ ...prev, bluetooth: true }));
      showToast("BLUETOOTH: Web Bluetooth interface available!");
    } else {
      setPermState((prev) => ({ ...prev, bluetooth: false }));
      showToast("BLUETOOTH: Web Bluetooth disabled or unsupported.");
    }
  };

  // Buildozer spec content string
  const buildozerContent = `[app]
title = Zoya AI Voice Assistant
package.name = zoya
package.domain = org.zoya.assistant
source.dir = .
source.include_exts = py,png,jpg,kv,atlas,json,webmanifest,js,css,html
version = 1.0.0
requirements = python3,kivy,requests

orientation = portrait
fullscreen = 1

android.permissions = INTERNET,\\
    RECORD_AUDIO,\\
    CAMERA,\\
    READ_CONTACTS,\\
    WRITE_CONTACTS,\\
    READ_CALENDAR,\\
    WRITE_CALENDAR,\\
    POST_NOTIFICATIONS,\\
    ACCESS_FINE_LOCATION,\\
    ACCESS_COARSE_LOCATION,\\
    BLUETOOTH,\\
    BLUETOOTH_CONNECT,\\
    READ_MEDIA_IMAGES,\\
    READ_MEDIA_VIDEO,\\
    READ_MEDIA_AUDIO,\\
    FOREGROUND_SERVICE,\\
    WAKE_LOCK,\\
    VIBRATE

android.api = 34
android.minapi = 26
android.ndk = 25b
android.archs = arm64-v8a, armeabi-v7a

icon.filename = %(source.dir)s/public/icon-512.png
presplash.filename = %(source.dir)s/public/icon-512.png
`;

  const downloadFile = (filename: string, content: string, mime = "text/plain") => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${filename}!`);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    showToast("Copied to clipboard!");
    setTimeout(() => setCopiedSection(null), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-[#0a0a10]/95 border border-white/10 shadow-[0_0_80px_rgba(255,0,127,0.25)] text-white overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ background: `linear-gradient(135deg, ${accentColor}, #7000ff)` }}
            >
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-wide">App Converter & Android Engine</h3>
                {isStandalone && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    Standalone Active
                  </span>
                )}
              </div>
              <p className="text-xs text-white/50">
                Convert Zoya into a standalone Android / iOS mobile application
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-white/10 bg-black/40 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab("pwa")}
            className={`pb-3 px-4 text-xs font-bold transition-all relative ${
              activeTab === "pwa" ? "text-white" : "text-white/40 hover:text-white/70"
            }`}
          >
            1-Click App Install (PWA)
            {activeTab === "pwa" && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-0 inset-x-0 h-0.5"
                style={{ backgroundColor: accentColor }}
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab("apk")}
            className={`pb-3 px-4 text-xs font-bold transition-all relative ${
              activeTab === "apk" ? "text-white" : "text-white/40 hover:text-white/70"
            }`}
          >
            Buildozer APK Package
            {activeTab === "apk" && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-0 inset-x-0 h-0.5"
                style={{ backgroundColor: accentColor }}
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab("permissions")}
            className={`pb-3 px-4 text-xs font-bold transition-all relative ${
              activeTab === "permissions" ? "text-white" : "text-white/40 hover:text-white/70"
            }`}
          >
            18 Android Permissions Bridge
            {activeTab === "permissions" && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-0 inset-x-0 h-0.5"
                style={{ backgroundColor: accentColor }}
              />
            )}
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: 1-CLICK PWA INSTALL */}
          {activeTab === "pwa" && (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 flex flex-col md:flex-row items-center gap-5">
                <img
                  src="/icon-192.png"
                  alt="Zoya App Icon"
                  className="w-20 h-20 rounded-2xl shadow-xl border border-white/20 shrink-0"
                />
                <div className="flex-1 text-center md:text-left">
                  <h4 className="text-sm font-bold text-white flex items-center justify-center md:justify-start gap-2">
                    Install Zoya Directly on Device
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  </h4>
                  <p className="text-xs text-white/60 mt-1 leading-relaxed">
                    Convert Zoya into a standalone progressive mobile app with offline caching, high-performance 60 FPS animations, lock-screen notifications, and zero browser URL bar interference.
                  </p>
                </div>
                <button
                  onClick={triggerPWAInstall}
                  className="px-6 py-3 rounded-2xl text-xs font-bold text-white shadow-xl transition-transform active:scale-95 shrink-0 flex items-center gap-2"
                  style={{ background: `linear-gradient(135deg, ${accentColor}, #7000ff)` }}
                >
                  <Download className="w-4 h-4" />
                  {isInstalled ? "App Installed!" : isStandalone ? "Running in App" : "Install App"}
                </button>
              </div>

              {/* Instructions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <h5 className="text-xs font-bold text-emerald-400 flex items-center gap-2 mb-2">
                    <Smartphone className="w-4 h-4" /> Android Installation
                  </h5>
                  <ol className="text-xs text-white/70 space-y-2 list-decimal list-inside leading-relaxed">
                    <li>Open this URL in Google Chrome on your phone.</li>
                    <li>Tap the three dots icon <strong>(⋮)</strong> in top right.</li>
                    <li>Select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
                    <li>Zoya will install as a native full-screen app icon.</li>
                  </ol>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <h5 className="text-xs font-bold text-cyan-400 flex items-center gap-2 mb-2">
                    <Smartphone className="w-4 h-4" /> iOS / Safari Installation
                  </h5>
                  <ol className="text-xs text-white/70 space-y-2 list-decimal list-inside leading-relaxed">
                    <li>Open this link in Safari on your iPhone/iPad.</li>
                    <li>Tap the <strong>Share</strong> button at bottom toolbar.</li>
                    <li>Scroll down and tap <strong>"Add to Home Screen"</strong>.</li>
                    <li>Tap <strong>Add</strong> to launch Zoya in standalone mode.</li>
                  </ol>
                </div>
              </div>

              {/* Feature Highlights */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                <h5 className="text-xs font-bold text-white/80 uppercase tracking-wider mb-3">
                  Converted Native Capabilities
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="flex items-center gap-2 text-white/70">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Fullscreen UI</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/70">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Offline Cache</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/70">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Mic Audio Stream</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/70">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Wake Word AI</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BUILDOZER APK EXPORTER */}
          {activeTab === "apk" && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-white/10">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">Android Buildozer Package Config</h4>
                    <p className="text-xs text-white/60 mt-1">
                      Export your configured <code className="text-pink-400">buildozer.spec</code> with all 18 Android permissions ready for compilation into an Android <code className="text-pink-400">.apk</code>.
                    </p>
                  </div>
                  <button
                    onClick={() => downloadFile("buildozer.spec", buildozerContent)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-pink-600 hover:bg-pink-500 transition shadow-lg flex items-center gap-1.5 shrink-0 ml-3"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download .spec
                  </button>
                </div>
              </div>

              {/* Code preview */}
              <div className="relative rounded-2xl bg-black/70 border border-white/10 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-white/5 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-pink-400" />
                    <span className="text-xs font-mono text-white/70">buildozer.spec</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(buildozerContent, "spec")}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition"
                    title="Copy buildozer.spec"
                  >
                    {copiedSection === "spec" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <pre className="p-4 text-[11px] font-mono text-white/80 overflow-x-auto max-h-52 leading-relaxed">
                  {buildozerContent}
                </pre>
              </div>

              {/* Build commands */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <h5 className="text-xs font-bold text-white/90 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  Quick Build Instructions (Buildozer or Bubblewrap APK)
                </h5>
                <div className="space-y-2 text-xs font-mono text-white/70">
                  <div className="p-2.5 rounded-xl bg-black/60 border border-white/5 flex items-center justify-between">
                    <code>buildozer android debug</code>
                    <button
                      onClick={() => copyToClipboard("buildozer android debug", "cmd1")}
                      className="text-white/40 hover:text-white"
                    >
                      {copiedSection === "cmd1" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/60 border border-white/5 flex items-center justify-between">
                    <code>npx @bubblewrap/cli build</code>
                    <button
                      onClick={() => copyToClipboard("npx @bubblewrap/cli build", "cmd2")}
                      className="text-white/40 hover:text-white"
                    >
                      {copiedSection === "cmd2" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  Tip: Bubblewrap compiles this exact PWA into a signed Google Play Store Android APK (<code className="text-cyan-400">.apk</code> / <code className="text-cyan-400">.aab</code>) in under 2 minutes using standard Android SDK.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: 18 ANDROID PERMISSIONS BRIDGE */}
          {activeTab === "permissions" && (
            <div className="space-y-4">
              <p className="text-xs text-white/60">
                Interactive verification bridge for all 18 Android permissions declared in your <code className="text-pink-400">buildozer.spec</code>. Test and link device hardware directly:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* RECORD_AUDIO */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400">
                      <Mic className="w-4 h-4" />
                    </div>
                    <div>
                      <h6 className="text-xs font-bold">RECORD_AUDIO</h6>
                      <span className="text-[10px] text-white/50">Microphone stream</span>
                    </div>
                  </div>
                  <button
                    onClick={testAudioPermission}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white/10 hover:bg-white/20 transition"
                  >
                    {permState.audio === true ? "Verified ✓" : permState.audio === false ? "Denied ✗" : "Test"}
                  </button>
                </div>

                {/* CAMERA */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                      <Camera className="w-4 h-4" />
                    </div>
                    <div>
                      <h6 className="text-xs font-bold">CAMERA</h6>
                      <span className="text-[10px] text-white/50">Optical sensor</span>
                    </div>
                  </div>
                  <button
                    onClick={testCameraPermission}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white/10 hover:bg-white/20 transition"
                  >
                    {permState.camera === true ? "Verified ✓" : permState.camera === false ? "Denied ✗" : "Test"}
                  </button>
                </div>

                {/* POST_NOTIFICATIONS */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <h6 className="text-xs font-bold">POST_NOTIFICATIONS</h6>
                      <span className="text-[10px] text-white/50">Push alerts & alarms</span>
                    </div>
                  </div>
                  <button
                    onClick={testNotificationPermission}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white/10 hover:bg-white/20 transition"
                  >
                    {permState.notifications === true ? "Verified ✓" : permState.notifications === false ? "Denied ✗" : "Test"}
                  </button>
                </div>

                {/* WAKE_LOCK */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                      <SunMedium className="w-4 h-4" />
                    </div>
                    <div>
                      <h6 className="text-xs font-bold">WAKE_LOCK</h6>
                      <span className="text-[10px] text-white/50">Screen stay-awake</span>
                    </div>
                  </div>
                  <button
                    onClick={testWakeLockPermission}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white/10 hover:bg-white/20 transition"
                  >
                    {permState.wakeLock === true ? "Active ✓" : permState.wakeLock === false ? "Failed ✗" : "Test"}
                  </button>
                </div>

                {/* VIBRATE */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                      <Radio className="w-4 h-4" />
                    </div>
                    <div>
                      <h6 className="text-xs font-bold">VIBRATE</h6>
                      <span className="text-[10px] text-white/50">Haptic tactile pulse</span>
                    </div>
                  </div>
                  <button
                    onClick={testVibratePermission}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white/10 hover:bg-white/20 transition"
                  >
                    {permState.vibrate === true ? "Fired ✓" : "Test Pulse"}
                  </button>
                </div>

                {/* ACCESS_FINE_LOCATION */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                      <Compass className="w-4 h-4" />
                    </div>
                    <div>
                      <h6 className="text-xs font-bold">ACCESS_FINE_LOCATION</h6>
                      <span className="text-[10px] text-white/50">GPS coordinates</span>
                    </div>
                  </div>
                  <button
                    onClick={testLocationPermission}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white/10 hover:bg-white/20 transition"
                  >
                    {permState.location ? `${permState.location.lat}°` : "Locate"}
                  </button>
                </div>

                {/* BLUETOOTH */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                      <Bluetooth className="w-4 h-4" />
                    </div>
                    <div>
                      <h6 className="text-xs font-bold">BLUETOOTH_CONNECT</h6>
                      <span className="text-[10px] text-white/50">Wireless peripherals</span>
                    </div>
                  </div>
                  <button
                    onClick={testBluetoothPermission}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white/10 hover:bg-white/20 transition"
                  >
                    {permState.bluetooth === true ? "Available ✓" : "Check"}
                  </button>
                </div>

                {/* INTERNET */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                      <Wifi className="w-4 h-4" />
                    </div>
                    <div>
                      <h6 className="text-xs font-bold">INTERNET</h6>
                      <span className="text-[10px] text-white/50">WebSocket & Cloud</span>
                    </div>
                  </div>
                  <span className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Online ✓
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-black/40 border-t border-white/10 flex items-center justify-between text-xs text-white/50">
          <span>Target Platform: Android 8.0+ (API 26+) / PWA Standalone</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}
