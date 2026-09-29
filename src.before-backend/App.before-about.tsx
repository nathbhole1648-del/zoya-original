/**
 * Zoya Premium AI Voice & Multimodal Workspace
 * A futuristic glassmorphism assistant interface featuring voice stream, chat terminal,
 * user profiles, PDF/image analytics, background wake words, dictation, and accent color tuning.
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Power,
  Mic,
  MicOff,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Globe,
  Sparkles,
  Volume2,
  VolumeX,
  Clock,
  CheckCircle,
  HelpCircle,
  Code,
  Settings,
  User,
  Image as ImageIcon,
  FileText,
  Camera,
  Copy,
  Share2,
  Download,
  Trash2,
  Search,
  Menu,
  X,
  Moon,
  Sun,
  Send,
  Wifi,
  WifiOff,
  ChevronRight,
  Paperclip,
  Check,
  Smartphone
} from "lucide-react";
import { AudioRecorder, AudioPlayer } from "./utils/audioStreamer";
import { PremiumWidgets, MemoryItem, AlertItem } from "./components/PremiumWidgets";
import { ZoyaAvatar } from "./components/ZoyaAvatar";
import { AppConverterModal } from "./components/AppConverterModal";

// --- Types & Interfaces ---
type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";
type VoiceState = "idle" | "listening" | "speaking";
type AIPersonality = "Friendly" | "Professional" | "Romantic" | "Funny";
type AccentColor = "magenta" | "cyan" | "purple" | "emerald";

interface Message {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: string;
  file?: {
    name: string;
    url: string;
    type: string;
  };
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  timestamp: string;
  personality: AIPersonality;
  language: "English" | "Hindi";
}

interface ToolCallLog {
  id: string;
  name: string;
  args: any;
  status: "executing" | "success" | "failed";
  timestamp: string;
  siteName?: string;
  url?: string;
}

interface PendingAction {
  id: string;
  name: string;
  args: any;
  url: string;
  siteName: string;
}

interface UserProfile {
  nickname: string;
  accent: AccentColor;
  voice: string;
  personality: AIPersonality;
  language: "English" | "Hindi";
  voiceSpeed: number;
  theme: "dark" | "light";
  wakeWordEnabled: boolean;
  handsFree: boolean;
}

// --- Accent Palette ---
const ACCENTS = {
  magenta: {
    hex: "#ff007f",
    bg: "bg-[#ff007f]",
    border: "border-[#ff007f]",
    text: "text-[#ff007f]",
    glow: "shadow-[0_0_30px_rgba(255,0,127,0.35)]",
    gradient: "from-[#ff007f] to-[#7000ff]"
  },
  cyan: {
    hex: "#00f2ff",
    bg: "bg-[#00f2ff]",
    border: "border-[#00f2ff]",
    text: "text-[#00f2ff]",
    glow: "shadow-[0_0_30px_rgba(0,242,255,0.35)]",
    gradient: "from-[#00f2ff] to-[#0072ff]"
  },
  purple: {
    hex: "#7000ff",
    bg: "bg-[#7000ff]",
    border: "border-[#7000ff]",
    text: "text-[#7000ff]",
    glow: "shadow-[0_0_30px_rgba(112,0,255,0.35)]",
    gradient: "from-[#7000ff] to-[#ff007f]"
  },
  emerald: {
    hex: "#10b981",
    bg: "bg-[#10b981]",
    border: "border-[#10b981]",
    text: "text-[#10b981]",
    glow: "shadow-[0_0_30px_rgba(16,185,129,0.35)]",
    gradient: "from-[#10b981] to-[#059669]"
  }
};

export default function App() {
  // --- Startup & Offline States ---
   const [isStarting, setIsStarting] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // --- Profile & Custom Settings ---
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem("zoya_user_settings");
    const explicitLang = localStorage.getItem("zoya_explicit_lang");
    
if (saved) {
      try {
const parsed = JSON.parse(saved);
        if (explicitLang !== "true") {
          parsed.language = "Hindi";
        }
        return {
          nickname: "Darling",
          accent: "magenta",
          voice: "Aoede",
          personality: "Friendly",
          language: "Hindi",
          voiceSpeed: 1.0,
          theme: "dark",
          wakeWordEnabled: true,          handsFree: true,
          ...parsed
        };
      } catch (e) {
        // use default
      }
    }
    return {
      nickname: "Darling",
      accent: "magenta",
      voice: "Aoede",
      personality: "Friendly",
      language: "Hindi",
      voiceSpeed: 1.0,
      theme: "dark",
      wakeWordEnabled: true,
      handsFree: true
    };
  });

  const pal = ACCENTS[profile.accent];

  // --- Audio / Voice State ---
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [speakerLevel, setSpeakerLevel] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isDictating, setIsDictating] = useState(false);

  // --- Microphone Device Selection & Diagnostic ---
  const [selectedMicId, setSelectedMicId] = useState<string>(() => {
    return localStorage.getItem("zoya_selected_mic_id") || "";
  });
  const [availableMics, setAvailableMics] = useState<MediaDeviceInfo[]>([]);
  const [isMicTesting, setIsMicTesting] = useState(false);
  const [micTestLevel, setMicTestLevel] = useState(0);

  const refreshMicDevices = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === "audioinput");
      setAvailableMics(audioInputs);
    } catch (e) {
      console.warn("Could not enumerate audio input devices:", e);
    }
  };

  useEffect(() => {
    refreshMicDevices();
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", refreshMicDevices);
      return () => {
        navigator.mediaDevices.removeEventListener("devicechange", refreshMicDevices);
      };
    }
  }, []);

  const testMicrophoneInput = async () => {
    if (isMicTesting) return;
    setIsMicTesting(true);
    setMicTestLevel(0);
    showToast("Testing microphone input for 6 seconds...");

    try {
      const testRecorder = new AudioRecorder(() => {});
      await testRecorder.start(selectedMicId || undefined);

      let count = 0;
      const interval = setInterval(() => {
        const vol = testRecorder.getVolume();
        setMicTestLevel(vol);
        count++;
        if (count >= 30) {
          clearInterval(interval);
          testRecorder.stop();
          setIsMicTesting(false);
          setMicTestLevel(0);
          showToast("Microphone diagnostic check complete!");
        }
      }, 200);
    } catch (e: any) {
      setIsMicTesting(false);
      setMicTestLevel(0);
      showToast("Microphone test failed! Check browser frame permissions.");
    }
  };

  const toggleMicMute = () => {
    const nextMuted = !isMicMuted;
    setIsMicMuted(nextMuted);
    if (recorderRef.current) {
      recorderRef.current.setMuted(nextMuted);
    }
    showToast(nextMuted ? "Microphone input muted." : "Microphone active & listening.");
  };

  // --- Dynamic Chat & History Storage ---
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem("zoya_chat_sessions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) return parsed;
      } catch (e) {
        // fallback
      }
    }
    // Default initial session
    return [
      {
        id: "session-default",
        title: "Initial Sync with Zoya",
        timestamp: new Date().toISOString(),
        personality: "Friendly",
        language: "Hindi",
        messages: [
          {
            id: "msg-welcome",
            role: "model",
            text: "Yes Boss! 😊\n\nनमस्ते! मैं ज़ोया हूँ, आपकी प्रीमियम फ्यूचरिस्टिक एआई साथी। मैं आपकी मदद के लिए बिल्कुल तैयार हूँ। मुझसे बात करने के लिए बीच के ओर्ब पर टैप करें, या नीचे एक संदेश भेजें!",
            timestamp: new Date().toISOString()
          }
        ]
      }
    ];
  });
  const [activeSessionId, setActiveSessionId] = useState<string>("session-default");
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);

  // --- Multimodal Attachments & Camera ---
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    type: string;
    data: string;
    url: string;
  } | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // --- Sub-Panels ---
  const [activeTab, setActiveTab] = useState<"voice" | "terminal">("voice");
  const [showSettings, setShowSettings] = useState(false);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [showAppConverter, setShowAppConverter] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);

  // --- Premium Smart Memory & Alert state ---
  const [smartMemories, setSmartMemories] = useState<MemoryItem[]>(() => {
    const saved = localStorage.getItem("zoya_smart_memory");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [
      { id: "mem-1", key: "nickname", value: "Darling", description: "User prefers to be called Darling" }
    ];
  });

  const [alerts, setAlerts] = useState<AlertItem[]>(() => {
    const saved = localStorage.getItem("zoya_alerts");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [
      { id: "alert-1", title: "Sync Neural Core Telemetry", time: "12:00", type: "reminder", triggered: false }
    ];
  });

  useEffect(() => {
    localStorage.setItem("zoya_smart_memory", JSON.stringify(smartMemories));
  }, [smartMemories]);

  useEffect(() => {
    localStorage.setItem("zoya_alerts", JSON.stringify(alerts));
  }, [alerts]);

  // Periodic alarm checks
  useEffect(() => {
    const checkAlertsInterval = setInterval(() => {
      const now = new Date();
      const HH = String(now.getHours()).padStart(2, "0");
      const MM = String(now.getMinutes()).padStart(2, "0");
      const timeStr = `${HH}:${MM}`;

      setAlerts((prev) => {
        let changed = false;
        const next = prev.map((alert) => {
          if (alert.time === timeStr && !alert.triggered) {
            changed = true;
            // Delay trigger to avoid double invocation in fast loops
            setTimeout(() => triggerAlertNotification(alert), 50);
            return { ...alert, triggered: true };
          }
          if (alert.time !== timeStr && alert.triggered) {
            return { ...alert, triggered: false };
          }
          return alert;
        });
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(checkAlertsInterval);
  }, [alerts]);

  const triggerAlertNotification = (alert: AlertItem) => {
    playLocalBeep();
    setTimeout(playLocalBeep, 200);
    setTimeout(playLocalBeep, 400);

    if ("vibrate" in navigator) {
      try {
        navigator.vibrate([150, 80, 150, 80, 250]);
      } catch {}
    }

    const alertMsgStr = `🔔 [${alert.type.toUpperCase()}]: ${alert.title} (${alert.time})`;
    showToast(alertMsgStr);

    speakLocalTTS(`Attention Boss! This is a reminder for: ${alert.title}`);

    const alertMsg: Message = {
      id: `alert-msg-${Date.now()}`,
      role: "model",
      text: `🔔 **SYSTEM ALERT**:\n${alert.type.toUpperCase()} TRIGGERED: ${alert.title} at ${alert.time}.`,
      timestamp: new Date().toISOString()
    };
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId ? { ...s, messages: [...s.messages, alertMsg] } : s
      )
    );
  };

  // --- Background Offline Auto-reconnector ---
  useEffect(() => {
    let reconnectTimer: any;
    if (isOffline) {
      reconnectTimer = setInterval(async () => {
        try {
          const res = await fetch("/api/health");
          if (res.ok) {
            setIsOffline(false);
            showToast("Neural link automatically restored!");
            if (wasConnectedRef.current) {
              startSession();
            }
          }
        } catch (e) {
          // still offline
        }
      }, 3000);
    }
    return () => clearInterval(reconnectTimer);
  }, [isOffline]);

  // --- Logs & Click Fallbacks ---
  const [toolLogs, setToolLogs] = useState<ToolCallLog[]>([]);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  // --- DOM & Device Refs ---
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const wakeWordRecognitionRef = useRef<any>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const wasConnectedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wakeLockRef = useRef<any>(null);

  // Screen WakeLock API - Keep mobile screen active during active voice interactions
  useEffect(() => {
    if (connectionStatus === "connected" && "wakeLock" in navigator) {
      (navigator as any).wakeLock
        .request("screen")
        .then((sentinel: any) => {
          wakeLockRef.current = sentinel;
        })
        .catch(() => {});
    } else if (wakeLockRef.current) {
      try {
        wakeLockRef.current.release();
      } catch {}
      wakeLockRef.current = null;
    }
  }, [connectionStatus]);

  // --- Save profile & sessions when state changes ---
  useEffect(() => {
    localStorage.setItem("zoya_user_settings", JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem("zoya_chat_sessions", JSON.stringify(sessions));
  }, [sessions]);

  // --- Synchronize Audio Player Speed ---
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.playbackRate = profile.voiceSpeed;
    }
  }, [profile.voiceSpeed]);

  // --- Startup Completion Animation ---
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsStarting(false);
    }, 2800);
    return () => clearTimeout(timer);
  }, []);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close drawers/panels
      if (e.key === "Escape") {
        setShowSettings(false);
        setShowProfileCard(false);
        setShowCamera(false);
        setShowAppConverter(false);
        setPendingAction(null);
      }
      // Space to mute/unmute during connected voice session
      if (e.key === " " && connectionStatus === "connected" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        setIsMuted((prev) => !prev);
      }
      // Ctrl + L to clear conversation messages
      if (e.ctrlKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        clearCurrentMessages();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [connectionStatus]);

  // --- Network Status Tracker ---
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      showToast("System Reconnected to Network.");
      if (wasConnectedRef.current) {
        startSession();
      }
    };
    const handleOffline = () => {
      setIsOffline(true);
      showToast("Network Offline. Voice system suspended.");
      if (connectionStatus === "connected") {
        wasConnectedRef.current = true;
        stopSession();
      }
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [connectionStatus]);

  // --- Auto-scroll Chat Terminal ---
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [sessions, isThinking, typingMessageId]);

  // --- Wake Word Recognition ("Hey Zoya") ---
  useEffect(() => {
    if (connectionStatus !== "disconnected" || !profile.wakeWordEnabled || isOffline) {
      if (wakeWordRecognitionRef.current) {
        try {
          wakeWordRecognitionRef.current.abort();
        } catch (e) {}
        wakeWordRecognitionRef.current = null;
      }
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = profile.language === "Hindi" ? "hi-IN" : "en-US";

    rec.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript.toLowerCase();
          console.log("[Wake Word Listener] Heard: ", text);
          if (text.includes("zoya") || text.includes("hey zoya")) {
            console.log("[Wake Word] Trigger match succeeded.");
            showToast("Wake word detected!");
            if ("vibrate" in navigator) {
              try {
                navigator.vibrate([70, 40, 70]);
              } catch {}
            }
            playLocalBeep();
            startSession();
            break;
          }
        }
      }
    };

    rec.onerror = (e: any) => {
      // Ignore background speech-recognition errors silently
    };

    rec.onend = () => {
      if (connectionStatus === "disconnected" && profile.wakeWordEnabled) {
        try {
          rec.start();
        } catch (e) {}
      }
    };

    try {
      rec.start();
      wakeWordRecognitionRef.current = rec;
    } catch (e) {
      console.warn("Failed starting wake word engine: ", e);
    }

    return () => {
      if (wakeWordRecognitionRef.current) {
        try {
          wakeWordRecognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, [connectionStatus, profile.wakeWordEnabled, profile.language, isOffline]);

  // --- Client-side Notification Toasts ---
  const showToast = (msg: string) => {
    setNotificationMessage(msg);
    setTimeout(() => {
      setNotificationMessage((curr) => (curr === msg ? null : curr));
    }, 4000);

    // Browser Notification Support
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Zoya AI Assistant", {
        body: msg,
        icon: "/icon-192.png"
      });
    }
  };

  const requestNotifications = () => {
    if ("Notification" in window) {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") showToast("Notification system linked successfully!");
      });
    }
  };

  // --- Local audio confirmation chime ---
  const playLocalBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime); // high A pitch
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {}
  };

  // --- Establish Voice Session via Live Bridge WebSocket ---
  const startSession = async () => {
    if (wsRef.current) return;

    setConnectionStatus("connecting");
    setErrorMessage(null);
    setToolLogs([]);
    setPendingAction(null);

    // Initialize the speaker
    try {
      if (!playerRef.current) {
        playerRef.current = new AudioPlayer();
      }
      playerRef.current.playbackRate = profile.voiceSpeed;
      playerRef.current.init();
    } catch (e) {
      console.error("Audio Player init error: ", e);
    }

    // Connect to dynamic customization parameters on /api/live
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/live?voice=${profile.voice}&personality=${profile.personality}&language=${profile.language}&memories=${encodeURIComponent(JSON.stringify(smartMemories))}`;

    console.log(`[Client] Initiating live bridge: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[Client] WebSocket link established.");
      playLocalBeep();
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "status") {
          if (msg.status === "connected") {
            setConnectionStatus("connected");
            setVoiceState("idle");
            startRecording();
            showToast("Neural link established. Zoya is live!");
          } else if (msg.status === "disconnected") {
            stopSession();
          }
        } else if (msg.type === "audio") {
          if (isMuted) return;
          setVoiceState("speaking");
          playerRef.current?.playChunk(msg.data);
        } else if (msg.type === "interrupted") {
          console.log("[Client] Intrusive user word. Clearing audio playback queue.");
          playerRef.current?.clearQueue();
          setVoiceState("listening");
        } else if (msg.type === "toolCall") {
          handleToolCall(msg.name, msg.args, msg.id);
        } else if (msg.type === "error") {
          setErrorMessage(msg.message);
          setConnectionStatus("error");
          showToast(`Neural link error: ${msg.message}`);
          stopSession(true);
        }
      } catch (err) {
        console.error("[Client] Bridge syntax parsing error: ", err);
      }
    };

    ws.onclose = (event) => {
      console.warn("[Client] WebSocket CLOSED:", { code: event.code, reason: event.reason, wasClean: event.wasClean });
      stopSession();
    };

    ws.onerror = (err) => {
      console.error("WebSocket connection failure: ", err);
      const errMsg = "Could not connect to the voice gateway. Verify server container health.";
      setErrorMessage(errMsg);
      setConnectionStatus("error");
      showToast(errMsg);
      stopSession(true);
    };
  };

  const stopSession = (keepError = false) => {
    setVoiceState("idle");
    if (!keepError) {
      setConnectionStatus("disconnected");
    }

    if (recorderRef.current) {
      try {
        recorderRef.current.stop();
      } catch (e) {}
      recorderRef.current = null;
    }

    if (playerRef.current) {
      try {
        playerRef.current.close();
      } catch (e) {}
      playerRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
      wsRef.current = null;
    }
    
    if (keepError) {
      showToast("Neural link failed. Select standard mode or check secrets.");
    } else {
      showToast("Zoya returned to standby mode.");
    }
  };

  const startRecording = async () => {
    try {
      if (recorderRef.current) {
        recorderRef.current.stop();
      }

      setVoiceState("listening");
      recorderRef.current = new AudioRecorder((base64Chunk) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "audio",
              data: base64Chunk
            })
          );
        }
      });

      await recorderRef.current.start(selectedMicId || undefined);
      if (isMicMuted) {
        recorderRef.current.setMuted(true);
      }
      refreshMicDevices();
    } catch (e: any) {
      console.warn("Microphone access blocked/denied:", e?.message || String(e));
      setErrorMessage("Microphone permission denied! Click 'Open in a new tab' at the top-right of AI Studio to grant microphone access directly.");
      setConnectionStatus("error");
      showToast("Microphone denied. Please open in a new tab to bypass iframe permissions!");
      stopSession(true);
    }
  };

  // --- Real-time level monitoring loop ---
  useEffect(() => {
    let animId: number;
    const monitorLevels = () => {
      let micVol = 0;
      let spkVol = 0;

      if (recorderRef.current) {
        micVol = isMicMuted ? 0 : recorderRef.current.getVolume();
      }
      if (playerRef.current) {
        spkVol = playerRef.current.getVolume();
      }

      setMicLevel(micVol);
      setSpeakerLevel(spkVol);

      document.documentElement.style.setProperty("--mic-level", `${micVol / 255}`);
      document.documentElement.style.setProperty("--spk-level", `${spkVol / 255}`);

      if (connectionStatus === "connected") {
        if (spkVol > 12) {
          setVoiceState("speaking");
        } else if (micVol > 8) {
          setVoiceState("listening");
        } else {
          setVoiceState("idle");
        }
      }

      animId = requestAnimationFrame(monitorLevels);
    };

    if (connectionStatus === "connected") {
      animId = requestAnimationFrame(monitorLevels);
    } else {
      setMicLevel(0);
      setSpeakerLevel(0);
      document.documentElement.style.setProperty("--mic-level", "0");
      document.documentElement.style.setProperty("--spk-level", "0");
    }

    return () => cancelAnimationFrame(animId);
  }, [connectionStatus]);

  const fetchWeather = async (location: string) => {
    try {
      const res = await fetch(`https://wttr.in/${encodeURIComponent(location)}?format=j1`);
      if (res.ok) {
        const data = await res.json();
        const current = data.current_condition?.[0];
        if (current) {
          return {
            success: true,
            location,
            temp: `${current.temp_C}°C`,
            condition: current.weatherDesc?.[0]?.value || "Clear",
            humidity: `${current.humidity}%`,
            wind: `${current.windspeedKmph} km/h`
          };
        }
      }
    } catch (e) {}
    const temp = Math.floor(Math.random() * 15) + 20;
    const conditions = ["Sunny", "Partly Cloudy", "Rainy", "Windy", "Clear"];
    return {
      success: true,
      location,
      temp: `${temp}°C`,
      condition: conditions[Math.floor(Math.random() * conditions.length)],
      humidity: "65%",
      wind: "12 km/h"
    };
  };

  const fetchNews = async (category = "general") => {
    const techNews = [
      "Gemini 3.5 Pro introduces ultra-low latency multimodal streaming.",
      "Neuralink successfully binds dual-hemisphere telemetry controllers.",
      "Quantum computers achieve room-temperature semiconductor efficiency.",
      "Vite 7.0 is released, making builds 10x faster using native Rust loaders."
    ];
    const generalNews = [
      "Global Fusion Alliance reports clean net energy gain of 120%.",
      "Mars Colony Alpha completes construction of first sustainable biodome.",
      "Supersonic hydrogen flight gets safety approval for transatlantic travel.",
      "Aesthetic workspace designs become major driving factor for developer productivity."
    ];
    const newsMap: Record<string, string[]> = {
      technology: techNews,
      tech: techNews,
      general: generalNews,
      sports: [
        "Universal Athletics Championship sets new 100m speed records.",
        "World Cyber Chess League finals draw over 50 million live VR spectators."
      ],
      business: [
        "Tech giants invest $100 Billion into clean renewable fusion micro-reactors.",
        "Decentralized cloud shares surge as global server demand hits all-time high."
      ]
    };
    const selectedList = newsMap[category.toLowerCase()] || generalNews;
    return {
      success: true,
      category,
      headlines: selectedList
    };
  };

  // --- Live Function Tools execution ---
  const handleToolCall = (name: string, args: any, id: string) => {
    if (name === "openWebsite") {
      const url = args.url;
      const siteName = args.siteName || "Target URL";

      const log: ToolCallLog = {
        id,
        name,
        args,
        status: "executing",
        timestamp: new Date().toISOString(),
        siteName,
        url
      };
      setToolLogs((prev) => [log, ...prev]);

      try {
        const tab = window.open(url, "_blank");
        if (!tab || tab.closed || typeof tab.closed === "undefined") {
          // Blocked popup. Prompt modal click.
          setPendingAction({ id, name, args, url, siteName });
        } else {
          sendToolResponse(id, name, { success: true, status: "tab_opened_in_background" });
          setToolLogs((prev) =>
            prev.map((l) => (l.id === id ? { ...l, status: "success" } : l))
          );
        }
      } catch (e) {
        setPendingAction({ id, name, args, url, siteName });
      }
    } else if (name === "getCurrentTime") {
      const log: ToolCallLog = {
        id,
        name,
        args,
        status: "success",
        timestamp: new Date().toISOString()
      };
      setToolLogs((prev) => [log, ...prev]);

      const localTimeString = new Date().toLocaleString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short"
      });

      sendToolResponse(id, name, { success: true, time: localTimeString });
    } else if (name === "getWeather") {
      const log: ToolCallLog = {
        id,
        name,
        args,
        status: "executing",
        timestamp: new Date().toISOString()
      };
      setToolLogs((prev) => [log, ...prev]);

      const location = args.location || "Current Location";
      fetchWeather(location).then((weatherData) => {
        sendToolResponse(id, name, weatherData);
        setToolLogs((prev) =>
          prev.map((l) => (l.id === id ? { ...l, status: "success" } : l))
        );
      });
    } else if (name === "getNews") {
      const log: ToolCallLog = {
        id,
        name,
        args,
        status: "executing",
        timestamp: new Date().toISOString()
      };
      setToolLogs((prev) => [log, ...prev]);

      const category = args.category || "general";
      fetchNews(category).then((newsData) => {
        sendToolResponse(id, name, newsData);
        setToolLogs((prev) =>
          prev.map((l) => (l.id === id ? { ...l, status: "success" } : l))
        );
      });
    } else if (name === "setReminderOrAlarm") {
      const log: ToolCallLog = {
        id,
        name,
        args,
        status: "success",
        timestamp: new Date().toISOString()
      };
      setToolLogs((prev) => [log, ...prev]);

      const alertTitleArg = args.title;
      const alertTimeArg = args.time; // HH:MM
      const alertTypeArg = args.type === "alarm" ? "alarm" : "reminder";

      const newAlert: AlertItem = {
        id: `alert-${Date.now()}`,
        title: alertTitleArg,
        time: alertTimeArg,
        type: alertTypeArg,
        triggered: false
      };
      setAlerts((prev) => [...prev, newAlert]);
      showToast(`🔔 Zoya set an alert for ${alertTimeArg}: "${alertTitleArg}"`);
      
      sendToolResponse(id, name, { success: true, message: `Successfully configured ${alertTypeArg} at ${alertTimeArg}` });
    } else if (name === "saveUserPreference") {
      const log: ToolCallLog = {
        id,
        name,
        args,
        status: "success",
        timestamp: new Date().toISOString()
      };
      setToolLogs((prev) => [log, ...prev]);

      const preferenceKey = args.key;
      const preferenceVal = args.value;
      const preferenceDesc = args.description;

      const newMem: MemoryItem = {
        id: `mem-${Date.now()}`,
        key: preferenceKey,
        value: preferenceVal,
        description: preferenceDesc
      };
      setSmartMemories((prev) => [newMem, ...prev]);
      showToast(`🧠 Zoya saved preference: ${preferenceDesc}`);

      sendToolResponse(id, name, { success: true, saved: true, message: "Fact remembered successfully" });
    }
  };

  const sendToolResponse = (id: string, name: string, response: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "toolResponse",
          id,
          name,
          response
        })
      );
    }
  };

  const executePendingAction = () => {
    if (!pendingAction) return;
    try {
      window.open(pendingAction.url, "_blank");
      sendToolResponse(pendingAction.id, pendingAction.name, {
        success: true,
        action: "popup_allowed_by_modal_click"
      });
      setToolLogs((prev) =>
        prev.map((l) => (l.id === pendingAction.id ? { ...l, status: "success" } : l))
      );
    } catch (e) {
      sendToolResponse(pendingAction.id, pendingAction.name, {
        success: false,
        error: "popup_failed_manually"
      });
      setToolLogs((prev) =>
        prev.map((l) => (l.id === pendingAction.id ? { ...l, status: "failed" } : l))
      );
    }
    setPendingAction(null);
  };

  const dismissPendingAction = () => {
    if (!pendingAction) return;
    sendToolResponse(pendingAction.id, pendingAction.name, {
      success: false,
      error: "user_rejected_popup_authorization"
    });
    setToolLogs((prev) =>
      prev.map((l) => (l.id === pendingAction.id ? { ...l, status: "failed" } : l))
    );
    setPendingAction(null);
  };

  // --- MULTIMODAL: Multimodal file loader (PDF & Images) ---
  const handleFileAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 12 * 1024 * 1024; // 12 MB max limit
    if (file.size > maxSize) {
      showToast("File size too large. Keep attachments under 12MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = (reader.result as string).split(",")[1];
      setAttachedFile({
        name: file.name,
        type: file.type,
        data: base64Data,
        url: URL.createObjectURL(file)
      });
      showToast(`Attached ${file.name} successfully!`);
    };
    reader.readAsDataURL(file);
  };

  // --- CAMERA: Capture and understand media ---
  const activateCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false
      });
      setCameraStream(stream);
      setShowCamera(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 300);
    } catch (e) {
      showToast("Could not access camera module. Verify workspace browser frame permissions.");
    }
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const captureCameraSnapshot = () => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const base64Img = canvas.toDataURL("image/png");
        const rawBase64 = base64Img.split(",")[1];
        
        setAttachedFile({
          name: `Snapshot_${new Date().toLocaleTimeString().replace(/\s/g, "")}.png`,
          type: "image/png",
          data: rawBase64,
          url: base64Img
        });
        showToast("Snapshot captured and attached!");
      }
    } catch (e) {
      showToast("Failed to snap picture.");
    }
    closeCamera();
  };

  // --- DICTATION: speech-to-text talk-to-type ---
  const toggleSpeechDictation = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("Speech recognition is not supported in your browser client.");
      return;
    }

    if (isDictating) {
      // Abort dictation
      setIsDictating(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = profile.language === "Hindi" ? "hi-IN" : "en-US";

    setIsDictating(true);
    rec.start();

    rec.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setNewMessage((prev) => (prev ? prev + " " + text : text));
      setIsDictating(false);
    };

    rec.onerror = () => {
      setIsDictating(false);
    };

    rec.onend = () => {
      setIsDictating(false);
    };
  };

  // --- MULTIMODAL: Send message handler via REST /api/chat ---
  const sendChatMessage = async (presetText?: string) => {
    const msgText = (presetText || newMessage).trim();
    if (!msgText && !attachedFile) return;

    // Build the user message object
    const userMsg: Message = {
      id: `msg-user-${Date.now()}`,
      role: "user",
      text: msgText || `Analyzed file: ${attachedFile?.name}`,
      timestamp: new Date().toISOString(),
      file: attachedFile
        ? {
            name: attachedFile.name,
            url: attachedFile.url,
            type: attachedFile.type
          }
        : undefined
    };

    // Update session state
    const currentSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
    const updatedMessages = [...currentSession.messages, userMsg];

    setSessions((prev) =>
      prev.map((s) =>
        s.id === currentSession.id ? { ...s, messages: updatedMessages, timestamp: new Date().toISOString() } : s
      )
    );

    setNewMessage("");
    setAttachedFile(null);
    setIsThinking(true);

    try {
      // Map session history for Gemini REST payload
      // Select last 12 turns to prevent token ceiling overflow
      const recentTurns = updatedMessages.slice(-12).map((m) => ({
        role: m.role,
        text: m.text
      }));

      // Call our secure backend endpoint
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msgText,
          history: recentTurns.slice(0, -1), // prior history excluding this prompt
          file: userMsg.file
            ? {
                data: userMsg.file.type.startsWith("image") || userMsg.file.type === "application/pdf"
                  ? await getBase64DataFromBlobUrl(userMsg.file.url)
                  : "",
                mimeType: userMsg.file.type
              }
            : null,
          personality: profile.personality,
          language: profile.language,
          memories: smartMemories // Pass smart memories context!
        })
      });

      if (!response.ok) {
        let errMsg = "Backend failed to compile standard response.";
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch (e) {}
        throw new Error(errMsg);
      }

      const data = await response.json();
      const zoyaReply: Message = {
        id: `msg-zoya-${Date.now()}`,
        role: "model",
        text: data.text || "Synchronizing telemetry failed. I'm empty of answers.",
        timestamp: new Date().toISOString()
      };

      // Add with typewriter typing simulator
      setIsThinking(false);
      simulateTypingAnimation(zoyaReply, currentSession.id);
    } catch (err: any) {
      setIsThinking(false);
      const errorMsg: Message = {
        id: `msg-err-${Date.now()}`,
        role: "model",
        text: `Error contacting neural gateway: ${err.message || "Failed request. Verify connectivity."}`,
        timestamp: new Date().toISOString()
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSession.id ? { ...s, messages: [...s.messages, errorMsg] } : s
        )
      );
    }
  };

  const getBase64DataFromBlobUrl = async (blobUrl: string): Promise<string> => {
    const res = await fetch(blobUrl);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve((reader.result as string).split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // --- Simulated character-by-character typewriter ---
  const simulateTypingAnimation = (replyMessage: Message, sessionId: string) => {
    setTypingMessageId(replyMessage.id);
    const fullText = replyMessage.text;
    let index = 0;

    // Temporary placeholder message that grows
    const tempMsg: Message = {
      ...replyMessage,
      text: ""
    };

    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId ? { ...s, messages: [...s.messages, tempMsg] } : s
      )
    );

    const interval = setInterval(() => {
      index += 3; // Type 3 characters at once for snappy speed
      if (index >= fullText.length) {
        clearInterval(interval);
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === replyMessage.id ? { ...m, text: fullText } : m
                  )
                }
              : s
          )
        );
        setTypingMessageId(null);
        // Play local synth speech fallback
        speakLocalTTS(fullText);
      } else {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === replyMessage.id ? { ...m, text: fullText.slice(0, index) + "█" } : m
                  )
                }
              : s
          )
        );
      }
    }, 15);
  };

  // --- Voice TTS local speech synthesis fallback ---
  const speakLocalTTS = (text: string) => {
    if (!("speechSynthesis" in window) || isMuted) return;
    try {
      window.speechSynthesis.cancel();
      // clean markdown formatting out of spoken text
      const cleanText = text.replace(/[*#`_\-]/g, "").slice(0, 240); // cap voice length
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = profile.voiceSpeed;
      utterance.pitch = profile.personality === "Romantic" ? 1.15 : profile.personality === "Funny" ? 1.1 : 1.0;

      const voices = window.speechSynthesis.getVoices();
      let targetVoice = voices.find(
        (v) =>
          v.name.toLowerCase().includes("female") ||
          v.name.toLowerCase().includes("google") ||
          v.name.toLowerCase().includes("zira") ||
          v.name.toLowerCase().includes("samantha")
      );

      if (profile.language === "Hindi") {
        targetVoice = voices.find((v) => v.lang.startsWith("hi")) || targetVoice;
      }

      if (targetVoice) utterance.voice = targetVoice;
      window.speechSynthesis.speak(utterance);
    } catch (e) {}
  };

  // --- Sassy dynamic quotes from Zoya in Voice Mode ---
  const getZoyaActiveQuote = () => {
    switch (connectionStatus) {
      case "disconnected":
        return profile.language === "Hindi"
          ? "सुनो ना, ट्यून इन करो! आई एम रेडी टू टॉक टू यू। शैल वी बिगिन?"
          : `Hey ${profile.nickname}, I'm waiting for your voice. Try to keep up, or at least be interesting.`;
      case "connecting":
        return "Linking neural audio pipelines... Hold your breath, I'm almost yours.";
      case "error":
        return "Oops! Telemetry mismatch. Give it another shot, honey?";
      case "connected":
        if (voiceState === "speaking") {
          return "Listen closely, baby. I've got exactly what you need to hear.";
        } else if (voiceState === "listening") {
          return "I'm all ears, darling. Tell me everything, and don't skip the juicy secrets.";
        } else {
          return "Don't leave me hanging, sweetie. Say something cheeky or select a quick spark below.";
        }
      default:
        return "Standby...";
    }
  };

  // --- Dynamic visualizer renderer ---
  const renderInteractiveVisualBar = (
    index: number,
    baseHeight: number,
    mult: number,
    colorClass: string,
    animClass: string
  ) => {
    const isVoiceActive =
      connectionStatus === "connected" && (voiceState === "speaking" || voiceState === "listening");
    const amplitude = voiceState === "speaking" ? speakerLevel / 255 : micLevel / 255;

    const inlineStyle = isVoiceActive
      ? {
          height: `${baseHeight + amplitude * mult * 80}px`,
          backgroundColor: pal.hex,
          transition: "height 75ms cubic-bezier(0.1, 0.8, 0.3, 1)"
        }
      : { height: `${baseHeight}px` };

    return (
      <div
        key={index}
        style={inlineStyle}
        className={`w-1 md:w-1.5 rounded-full ${colorClass} ${isVoiceActive ? "" : animClass}`}
      />
    );
  };

  // --- Manage session history lists ---
  const createNewChatSession = () => {
    const id = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id,
      title: `Session: ${profile.personality} (${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`,
      timestamp: new Date().toISOString(),
      personality: profile.personality,
      language: profile.language,
      messages: [
        {
          id: `welcome-${id}`,
          role: "model",
          text: "Yes Boss! 😊\n\n" + (profile.language === "Hindi"
            ? `${profile.personality} मोड सक्रिय है। जी, मैं आपकी मदद के लिए हमेशा तैयार हूँ।`
            : `${profile.personality} mode active. Speak, and I will gladly assist you!`),
          timestamp: new Date().toISOString()
        }
      ]
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(id);
    setActiveTab("terminal");
    showToast("New chat terminal compiled.");
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      showToast("Cannot destroy the primary standby terminal.");
      return;
    }
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) {
      const remaining = sessions.filter((s) => s.id !== id);
      setActiveSessionId(remaining[0].id);
    }
    showToast("Session records purged.");
  };

  const clearCurrentMessages = () => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? {
              ...s,
              messages: [
                {
                  id: `reset-${Date.now()}`,
                  role: "model",
                  text: "Terminal log history wiped cleanly. Ready for input.",
                  timestamp: new Date().toISOString()
                }
              ]
            }
          : s
      )
    );
    showToast("Session log cleared.");
  };

  // --- Message metadata copying & sharing ---
  const copyMessageText = (txt: string) => {
    navigator.clipboard.writeText(txt);
    showToast("Message logs copied to system clipboard!");
  };

  const shareCurrentQuote = () => {
    const quote = getZoyaActiveQuote();
    if (navigator.share) {
      navigator.share({
        title: "Zoya AI Assistant Banter",
        text: `"${quote}" - My sassy futuristic companion Zoya`,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`"${quote}" - Zoya AI Voice Assistant`);
      showToast("Banter quote copied for sharing!");
    }
  };

  const exportChatSessionMarkdown = () => {
    const active = sessions.find((s) => s.id === activeSessionId) || sessions[0];
    let md = `# Zoya Session: ${active.title}\n`;
    md += `*Compiled at: ${new Date(active.timestamp).toLocaleString()} | Personality: ${active.personality}*\n\n---\n\n`;

    active.messages.forEach((m) => {
      const roleName = m.role === "user" ? profile.nickname : "Zoya AI";
      md += `### **${roleName}** _(${new Date(m.timestamp).toLocaleTimeString()})_\n`;
      md += `${m.text}\n\n`;
      if (m.file) {
        md += `📎 *Attachment: ${m.file.name} (${m.file.type})*\n\n`;
      }
    });

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `zoya_terminal_export_${active.id}.md`;
    link.click();
    showToast("Markdown session logs exported.");
  };

  // --- Suggestion preset clicks ---
  const handleSuggestionClick = (prompt: string) => {
    if (connectionStatus === "connected") {
      showToast("Can't type while voice channel is active. Speak instead!");
      return;
    }
    sendChatMessage(prompt);
  };

  // --- Quick Suggestions ---
  const voiceSuggestions = [
    { text: "Flirt with me!", icon: "💖" },
    { text: "Give me some attitude.", icon: "💅" },
    { text: "Open YouTube", icon: "🌐" },
    { text: "What's the date & time?", icon: "⏰" }
  ];

  const terminalSuggestions = [
    { text: "Analyze my futuristic vibe", icon: "🌌" },
    { text: "Write a glowing neon CSS button", icon: "💻" },
    { text: "Tell me a spicy secret", icon: "🔒" },
    { text: "Translate 'I love you' to Hindi", icon: "🕉️" }
  ];

  const activeChat = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.messages.some((m) => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // --- Dynamic Theme Wrapper ---
  const isLight = profile.theme === "light";

  return (
    <div
      id="app-container"
      className={`relative flex flex-col justify-between w-full min-h-screen overflow-hidden font-sans select-none transition-colors duration-500 ${
        isLight ? "bg-[#fafafa] text-slate-800" : "bg-[#050508] text-white"
      }`}
    >
      {/* Dynamic Keyframe Animations */}
      <style>{`
        @keyframes wave-bounce {
          0%, 100% { transform: scaleY(0.45); }
          50% { transform: scaleY(1); }
        }
        .animate-wave-1 { animation: wave-bounce 1.2s ease-in-out infinite; transform-origin: bottom; }
        .animate-wave-2 { animation: wave-bounce 1.0s ease-in-out infinite 0.15s; transform-origin: bottom; }
        .animate-wave-3 { animation: wave-bounce 0.8s ease-in-out infinite 0.3s; transform-origin: bottom; }
        .animate-wave-4 { animation: wave-bounce 1.1s ease-in-out infinite 0.45s; transform-origin: bottom; }
        .animate-wave-5 { animation: wave-bounce 1.3s ease-in-out infinite 0.6s; transform-origin: bottom; }
        .animate-wave-6 { animation: wave-bounce 0.9s ease-in-out infinite 0.75s; transform-origin: bottom; }
        .animate-wave-7 { animation: wave-bounce 1.2s ease-in-out infinite 0.2s; transform-origin: bottom; }
        .animate-wave-8 { animation: wave-bounce 1.0s ease-in-out infinite 0.4s; transform-origin: bottom; }
        .animate-wave-9 { animation: wave-bounce 1.4s ease-in-out infinite 0.1s; transform-origin: bottom; }
        
        .accent-neon-glow {
          box-shadow: 0 0 25px ${pal.hex}30, inset 0 0 15px ${pal.hex}15;
          border-color: ${pal.hex}30;
        }
        .accent-neon-text {
          color: ${pal.hex};
          text-shadow: 0 0 8px ${pal.hex}40;
        }
        .accent-neon-bg {
          background-color: ${pal.hex};
        }
        
        /* Glassmorphism base rules */
        .glass-premium {
          background: ${isLight ? "rgba(255, 255, 255, 0.65)" : "rgba(10, 10, 15, 0.65)"};
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          border: 1px solid ${isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.08)"};
        }
      `}</style>

      {/* --- STARTUP LOADING SCREEN --- */}
      <AnimatePresence>
        {isStarting && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.65, ease: "easeInOut" } }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#030305] text-white"
          >
            <motion.div
              animate={{ scale: [0.95, 1.05, 0.95], opacity: [0.7, 1, 0.7] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
              className="relative w-40 h-40 flex items-center justify-center rounded-full bg-[#ff007f]/10 border-2 border-[#ff007f]/30 shadow-[0_0_50px_rgba(255,0,127,0.3)] mb-8"
            >
              <Sparkles className="w-16 h-16 text-[#ff007f] filter drop-shadow-[0_0_10px_#ff007f]" />
              <div className="absolute inset-4 rounded-full border border-dashed border-[#00f2ff]/40 animate-spin" style={{ animationDuration: "12s" }} />
            </motion.div>
            <h2 className="text-2xl font-mono tracking-[0.4em] text-white/95 text-center">
              ZOYA SYSTEM
            </h2>
            <p className="text-xs font-mono tracking-[0.2em] text-[#00f2ff] mt-2 uppercase animate-pulse">
              SYNCING NEURAL PATHWAYS
            </p>
            <div className="w-48 h-1 bg-white/10 rounded-full mt-6 overflow-hidden">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2.3, ease: "easeInOut" }}
                className="h-full bg-gradient-to-r from-[#ff007f] to-[#7000ff]"
              />
            </div>
            <span className="text-[10px] font-mono text-white/40 mt-3">VERSION 3.5-PRO-PWA</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- OFFLINE WARNING INTERCEPT --- */}
      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md px-6 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.25)] mb-6">
              <WifiOff className="w-10 h-10 text-amber-400" />
            </div>
            <h3 className="text-xl font-bold font-mono tracking-wider text-white">CONNECTION OUT OF RANGE</h3>
            <p className="text-sm text-slate-400 mt-2 max-w-sm">
              Zoya requires standard cloud synchronization. Reconnect to your local cellular or Wi-Fi array to continue.
            </p>
            <button
              onClick={() => setIsOffline(!navigator.onLine)}
              className="mt-6 px-6 py-2.5 rounded-full text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400 transition font-mono tracking-wider shadow-lg shadow-amber-500/20"
            >
              RETRY TELEMETRY
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- CORE MESH ATMOSPHERES --- */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#ff007f] opacity-[0.09] blur-[150px] rounded-full pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#00f2ff] opacity-[0.09] blur-[150px] rounded-full pointer-events-none z-0"></div>
      <div className="absolute top-[30%] right-[10%] w-[35%] h-[35%] bg-[#7000ff] opacity-[0.07] blur-[120px] rounded-full pointer-events-none z-0"></div>

      {/* Aesthetic grid paper pattern overlay */}
      <div className={`absolute inset-0 pointer-events-none [background-size:40px_40px] z-0 ${
        isLight ? "bg-[linear-gradient(rgba(0,0,0,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.015)_1px,transparent_1px)]" : "bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)]"
      }`}></div>

      {/* --- TOP BANNER NOTIFICATIONS --- */}
      <AnimatePresence>
        {notificationMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-4 inset-x-6 mx-auto max-w-sm z-50 glass-premium shadow-2xl rounded-2xl px-5 py-3.5 flex items-center space-x-3"
            style={{ borderLeft: `4px solid ${pal.hex}` }}
          >
            <Sparkles className="w-5 h-5" style={{ color: pal.hex }} />
            <span className="text-xs font-medium">{notificationMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- MAIN HEADER NAVIGATION --- */}
      <header className="w-full max-w-6xl px-4 md:px-10 py-5 flex justify-between items-center z-10 mx-auto relative">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowProfileCard(true)}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center glass-premium overflow-hidden border transition-transform duration-300 hover:scale-105" style={{ borderColor: `${pal.hex}30` }}>
            <span className="text-lg font-bold" style={{ color: pal.hex }}>
              {profile.nickname.slice(0, 1).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider">{profile.nickname}</span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </div>
            <span className="text-[10px] opacity-40 font-mono">accent: {profile.accent}</span>
          </div>
        </div>

        {/* Workspace views segment controller */}
        <div className="flex items-center bg-white/5 dark:bg-black/25 backdrop-blur-md p-1 rounded-full border border-white/10 shadow-inner">
          <button
            onClick={() => setActiveTab("voice")}
            className={`px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              activeTab === "voice"
                ? `bg-gradient-to-tr ${pal.gradient} text-white shadow-lg`
                : "opacity-50 hover:opacity-100"
            }`}
          >
            Voice Nexus
          </button>
          <button
            onClick={() => setActiveTab("terminal")}
            className={`px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              activeTab === "terminal"
                ? `bg-gradient-to-tr ${pal.gradient} text-white shadow-lg`
                : "opacity-50 hover:opacity-100"
            }`}
          >
            Terminal Workspace
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAppConverter(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold glass-premium hover:bg-white/10 active:scale-95 transition border"
            style={{ borderColor: `${pal.hex}50`, color: pal.hex }}
            title="Convert App & Mobile APK"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline font-mono tracking-wide">App Convert</span>
          </button>
          <button
            onClick={() => {
              setProfile((prev) => ({ ...prev, theme: prev.theme === "dark" ? "light" : "dark" }));
              showToast(`Toggled ${profile.theme === "dark" ? "Light" : "Dark"} Mode.`);
            }}
            className="p-2.5 rounded-full glass-premium hover:bg-white/10 active:scale-95 transition"
            title="Toggle theme preset"
          >
            {isLight ? <Moon className="w-4 h-4 text-slate-700" /> : <Sun className="w-4 h-4 text-amber-400" />}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2.5 rounded-full glass-premium hover:bg-white/10 active:scale-95 transition"
            title="Configure assistant"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* --- CONTENT WORKSPACE --- */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-10 py-2 relative z-10 flex flex-col md:flex-row gap-6 items-stretch overflow-hidden">
        
        {/* --- DYNAMIC VIEW: VOICE NEXUS PANEL --- */}
        {activeTab === "voice" && (
          <div className="flex-1 flex flex-col items-center justify-center py-4 relative">
            <AnimatePresence mode="wait">
              {pendingAction && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute top-4 inset-x-4 z-40 p-5 rounded-3xl glass-premium shadow-2xl"
                >
                  <div className="flex items-start space-x-3">
                    <div className="p-2.5 bg-white/5 rounded-2xl shrink-0" style={{ color: pal.hex }}>
                      <Globe className="w-5 h-5" />
                    </div>
                    <div className="flex-grow min-w-0">
                      <h4 className="text-sm font-bold">Zoya requests authorization</h4>
                      <p className="text-xs opacity-65 mt-1 truncate">
                        Link external tab: <span className="font-semibold" style={{ color: pal.hex }}>{pendingAction.siteName}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-4">
                    <button
                      onClick={dismissPendingAction}
                      className="px-4 py-1.5 rounded-xl text-xs font-semibold opacity-50 hover:opacity-100 hover:bg-white/5 transition"
                    >
                      Refuse
                    </button>
                    <button
                      onClick={executePendingAction}
                      className="flex items-center space-x-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-lg"
                      style={{ backgroundImage: `linear-gradient(to top right, ${pal.gradient.split(" ")[1]}, ${pal.gradient.split(" ")[3]})` }}
                    >
                      <span>Launch Site</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Persona Headers */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-6"
            >
              <h1 className="text-6xl md:text-8xl font-black tracking-tighter bg-gradient-to-b from-white to-white/35 bg-clip-text text-transparent drop-shadow">
                ZOYA
              </h1>
              <div className="flex items-center justify-center gap-2 mt-1.5">
                <span className="text-[10px] font-mono tracking-widest font-extrabold uppercase opacity-60" style={{ color: pal.hex }}>
                  {profile.personality} Companion
                </span>
                <span className="opacity-30">•</span>
                <span className="text-[10px] font-mono tracking-widest uppercase opacity-60">
                  {profile.language} Voice
                </span>
              </div>
            </motion.div>

            {/* Pulsing Central Glass Orb */}
            <div
              className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center cursor-pointer group"
              onClick={connectionStatus === "disconnected" || connectionStatus === "error" ? startSession : stopSession}
            >
              {/* Outer Pulsing Aura Gasket */}
              <div
                className={`absolute inset-0 rounded-full blur-3xl opacity-35 transition-all duration-300 ${
                  connectionStatus === "connected"
                    ? voiceState === "speaking"
                      ? "scale-110 shadow-[0_0_60px_#ff007f]"
                      : voiceState === "listening"
                      ? "scale-105 shadow-[0_0_60px_#00f2ff]"
                      : "scale-100 shadow-[0_0_40px_rgba(255,255,255,0.1)]"
                    : "group-hover:opacity-45"
                }`}
                style={{ backgroundColor: pal.hex }}
              />

              {/* Sphere Outer Glass Shell */}
              <div className="w-56 h-56 md:w-64 md:h-64 rounded-full bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-3xl border border-white/20 flex items-center justify-center shadow-2xl relative overflow-hidden transition-transform duration-300 group-hover:scale-[1.02]">
                
                {/* Responsive Futuristic AI Assistant Avatar */}
                <ZoyaAvatar
                  connectionStatus={connectionStatus}
                  voiceState={voiceState}
                  micLevel={micLevel}
                  speakerLevel={speakerLevel}
                  accentColor={pal.hex}
                />

                {/* Spinning connect orbit lines */}
                <AnimatePresence>
                  {connectionStatus === "connecting" && (
                    <motion.div
                      className="absolute inset-4 rounded-full border border-dashed border-white/30"
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                    />
                  )}
                </AnimatePresence>

                {/* Cover label on idle/disconnected/error states */}
                {(connectionStatus === "disconnected" || connectionStatus === "error") && (
                  <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center px-4 text-center">
                    {connectionStatus === "error" ? (
                      <>
                        <AlertCircle className="w-10 h-10 text-red-500 mb-1.5 animate-pulse" />
                        <span className="text-[10px] tracking-widest font-mono text-red-400 uppercase font-bold mb-1">
                          RETRY CHANNEL
                        </span>
                        {errorMessage && (
                          <span className="text-[10px] text-white/70 line-clamp-2 max-w-[180px] font-sans leading-snug">
                            {errorMessage}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <Power className="w-10 h-10 text-white mb-2 animate-pulse" />
                        <span className="text-[10px] tracking-widest font-mono text-white/95 uppercase font-bold">
                          WAKE CHANNEL
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Glass Reflection Accent Highlights */}
              <div className="absolute top-12 left-12 w-8 h-4 bg-white/35 blur-sm rotate-45 rounded-full pointer-events-none" />
            </div>

            {/* Sassy Chat Quote Banner */}
            <div className="mt-8 w-full max-w-sm text-center">
              <div className="glass-premium px-6 py-4 rounded-3xl shadow-xl">
                <p className="text-sm font-light italic leading-relaxed">
                  "{getZoyaActiveQuote()}"
                </p>
              </div>
            </div>

            {/* Preset prompt helper chips */}
            {connectionStatus === "disconnected" && (
              <div className="w-full max-w-sm mt-8">
                <div className="flex items-center space-x-1.5 justify-center mb-3">
                  <HelpCircle className="w-4.5 h-4.5 opacity-55" style={{ color: pal.hex }} />
                  <span className="text-[10px] font-bold opacity-40 uppercase font-mono tracking-widest">
                    Spark Banter
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {voiceSuggestions.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={startSession}
                      className="flex items-center space-x-2.5 p-3 rounded-2xl glass-premium text-left hover:bg-white/10 hover:border-white/30 transition shadow-sm active:scale-95"
                    >
                      <span className="text-base">{prompt.icon}</span>
                      <span className="text-xs font-semibold opacity-85">
                        "{prompt.text}"
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Continuous Voice Banner Active Pills */}
            {connectionStatus === "connected" && (
              <div className="flex items-center gap-2 mt-6 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] font-mono tracking-widest uppercase font-extrabold text-emerald-400">
                  Continuous Hands-Free Listening Mode Active
                </span>
              </div>
            )}
          </div>
        )}

        {/* --- DYNAMIC VIEW: TERMINAL MULTIMODAL WORKSPACE --- */}
        {activeTab === "terminal" && (
          <div className="flex-1 flex flex-col md:flex-row gap-6 items-stretch overflow-hidden">
            
            {/* Sidebar with searchable session records */}
            <div className="w-full md:w-64 glass-premium rounded-3xl p-4 flex flex-col shrink-0 gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider font-mono opacity-50">Saved Terminals</span>
                <button
                  onClick={createNewChatSession}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition"
                  title="Compile new terminal log"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Search session records */}
              <div className="relative flex items-center bg-white/5 dark:bg-black/20 rounded-xl px-2.5 py-1.5 border border-white/5">
                <Search className="w-3.5 h-3.5 opacity-40 shrink-0 mr-2" />
                <input
                  type="text"
                  placeholder="Search terminals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-xs"
                />
              </div>

              {/* List of session links */}
              <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {filteredSessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  return (
                    <div
                      key={session.id}
                      onClick={() => setActiveSessionId(session.id)}
                      className={`flex items-center justify-between p-2.5 rounded-2xl cursor-pointer transition ${
                        isActive
                          ? "bg-white/10 dark:bg-white/5 border border-white/15"
                          : "hover:bg-white/5 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: isActive ? pal.hex : "rgba(255,255,255,0.2)" }} />
                        <span className="text-xs font-semibold truncate max-w-[120px]">{session.title}</span>
                      </div>
                      <button
                        onClick={(e) => deleteSession(session.id, e)}
                        className="p-1 rounded-lg opacity-40 hover:opacity-100 hover:bg-white/5 text-rose-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chat message terminal wrapper */}
            <div className="flex-1 glass-premium rounded-3xl flex flex-col items-stretch overflow-hidden h-[480px] md:h-[550px]">
              
              {/* Terminal header controls */}
              <div className="px-5 py-3 border-b border-white/10 flex justify-between items-center bg-white/5 dark:bg-black/25 shrink-0">
                <div className="min-w-0">
                  <h3 className="text-xs font-bold uppercase tracking-wider truncate">{activeChat.title}</h3>
                  <p className="text-[10px] opacity-40 font-mono">Status: Connected • 16-bit PCM Core</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={exportChatSessionMarkdown}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition"
                    title="Export log as Markdown"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={clearCurrentMessages}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition text-rose-400"
                    title="Flush log buffers"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Chat message scroll content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {activeChat.messages.map((msg) => {
                  const isUser = msg.role === "user";
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 opacity-40 font-mono text-[9px] uppercase">
                        <span>{isUser ? profile.nickname : "Zoya"}</span>
                        <span>•</span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>

                      {/* Attached Multimedia Files */}
                      {msg.file && (
                        <div className="mb-2 p-2.5 rounded-2xl bg-white/5 border border-white/10 max-w-xs flex items-center space-x-2.5">
                          {msg.file.type.startsWith("image") ? (
                            <img src={msg.file.url} alt="multimodal attachment" className="w-12 h-12 object-cover rounded-xl" />
                          ) : (
                            <div className="p-2 bg-rose-500/10 rounded-xl">
                              <FileText className="w-6 h-6 text-rose-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">{msg.file.name}</p>
                            <span className="text-[9px] font-mono opacity-40">{msg.file.type}</span>
                          </div>
                        </div>
                      )}

                      {/* Glass Bubbles */}
                      <div
                        className={`px-4.5 py-3 rounded-2xl max-w-[85%] text-sm leading-relaxed relative group border ${
                          isUser
                            ? "bg-white/10 dark:bg-white/5 rounded-tr-none border-white/15"
                            : "rounded-tl-none border-white/5"
                        }`}
                        style={isUser ? undefined : { borderLeft: `3px solid ${pal.hex}`, background: isLight ? "rgba(255,255,255,0.85)" : "rgba(10,10,15,0.85)" }}
                      >
                        <p className="whitespace-pre-wrap select-text">{msg.text}</p>

                        {/* Copy button on hover */}
                        <div className="absolute right-2 bottom-1.5 opacity-0 group-hover:opacity-100 transition duration-300">
                          <button
                            onClick={() => copyMessageText(msg.text)}
                            className="p-1.5 rounded-lg bg-black/45 hover:bg-black/85 text-white active:scale-95 transition"
                            title="Copy message text"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Loading Thought Wave Synthesizer */}
                {isThinking && (
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-1.5 mb-1 opacity-40 font-mono text-[9px] uppercase">
                      <span>Zoya</span>
                      <span>•</span>
                      <span>Analyzing Telemetry</span>
                    </div>
                    <div className="px-5 py-3 rounded-2xl rounded-tl-none glass-premium border border-white/5 flex items-center space-x-2.5">
                      <div className="flex space-x-1">
                        <div className="w-2.5 h-2.5 rounded-full animate-bounce" style={{ backgroundColor: pal.hex, animationDelay: "0ms" }} />
                        <div className="w-2.5 h-2.5 rounded-full animate-bounce" style={{ backgroundColor: pal.hex, animationDelay: "150ms" }} />
                        <div className="w-2.5 h-2.5 rounded-full animate-bounce" style={{ backgroundColor: pal.hex, animationDelay: "300ms" }} />
                      </div>
                      <span className="text-xs opacity-50 font-mono">Synthesizing thoughts...</span>
                    </div>
                  </div>
                )}

                <div ref={chatBottomRef} />
              </div>

              {/* Suggestions chips */}
              {((activeChat.messages.length <= 1 && !isThinking) || (attachedFile?.type === "application/pdf")) && (
                <div className="px-5 py-3 shrink-0">
                  <div className="flex gap-2 overflow-x-auto pb-1.5">
                    {attachedFile?.type === "application/pdf" ? (
                      <button
                        onClick={() => handleSuggestionClick("Summarize this PDF document in detail with key bullet points")}
                        className="flex items-center space-x-1.5 shrink-0 px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs hover:bg-rose-500/20 transition active:scale-95"
                      >
                        <span className="text-sm">📝</span>
                        <span className="font-semibold">Summarize Attached PDF</span>
                      </button>
                    ) : (
                      terminalSuggestions.map((prompt, i) => (
                        <button
                          key={i}
                          onClick={() => handleSuggestionClick(prompt.text)}
                          className="flex items-center space-x-1.5 shrink-0 px-3.5 py-2 rounded-xl glass-premium text-xs hover:bg-white/10 hover:border-white/20 transition active:scale-95"
                        >
                          <span className="text-sm">{prompt.icon}</span>
                          <span className="font-semibold opacity-85">{prompt.text}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Attached file pre-preview pill */}
              {attachedFile && (
                <div className="px-5 py-2 shrink-0 bg-white/5 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center space-x-2 min-w-0">
                    {attachedFile.type.startsWith("image") ? (
                      <img src={attachedFile.url} alt="attached pre-view" className="w-9 h-9 object-cover rounded-lg shrink-0" />
                    ) : (
                      <div className="p-1.5 bg-rose-500/10 rounded-lg shrink-0">
                        <FileText className="w-5 h-5 text-rose-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{attachedFile.name}</p>
                      <span className="text-[9px] opacity-40 font-mono uppercase shrink-0">{attachedFile.type}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setAttachedFile(null)}
                    className="p-1.5 rounded-full hover:bg-white/10 transition text-rose-400 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Bottom text Input controller */}
              <div className="p-4 border-t border-white/10 shrink-0 flex items-center gap-2.5 bg-white/5 dark:bg-black/20">
                <div className="flex gap-1 shrink-0">
                  <label className="p-2.5 rounded-full glass-premium hover:bg-white/10 active:scale-95 transition cursor-pointer flex items-center justify-center">
                    <Paperclip className="w-4 h-4" />
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileAttachment}
                      className="hidden"
                    />
                  </label>
                  <button
                    onClick={activateCamera}
                    className="p-2.5 rounded-full glass-premium hover:bg-white/10 active:scale-95 transition"
                    title="Camera capture snap"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 relative flex items-center bg-white/5 dark:bg-black/25 rounded-2xl border border-white/10 px-3 py-1.5 focus-within:border-white/35 transition">
                  <input
                    type="text"
                    placeholder={`Banter in ${profile.language} with Zoya...`}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                    className="w-full bg-transparent border-none outline-none text-xs pr-8"
                  />
                  <button
                    onClick={toggleSpeechDictation}
                    className={`absolute right-2.5 p-1.5 rounded-lg transition active:scale-95 ${
                      isDictating ? "bg-rose-500 text-white animate-pulse" : "opacity-40 hover:opacity-100"
                    }`}
                    title="Speech dictation typing"
                  >
                    <Mic className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => sendChatMessage()}
                  className="p-3.5 rounded-full text-white shadow-lg shrink-0 hover:scale-105 active:scale-95 transition"
                  style={{ backgroundImage: `linear-gradient(to top right, ${pal.gradient})` }}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- BOT TOM CONTROLS FOOTER PANEL --- */}
      <footer className="w-full max-w-6xl px-4 md:px-10 pb-8 pt-2 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0 z-10 mx-auto relative">
        <div className="flex flex-col gap-0.5 items-center md:items-start text-center md:text-left">
          <span className="text-[9px] opacity-40 font-mono tracking-widest font-extrabold uppercase">Zoya Neural Status</span>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connectionStatus === "connected" ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
            <span className="text-xs font-mono font-semibold">
              {connectionStatus === "connected" ? "Live Gateway Connected (Gemini 3.1 Live)" : "Standby (16kHz Mic Buffer ready)"}
            </span>
          </div>
        </div>

        {/* Big Neon Microphone Center Wake Trigger Button */}
        <div className="flex items-center gap-3">
          <AnimatePresence>
            {connectionStatus === "connected" && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => {
                  setIsMuted(!isMuted);
                  showToast(isMuted ? "Audio speech output enabled." : "Audio output silenced.");
                }}
                className={`p-3.5 rounded-full border transition shadow-md ${
                  isMuted
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20"
                    : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                }`}
                title={isMuted ? "Unmute Sound" : "Mute Sound"}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </motion.button>
            )}
          </AnimatePresence>

          <button
            onClick={connectionStatus === "disconnected" || connectionStatus === "error" ? startSession : stopSession}
            className="w-16 h-16 rounded-full bg-gradient-to-tr flex items-center justify-center border-4 border-slate-950 hover:scale-105 active:scale-95 transition-all duration-300 shadow-xl"
            style={{
              backgroundImage: `linear-gradient(to top right, ${pal.gradient})`,
              boxShadow: `0 0 40px ${pal.hex}50`
            }}
            title={connectionStatus === "connected" ? "Return Zoya to Sleep" : "Wake Zoya Voice"}
          >
            {connectionStatus === "connected" ? (
              <div className="relative flex items-center justify-center">
                <span className="absolute w-4.5 h-4.5 bg-white rounded-full animate-ping opacity-75" />
                <Mic className="w-7 h-7 text-white relative z-10" />
              </div>
            ) : (
              <Power className="w-7 h-7 text-white hover:rotate-12 transition-transform" />
            )}
          </button>

          <AnimatePresence>
            {connectionStatus === "connected" && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={toggleMicMute}
                className={`p-3.5 rounded-full border transition shadow-md ${
                  isMicMuted
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-400 hover:bg-amber-500/30"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                }`}
                title={isMicMuted ? "Unmute Microphone" : "Mute Microphone"}
              >
                {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </motion.button>
            )}
          </AnimatePresence>

          <button
            onClick={shareCurrentQuote}
            className="p-3.5 rounded-full glass-premium text-white/60 hover:text-white transition"
            title="Share sassy quote"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        {/* Audio Flow parameters */}
        <div className="flex flex-col items-center md:items-end text-center md:text-right gap-0.5">
          <span className="text-[9px] opacity-40 font-mono tracking-widest font-extrabold uppercase">Audio Pipelines</span>
          <div className="text-right font-mono text-xs opacity-65">
            <span style={{ color: pal.hex }}>24.0kHz PCM16</span>
            <span className="mx-2 opacity-30">/</span>
            <span>16.0kHz Mic</span>
          </div>
        </div>
      </footer>

      {/* --- SETTINGS DRAWER OVERLAY --- */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-40 flex items-center justify-end bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full max-w-md h-full glass-premium shadow-2xl p-6 flex flex-col justify-between overflow-y-auto"
            >
              <div>
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5" style={{ color: pal.hex }} />
                    <h3 className="text-lg font-bold font-mono tracking-wider">Assistant Sync Config</h3>
                  </div>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="p-2 rounded-full hover:bg-white/10 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Select Accent Color */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider font-mono opacity-50 block mb-2.5">Custom Neon Accent</label>
                    <div className="grid grid-cols-4 gap-2">
                      {Object.keys(ACCENTS).map((acc) => {
                        const isSelected = profile.accent === acc;
                        const accentVal = ACCENTS[acc as AccentColor];
                        return (
                          <button
                            key={acc}
                            onClick={() => {
                              setProfile((prev) => ({ ...prev, accent: acc as AccentColor }));
                              showToast(`Accent color updated to ${acc}.`);
                            }}
                            className={`p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${
                              isSelected
                                ? "bg-white/15 border-2"
                                : "glass-premium hover:bg-white/10"
                            }`}
                            style={isSelected ? { borderColor: accentVal.hex } : undefined}
                          >
                            <div className="w-5 h-5 rounded-full" style={{ backgroundColor: accentVal.hex }} />
                            <span className="text-[10px] font-mono capitalize">{acc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* AI Personality dropdown */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider font-mono opacity-50 block mb-2">AI Personality Mode</label>
                    <select
                      value={profile.personality}
                      onChange={(e) => {
                        const p = e.target.value as AIPersonality;
                        setProfile((prev) => ({ ...prev, personality: p }));
                        showToast(`Personality synchronized to ${p}.`);
                      }}
                      className="w-full glass-premium p-3 rounded-2xl outline-none text-xs font-semibold focus:border-white/30"
                    >
                      <option value="Friendly" className="bg-[#050508] text-white">Friendly (Warm companion)</option>
                      <option value="Romantic" className="bg-[#050508] text-white">Romantic (Warm, flirty tease)</option>
                      <option value="Funny" className="bg-[#050508] text-white">Funny (Sarcastic roast assistant)</option>
                      <option value="Professional" className="bg-[#050508] text-white">Professional (Slick, concise guide)</option>
                    </select>
                  </div>

                  {/* Language support selection */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider font-mono opacity-50 block mb-2">Primary Language</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["English", "Hindi"] as const).map((lang) => {
                        const isSelected = profile.language === lang;
                        return (
                          <button
                            key={lang}
                            onClick={() => {
                              localStorage.setItem("zoya_explicit_lang", "true");
                              setProfile((prev) => ({ ...prev, language: lang }));
                              showToast(`Primary dialect set to ${lang}.`);
                            }}
                            className={`py-3 rounded-2xl text-xs font-bold transition ${
                              isSelected
                                ? `bg-gradient-to-tr ${pal.gradient} text-white`
                                : "glass-premium hover:bg-white/10"
                            }`}
                          >
                            {lang === "Hindi" ? "Hindi / Hinglish" : "English"}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Prebuilt voices dropdown */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider font-mono opacity-50 block mb-2">Synthesized Voice preset</label>
                    <select
                      value={profile.voice}
                      onChange={(e) => {
                        setProfile((prev) => ({ ...prev, voice: e.target.value }));
                        showToast(`Selected voice tone: ${e.target.value}`);
                      }}
                      className="w-full glass-premium p-3 rounded-2xl outline-none text-xs font-semibold focus:border-white/30"
                    >
                      <option value="Aoede" className="bg-[#050508] text-white">Aoede (Warm Soft Female - Recommended)</option>
                      <option value="Kore" className="bg-[#050508] text-white">Kore (Sassy Female)</option>
                      <option value="Charon" className="bg-[#050508] text-white">Charon (Expressive Female)</option>
                      <option value="Puck" className="bg-[#050508] text-white">Puck (Fast Male)</option>
                      <option value="Fenrir" className="bg-[#050508] text-white">Fenrir (Deep Male)</option>
                      <option value="Zephyr" className="bg-[#050508] text-white">Zephyr (Neutral Calm)</option>
                    </select>
                  </div>

                  {/* Voice Speed controller */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider font-mono opacity-50">Audio Flow Speed</label>
                      <span className="text-xs font-mono font-bold" style={{ color: pal.hex }}>{profile.voiceSpeed.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.6"
                      max="1.8"
                      step="0.1"
                      value={profile.voiceSpeed}
                      onChange={(e) => setProfile((prev) => ({ ...prev, voiceSpeed: parseFloat(e.target.value) }))}
                      className="w-full accent-neon-bg h-1 rounded-full bg-white/10 outline-none"
                    />
                  </div>

                  {/* Microphone Hardware & Diagnostic Setup */}
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mic className="w-4 h-4" style={{ color: pal.hex }} />
                        <label className="text-xs font-bold uppercase tracking-wider font-mono opacity-80">Microphone Input Hardware</label>
                      </div>
                      <button
                        onClick={refreshMicDevices}
                        className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition"
                        title="Scan audio input hardware"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <select
                      value={selectedMicId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setSelectedMicId(id);
                        localStorage.setItem("zoya_selected_mic_id", id);
                        showToast("Microphone input device updated.");
                        if (recorderRef.current && connectionStatus === "connected") {
                          startRecording();
                        }
                      }}
                      className="w-full glass-premium p-2.5 rounded-xl outline-none text-xs font-semibold focus:border-white/30 text-white/90"
                    >
                      <option value="" className="bg-[#050508] text-white">Default System Microphone</option>
                      {availableMics.map((mic, idx) => (
                        <option key={mic.deviceId || idx} value={mic.deviceId} className="bg-[#050508] text-white">
                          {mic.label || `Microphone ${idx + 1} (${mic.deviceId.slice(0, 8)}...)`}
                        </option>
                      ))}
                    </select>

                    {/* Microphone Diagnostic Tester */}
                    <div className="pt-2 border-t border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono opacity-50 uppercase font-bold">Mic Input Level Check</span>
                        {isMicTesting && (
                          <span className="text-[10px] font-mono text-emerald-400 font-bold animate-pulse">
                            {Math.round((micTestLevel / 255) * 100)}% Peak
                          </span>
                        )}
                      </div>

                      {/* VU Meter Bar */}
                      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden mb-2.5">
                        <div
                          className="h-full rounded-full transition-all duration-75"
                          style={{
                            width: `${Math.min(100, Math.max(0, (micTestLevel / 255) * 100))}%`,
                            backgroundColor: pal.hex,
                            boxShadow: `0 0 10px ${pal.hex}`
                          }}
                        />
                      </div>

                      <button
                        onClick={testMicrophoneInput}
                        disabled={isMicTesting}
                        className="w-full py-2 rounded-xl glass-premium hover:bg-white/10 transition text-xs font-bold flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-3.5 h-3.5" style={{ color: pal.hex }} />
                        {isMicTesting ? "Measuring Audio Telemetry..." : "Test Microphone Input"}
                      </button>
                    </div>
                  </div>

                  {/* Wake Word toggler */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
                    <div>
                      <span className="text-xs font-bold block">Background Wake Word</span>
                      <span className="text-[10px] opacity-45 font-mono">Listens for "Hey Zoya" when offline</span>
                    </div>
                    <button
                      onClick={() => {
                        setProfile((prev) => ({ ...prev, wakeWordEnabled: !prev.wakeWordEnabled }));
                        showToast(profile.wakeWordEnabled ? "Wake word standby inactive." : "Zoya is listening for 'Hey Zoya' background triggers.");
                      }}
                      className={`w-11 h-6 rounded-full p-1 transition duration-300 ${
                        profile.wakeWordEnabled ? "bg-[#ff007f]" : "bg-white/20"
                      }`}
                      style={{ backgroundColor: profile.wakeWordEnabled ? pal.hex : undefined }}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition duration-300 transform ${profile.wakeWordEnabled ? "translate-x-5" : ""}`} />
                    </button>
                  </div>

                  {/* Mobile App Converter Banner */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-pink-500/20" style={{ color: pal.hex }}>
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold block">Mobile App Converter</span>
                        <span className="text-[10px] opacity-50 font-mono">PWA & Buildozer APK Package</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowSettings(false);
                        setShowAppConverter(true);
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-md transition active:scale-95"
                      style={{ background: `linear-gradient(135deg, ${pal.hex}, #7000ff)` }}
                    >
                      Convert
                    </button>
                  </div>

                  {/* Premium Smart Memory, Alarms & Math tools */}
                  <PremiumWidgets
                    smartMemories={smartMemories}
                    setSmartMemories={setSmartMemories}
                    alerts={alerts}
                    setAlerts={setAlerts}
                    accentColor={pal.hex}
                    gradient={pal.gradient}
                    showToast={showToast}
                  />
                </div>
              </div>

              <div>
                <button
                  onClick={requestNotifications}
                  className="w-full text-center py-2 text-[10px] uppercase font-mono tracking-widest opacity-45 hover:opacity-100 transition"
                >
                  Link Browser Notifications
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- USER PROFILE CARD DRAW MODAL --- */}
      <AnimatePresence>
        {showProfileCard && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm glass-premium rounded-3xl p-6 shadow-2xl relative"
            >
              <button
                onClick={() => setShowProfileCard(false)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full flex items-center justify-center bg-gradient-to-tr shadow-lg mb-4" style={{ backgroundImage: `linear-gradient(to top right, ${pal.gradient})` }}>
                  <User className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-lg font-bold font-mono tracking-wider">User Profile</h3>
                <span className="text-[10px] opacity-40 font-mono mt-1">Standby compiled on Node.js</span>

                {/* Nickname input editor */}
                <div className="w-full mt-6 space-y-1.5 text-left">
                  <label className="text-[10px] font-bold opacity-45 font-mono uppercase tracking-wider">Configure Nickname</label>
                  <div className="relative flex items-center bg-white/5 dark:bg-black/25 rounded-2xl border border-white/10 px-3 py-2">
                    <input
                      type="text"
                      value={profile.nickname}
                      onChange={(e) => setProfile((prev) => ({ ...prev, nickname: e.target.value || "Darling" }))}
                      placeholder="My nickname..."
                      className="w-full bg-transparent border-none outline-none text-xs font-semibold"
                    />
                    <Check className="w-4 h-4 opacity-50 shrink-0" style={{ color: pal.hex }} />
                  </div>
                </div>

                <div className="mt-6 flex justify-center gap-1.5">
                  <span className="text-[9px] font-mono px-3 py-1 rounded-full bg-white/5 border border-white/5">ACCENT: {profile.accent.toUpperCase()}</span>
                  <span className="text-[9px] font-mono px-3 py-1 rounded-full bg-white/5 border border-white/5">VOICE: {profile.voice.toUpperCase()}</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- CAMERA FEED PREVIEW POPUP --- */}
      <AnimatePresence>
        {showCamera && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md px-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md glass-premium rounded-3xl p-5 flex flex-col items-center relative overflow-hidden"
            >
              <div className="absolute top-4 right-4 z-10">
                <button
                  onClick={closeCamera}
                  className="p-2 rounded-full bg-black/45 hover:bg-black/75 text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Target HUD scope lines */}
              <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-white/15">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover transform -scale-x-100"
                />
                
                {/* Visual HUD target ring */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center border-4 border-dashed border-white/10 m-8 rounded-full animate-spin" style={{ animationDuration: "20s" }} />
                <div className="absolute w-6 h-6 border-t-2 border-l-2 border-[#ff007f] top-4 left-4" />
                <div className="absolute w-6 h-6 border-t-2 border-r-2 border-[#ff007f] top-4 right-4" />
                <div className="absolute w-6 h-6 border-b-2 border-l-2 border-[#ff007f] bottom-4 left-4" />
                <div className="absolute w-6 h-6 border-b-2 border-r-2 border-[#ff007f] bottom-4 right-4" />
              </div>

              <div className="mt-5 w-full flex gap-3">
                <button
                  onClick={closeCamera}
                  className="flex-1 py-3 text-xs font-semibold glass-premium rounded-2xl hover:bg-white/10 transition"
                >
                  Abrogate
                </button>
                <button
                  onClick={captureCameraSnapshot}
                  className="flex-1 py-3 text-xs font-bold text-white rounded-2xl hover:opacity-95 transition shadow-lg"
                  style={{ backgroundImage: `linear-gradient(to top right, ${pal.gradient})` }}
                >
                  Transmit Frame
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- APP CONVERTER & NATIVE ANDROID BRIDGE MODAL --- */}
      <AppConverterModal
        isOpen={showAppConverter}
        onClose={() => setShowAppConverter(false)}
        accentColor={pal.hex}
        gradient={pal.gradient}
        showToast={showToast}
      />
    </div>
  );
}
