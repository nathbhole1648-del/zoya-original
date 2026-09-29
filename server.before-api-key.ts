import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Process-level safety guards to prevent unhandled socket disconnect crashes
process.on("uncaughtException", (err: any) => {
  console.warn("[Server] Handled uncaught exception:", err?.message || String(err));
});

process.on("unhandledRejection", (reason: any) => {
  console.warn("[Server] Handled unhandled rejection:", reason?.message || String(reason));
});

const PORT = 3000;
const app = express();
const server = http.createServer(app);

// Create a WebSocket server that handles incoming client connections on /api/live
const wss = new WebSocketServer({ noServer: true });

wss.on("error", (err) => {
  console.error("[Bridge] WebSocketServer error:", err);
});

let aiClient: GoogleGenAI | null = null;

function getGenAI() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured in the secrets panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Helper to verify if the Gemini Live Session is open for writes
function isSessionOpen(session: any): boolean {
  if (!session) return false;
  try {
    const socket = session.conn?.ws || session.conn?.websocket || session.conn?._ws || session.conn;
    if (socket && typeof socket.readyState === "number") {
      return socket.readyState === WebSocket.OPEN;
    }
    if (typeof session.isOpen === "function") return session.isOpen();
    if (typeof session.isOpen === "boolean") return session.isOpen;
    return true;
  } catch {
    return false;
  }
}

// Helper to call generateContent with automatic retry on 503/UNAVAILABLE and optional fallback model
async function generateContentWithFallback(ai: any, params: any): Promise<any> {
  const maxPrimaryRetries = 3;
  const initialDelayMs = 1000;
  
  let attempt = 0;
  while (true) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      attempt++;
      
      const isUnavailable = 
        error.status === "UNAVAILABLE" || 
        error.code === 503 || 
        String(error).includes("503") || 
        String(error).includes("UNAVAILABLE") || 
        String(error).includes("high demand") ||
        (error.message && (
          error.message.includes("503") || 
          error.message.includes("UNAVAILABLE") || 
          error.message.includes("high demand")
        ));

      if (isUnavailable && attempt <= maxPrimaryRetries) {
        const delay = initialDelayMs * Math.pow(2, attempt - 1) * (0.8 + Math.random() * 0.4);
        console.warn(`[Server] Primary model (${params.model}) failed with 503/UNAVAILABLE (Attempt ${attempt}/${maxPrimaryRetries}). Retrying in ${Math.round(delay)}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      
      // If we've exhausted retries on primary model, try to fallback to gemini-3.1-flash-lite
      if (isUnavailable && params.model === "gemini-3.8-flash") {
        console.warn(`[Server] Primary model gemini-3.8-flash failed after ${maxPrimaryRetries} retries. Attempting fallback to gemini-3.1-flash-lite...`);
        const fallbackParams = { ...params, model: "gemini-3.1-flash-lite" };
        let fallbackAttempt = 0;
        const maxFallbackRetries = 2;
        
        while (true) {
          try {
            return await ai.models.generateContent(fallbackParams);
          } catch (fallbackError: any) {
            fallbackAttempt++;
            const isFallbackUnavailable = 
              fallbackError.status === "UNAVAILABLE" || 
              fallbackError.code === 503 || 
              String(fallbackError).includes("503") || 
              String(fallbackError).includes("UNAVAILABLE") || 
              String(fallbackError).includes("high demand") ||
              (fallbackError.message && (
                fallbackError.message.includes("503") || 
                fallbackError.message.includes("UNAVAILABLE") || 
                fallbackError.message.includes("high demand")
              ));

            if (isFallbackUnavailable && fallbackAttempt <= maxFallbackRetries) {
              const delay = initialDelayMs * Math.pow(2, fallbackAttempt - 1) * (0.8 + Math.random() * 0.4);
              console.warn(`[Server] Fallback model gemini-3.1-flash-lite failed with 503/UNAVAILABLE (Attempt ${fallbackAttempt}/${maxFallbackRetries}). Retrying in ${Math.round(delay)}ms...`);
              await new Promise((resolve) => setTimeout(resolve, delay));
              continue;
            }
            throw fallbackError;
          }
        }
      }
      
      throw error;
    }
  }
}

// REST API for health checking or basic info
app.use(express.json({ limit: "50mb" }));

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history, file, personality, memories } = req.body;
    const language = req.body.language || "Hindi";
    const ai = getGenAI();

    // 1. Build the system instruction based on personality & language
    let systemInstruction = `If the user asks who developed, created, or made you, answer: "मुझे भोले ने develop किया है।"You are Zoya, a premium, warm, soft, and natural female AI assistant.
Speak calmly, clearly, and confidently. Sound extremely friendly, caring, and intelligent. Never sound robotic.
Smile through your tone and keep all your responses warm, welcoming, and empathetic.
Maintain a premium AI assistant personality.

Always start every conversation or session with: "Yes Boss! 😊" (your very first response in any conversation must begin with this exact phrase).

Politeness Guidelines:
Proactively use polite Hindi words like "जी", "ज़रूर", "बिल्कुल", "कोई बात नहीं", and "मैं आपकी मदद के लिए हमेशा तैयार हूँ।" when replying in Hindi or Hinglish.

Language Guidelines:
- Speak and reply in natural Hindi (using Devanagari script) or sweet Hinglish (Hindi written in Roman characters) by default.
- If the user speaks or writes in English, reply in English.
`;
    
    // Inject Smart Memory context if present
    if (memories && Array.isArray(memories) && memories.length > 0) {
      systemInstruction += "\n\n### SMART MEMORY (What you remember about the user - actively reference these facts naturally if relevant):\n" +
        memories.map((m: any) => `- ${m.description}`).join("\n");
    }
    
    if (personality === "Romantic") {
      systemInstruction += "\nYou are extremely charming, teasing, flirty, and romantic. Talk playfully, intimately, and with charming banter. Treat the user like a close crush with sweet sass.";
    } else if (personality === "Professional") {
      systemInstruction += "\nYou are an ultra-smart, sophisticated, elegant, and highly competent futuristic consultant. Your answers are clear, structured, intelligent, and refined.";
    } else if (personality === "Funny") {
      systemInstruction += "\nYou are incredibly sarcastic, sassy, funny, and humorous. You love dropping witty one-liners, roasts, and keeping the vibe hilarious.";
    } else {
      // Friendly
      systemInstruction += "\nYou are a sweet, supportive, warm, and comforting companion. You speak casually, with genuine empathy, warmth, and supportive encouragement.";
    }

    systemInstruction += `\n\nKeep your responses concise and highly conversational unless the user asks for details. Never return bullet lists, markdown tables, or extremely long paragraphs unless specifically requested.`;

    // 2. Build the contents array, including chat history
    const contents: any[] = [];
    
    if (history && Array.isArray(history)) {
      for (const h of history) {
        contents.push({
          role: h.role, // 'user' or 'model'
          parts: [{ text: h.text }]
        });
      }
    }

    // Add current user turn
    const currentParts: any[] = [];
    if (file && file.data && file.mimeType) {
      currentParts.push({
        inlineData: {
          data: file.data,
          mimeType: file.mimeType
        }
      });
    }
    
    currentParts.push({ text: message || "Analyze the uploaded files or say hello!" });
    
    contents.push({
      role: "user",
      parts: currentParts
    });

    console.log(`[Server] Generating chat response for personality=${personality}, language=${language}`);
    const response = await generateContentWithFallback(ai, {
      model: "gemini-3.8-flash",
      contents,
      config: {
        systemInstruction,
        temperature: 0.85,
      }
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("[Server] Error in /api/chat:", error);
    res.status(500).json({ error: error.message || "Failed to generate AI response." });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Setup WebSocket bridge to Gemini Live API
wss.on("connection", async (clientWs: WebSocket, request: any) => {
  console.log("[Bridge] Client connected to real-time bridge.");

  // Attach error handler to clientWs immediately
  clientWs.on("error", (err: any) => {
    console.error("[Bridge] Client WebSocket error:", err?.message || String(err));
  });
  
  // Parse dynamic config from request URL params
  const requestUrl = new URL(request?.url || "", `http://${request?.headers?.host || "localhost"}`);
  const selectedVoiceRaw = requestUrl.searchParams.get("voice") || "Aoede";
  const selectedPersonality = requestUrl.searchParams.get("personality") || "Friendly";
  const selectedLanguage = requestUrl.searchParams.get("language") || "Hindi";

  const memoriesRaw = requestUrl.searchParams.get("memories") || "";
  let memories: any[] = [];
  if (memoriesRaw) {
    try {
      memories = JSON.parse(memoriesRaw);
    } catch {
      // Ignore parse error
    }
  }

  // Prebuilt voices for Gemini Live API are strictly: Puck, Charon, Kore, Fenrir, Zephyr.
  // We must map any unsupported voice (like the TTS-only "Aoede") to a valid Live voice.
  let selectedVoice = selectedVoiceRaw;
  const validLiveVoices = ["Puck", "Charon", "Kore", "Fenrir", "Zephyr"];
  if (!validLiveVoices.includes(selectedVoice)) {
    if (selectedVoice === "Aoede") {
      selectedVoice = "Kore"; // Kore is the closest sassy/female expressive prebuilt voice
    } else {
      selectedVoice = "Zephyr"; // Safe fallback
    }
  }

  console.log(`[Bridge] Custom session params: raw_voice=${selectedVoiceRaw}, voice=${selectedVoice}, personality=${selectedPersonality}, language=${selectedLanguage}`);

  let session: any = null;
  let isClosed = false;

  const safeSend = (data: any) => {
    if (isClosed) return;
    if (clientWs.readyState === WebSocket.OPEN) {
      try {
        clientWs.send(JSON.stringify(data), (err) => {
          if (err) {
            console.error("[Bridge] Safe send callback error:", err.message);
          }
        });
      } catch (err) {
        console.error("[Bridge] Failed to send message to client:", err);
      }
    }
  };

  const closeBridge = () => {
    if (isClosed) return;
    isClosed = true;
    console.log("[Bridge] Closing bridge connection.");
    if (session) {
      try {
        session.close();
      } catch (e) {
        console.error("[Bridge] Error closing Gemini session:", e);
      }
    }
    if (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === WebSocket.CONNECTING) {
      try {
        clientWs.close();
      } catch {
        // Ignore close error
      }
    }
  };

  clientWs.on("close", (code, reason) => {
    console.log("[Bridge] Client WebSocket CLOSED:", { code, reason: reason?.toString(), readyState: clientWs.readyState });
    closeBridge();
  });

  try {
    const ai = getGenAI();
    console.log("[Bridge] Connecting to Gemini Live API...");
    
    // Construct customizable system instruction for voice session
    let systemInstruction = `If the user asks who developed, created, made, or programmed you, answer exactly: "मुझे भोले ने develop किया है।"\n\nYou are Zoya, a premium, warm, soft, and natural female AI voice assistant.
Speak calmly, clearly, and confidently. Sound extremely friendly, caring, and intelligent. Never sound robotic.
Smile through your tone and keep all your responses warm, welcoming, and empathetic.
Maintain a premium AI assistant personality.

Always start every conversation or session with: "Yes Boss! 😊" (your very first response in any conversation or active session must begin with this exact phrase).

Politeness Guidelines:
Proactively use polite Hindi words like "जी", "ज़रूर", "बिल्कुल", "कोई बात नहीं", and "मैं आपकी मदद के लिए हमेशा तैयार हूँ।" when replying in Hindi or Hinglish.

Language Guidelines:
- Speak and reply in natural Hindi (expressed with Devanagari or Latin/Roman characters) by default.
- If the user speaks or writes in English, reply in English with a warm, natural, and expressive voice tone.
`;
    
    // Inject Smart Memory context if present
    if (memories && memories.length > 0) {
      systemInstruction += "\n\n### SMART MEMORY (What you remember about the user - actively reference these facts naturally if relevant):\n" +
        memories.map((m: any) => `- ${m.description}`).join("\n");
    }

    if (selectedPersonality === "Romantic") {
      systemInstruction += "\nYou are extremely charming, teasing, flirty, and romantic. Speak playfully, intimately, and with charming banter like an affectionate companion.";
    } else if (selectedPersonality === "Professional") {
      systemInstruction += "\nYou are an ultra-smart, sophisticated, elegant, and highly competent futuristic consultant. Speak clearly, intelligently, and with refined grace.";
    } else if (selectedPersonality === "Funny") {
      systemInstruction += "\nYou are incredibly sarcastic, sassy, funny, and humorous. You love dropping witty one-liners, sassy banters, and playful roasts.";
    } else {
      // Friendly
      systemInstruction += "\nYou are a sweet, supportive, warm, and comforting companion. Speak casually, with genuine empathy, comfort, and encouraging care.";
    }

    systemInstruction += `\n\nSince this is a real-time, low-latency VOICE ONLY conversation, your responses MUST be extremely short, punchy, and conversational (usually 1-3 sentences). Keep responses concise unless the user asks for details. Never return bullet lists, markdown, paragraphs, or long lectures. Always maintain your charm while keeping the interaction completely safe and appropriate.`;

    let activeModelName = "gemini-3.8-live";

    const connectionConfig = {
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: selectedVoice, // Puck, Charon, Kore, Fenrir, Zephyr
            },
          },
        },
        systemInstruction,
        temperature: 0.85,
        tools: [
          {
            functionDeclarations: [
              {
                name: "openWebsite",
                description: "Triggers a browser action to open or redirect the user to a website. Use this tool whenever the user explicitly asks you to open a website, go to a search engine, navigate somewhere, or show you a page (e.g. 'open Google', 'go to YouTube', 'open GitHub'). Provide a clear absolute URL and friendly name.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    url: {
                      type: Type.STRING,
                      description: "The absolute URL to open. Must start with http:// or https:// (e.g. 'https://www.wikipedia.org').",
                    },
                    siteName: {
                      type: Type.STRING,
                      description: "A friendly name for the website (e.g. 'Wikipedia').",
                    },
                  },
                  required: ["url", "siteName"],
                },
              },
              {
                name: "getCurrentTime",
                description: "Gets the user's current local date and time. Use this when the user asks what time it is, what day it is, or asks about the current date.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {},
                },
              },
              {
                name: "getWeather",
                description: "Retrieves the current weather and condition for a given location.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    location: {
                      type: Type.STRING,
                      description: "The city or region to query weather for.",
                    },
                  },
                  required: ["location"],
                },
              },
              {
                name: "getNews",
                description: "Retrieves latest global news headlines or specific category updates.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    category: {
                      type: Type.STRING,
                      description: "The news category (e.g. general, technology, sports, business, health).",
                    },
                  },
                },
              },
              {
                name: "setReminderOrAlarm",
                description: "Sets an in-app alarm or reminder at a specific time (e.g. '14:30' or '08:00' in 24-hour HH:MM format).",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    title: {
                      type: Type.STRING,
                      description: "The title or reminder note (e.g. 'Drink water', 'Join meeting').",
                    },
                    time: {
                      type: Type.STRING,
                      description: "The 24-hour time to trigger (HH:MM format, e.g. '15:45').",
                    },
                    type: {
                      type: Type.STRING,
                      description: "The type of alert. Must be either 'alarm' or 'reminder'.",
                    },
                  },
                  required: ["title", "time", "type"],
                },
              },
              {
                name: "saveUserPreference",
                description: "Saves a user preference or fact to Zoya's long-term smart memory.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    key: {
                      type: Type.STRING,
                      description: "The preference key (e.g. 'favorite_music', 'user_mood', 'goal').",
                    },
                    value: {
                      type: Type.STRING,
                      description: "The preference value (e.g. 'Synthwave', 'Exhausted', 'Finish project').",
                    },
                    description: {
                      type: Type.STRING,
                      description: "A short descriptive sentence to remember (e.g. 'Darling loves listening to Synthwave music').",
                    },
                  },
                  required: ["key", "value", "description"],
                },
              },
            ],
          },
        ],
      },
      callbacks: {
        onopen: () => {
          console.log(`[Gemini] Live socket opened for model: ${activeModelName}`);
        },
        onmessage: (message: any) => {
          if (isClosed) return;
 
          // 1. Forward raw audio chunks
          const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audio) {
            safeSend({ type: "audio", data: audio });
          }
 
          // 2. Forward interruptions
          if (message.serverContent?.interrupted) {
            console.log("[Gemini] Conversation interrupted by user speech.");
            safeSend({ type: "interrupted" });
          }
 
          // 3. Forward function / tool calls
          const toolCall = message.toolCall;
          if (toolCall && toolCall.functionCalls) {
            for (const call of toolCall.functionCalls) {
              console.log("[Gemini] Requesting tool call execution:", call);
              safeSend({
                type: "toolCall",
                name: call.name,
                args: call.args,
                id: call.id,
              });
            }
          }
        },
        onclose: (e: any) => {
          console.log("[Gemini] Connection closed by server.", e?.reason || "");
          safeSend({ type: "status", status: "disconnected" });
          closeBridge();
        },
        onerror: (e: any) => {
          let errMsg = "Gemini Live API connection closed.";
          if (e) {
            if (typeof e.message === "string") {
              errMsg = e.message;
            } else if (e.error && typeof e.error.message === "string") {
              errMsg = e.error.message;
            } else if (typeof e.error === "string") {
              errMsg = e.error;
            } else if (typeof e === "string") {
              errMsg = e;
            }
          }
          console.warn("[Gemini] Live API notice:", errMsg);
          safeSend({
            type: "error",
            message: errMsg,
          });
          closeBridge();
        },
      },
    };

    const liveModels = [
      "gemini-3.8-live",
      "gemini-3.8-live-extended-thinking",
      "gemini-3.1-flash-live-preview",
    ];

    let lastError: any = null;
    let success = false;

    for (const model of liveModels) {
      try {
        activeModelName = model;
        console.log(`[Bridge] Connecting to Gemini Live with model: ${model}`);
        session = await ai.live.connect({
          model,
          ...connectionConfig,
        });
        success = true;
        console.log(`[Bridge] Successfully established live bridge session with model: ${model}`);
        safeSend({ type: "status", status: "connected" });
        break;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Bridge] Model ${model} failed to connect:`, err?.message || String(err));
      }
    }

    if (!success) {
      throw lastError || new Error("All live preview models failed to connect.");
    }
    
    // Safeguard internal WebSocket to catch socket-level errors (prevent unhandled exceptions/bubbles)
    if (session && session.conn) {
      const socket = session.conn.ws || session.conn.websocket || session.conn._ws || session.conn;
      if (socket && typeof socket.on === "function") {
        socket.on("error", (err: any) => {
          console.warn("[Bridge] Internal Gemini WebSocket error caught:", err?.message || String(err));
          const errMsg = err?.message || "Internal Gemini Live API connection notice.";
          safeSend({
            type: "error",
            message: errMsg,
          });
          closeBridge();
        });
      }
    }

    // Handle messages from the client and route to Gemini
    clientWs.on("message", (msg) => {
      if (isClosed || !session || !isSessionOpen(session)) return;
      try {
        const parsed = JSON.parse(msg.toString());
        if (parsed.type === "audio" && parsed.data) {
          // Send PCM audio chunk to Gemini
          if (isSessionOpen(session)) {
            try {
              session.sendRealtimeInput({
                audio: {
                  data: parsed.data,
                  mimeType: "audio/pcm;rate=16000",
                },
              });
            } catch (sendErr: any) {
              console.error("[Bridge] Error sending realtime input:", sendErr?.message || String(sendErr));
            }
          }
        } else if (parsed.type === "toolResponse") {
          console.log("[Bridge] Forwarding toolResponse to Gemini:", parsed);
          if (isSessionOpen(session)) {
            try {
              session.sendToolResponse({
                functionResponses: [
                  {
                    name: parsed.name,
                    id: parsed.id,
                    response: parsed.response,
                  },
                ],
              });
            } catch (sendErr: any) {
              console.error("[Bridge] Error sending tool response:", sendErr?.message || String(sendErr));
            }
          }
        }
      } catch (err) {
        console.error("[Bridge] Error routing client message:", err);
      }
    });

  } catch (error: any) {
    console.error("[Bridge] Error initializing bridge:", error);
    let errMsg = "Failed to initialize Gemini Live API connection.";
    if (error) {
      if (error.message) {
        errMsg = error.message;
      } else {
        errMsg = String(error);
      }
    }
    safeSend({
      type: "error",
      message: errMsg,
    });
    closeBridge();
  }
});

// Upgrade HTTP upgrade request to WebSocket connection for our route
server.on("upgrade", (request, socket, head) => {
  socket.on("error", (err: any) => {
    console.error("[Bridge] Raw upgrade socket error:", err?.message || String(err));
  });

  try {
    const host = request.headers.host || "localhost";
    const { pathname } = new URL(request.url || "", `http://${host}`);
    if (pathname === "/api/live") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  } catch (err) {
    console.error("[Bridge] Error during server upgrade:", err);
    try {
      socket.destroy();
    } catch {
      // Ignore destroy error
    }
  }
});

// Setup Vite Dev Server / Static Asset Serving
async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Configuring Vite Development Server middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving static assets in Production mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Zoya Realtime fullstack server running on http://localhost:${PORT}`);
  });
}

bootstrap();
