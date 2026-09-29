import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Smile } from "lucide-react";

interface ZoyaAvatarProps {
  connectionStatus: "connected" | "connecting" | "disconnected" | "error";
  voiceState: "idle" | "listening" | "speaking";
  micLevel: number;
  speakerLevel: number;
  accentColor: string;
}

interface Particle {
  x: number;
  y: number;
  angle: number;
  orbitRadius: number;
  speed: number;
  size: number;
  opacity: number;
  color: string;
  vx: number; // velocity x (for explosion)
  vy: number; // velocity y (for explosion)
  life: number; // lifespan
  maxLife: number;
}

export const ZoyaAvatar: React.FC<ZoyaAvatarProps> = ({
  connectionStatus,
  voiceState,
  micLevel,
  speakerLevel,
  accentColor = "#00f2ff",
}) => {
  // --- UI Layout Modes ---
  // Default to 'orb' as requested by the user, allow toggling to 'face' for the android avatar
  const [mode, setMode] = useState<"orb" | "face">("orb");

  // --- Common Connection Flags ---
  const isConnected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";
  const isSpeaking = voiceState === "speaking";
  const isListening = voiceState === "listening";

  // Canvas ref for the premium Neural Orb visualizer
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // --- Android Avatar Spring Physics Rigging States ---
  const [rig, setRig] = useState({
    headX: 0,
    headY: 0,
    headZ: 0,
    eyeLookX: 0,
    eyeLookY: 0,
    blinkL: 1.0,
    blinkR: 1.0,
    mouthOpen: 0.0,
    mouthSmile: 0.2,
    hairSwayL: 0,
    hairSwayR: 0,
    breathPhase: 0,
  });

  const physicsRef = useRef({
    headX: 0, headXVel: 0,
    headY: 0, headYVel: 0,
    headZ: 0, headZVel: 0,
    eyeLookX: 0, eyeLookY: 0,
    blinkL: 1.0, blinkR: 1.0,
    mouthOpen: 0,
    mouthSmile: 0.2,
    hairAngle: 0, hairVelocity: 0,
    targetHeadX: 0,
    targetHeadY: 0,
    targetHeadZ: 0,
    targetEyeLookX: 0,
    targetEyeLookY: 0,
    targetMouthOpen: 0,
    targetMouthSmile: 0.2,
    blinkTimer: 0,
    lastUpdate: 0,
  });

  // Dynamic status-dependent color coordinates
  const getGlowColor = () => {
    if (!isConnected) return "#557799"; // Sleeping Slate
    if (isSpeaking) return accentColor || "#ff007f"; // Vibrant Magenta/Accent
    if (isListening) return "#39ff14"; // Live Green
    if (isConnecting) return "#9d00ff"; // Processing Deep Purple
    return "#00f2ff"; // Active Standby Cyan
  };

  // --- Android Face Rigging Animation Loop ---
  useEffect(() => {
    if (mode !== "face") return;

    let animId: number;
    physicsRef.current.lastUpdate = performance.now();

    const updatePhysics = (timestamp: number) => {
      const dt = Math.min((timestamp - physicsRef.current.lastUpdate) / 1000, 0.1);
      physicsRef.current.lastUpdate = timestamp;

      const state = physicsRef.current;

      // 1. Idle head & eye drift (Saccadic behaviors)
      if (isConnected) {
        if (isSpeaking) {
          if (Math.random() < 0.04) {
            state.targetHeadX = (Math.random() - 0.5) * 0.35;
            state.targetHeadY = (Math.random() - 0.5) * 0.25;
            state.targetHeadZ = state.targetHeadX * -8;
            state.targetEyeLookX = state.targetHeadX * 0.5 + (Math.random() - 0.5) * 0.2;
            state.targetEyeLookY = state.targetHeadY * 0.5 + (Math.random() - 0.5) * 0.15;
          }
          state.targetMouthSmile = 0.45;
        } else if (isListening) {
          state.targetHeadX = (Math.random() - 0.5) * 0.15;
          state.targetHeadY = 0.1;
          state.targetHeadZ = 0;
          state.targetEyeLookX = (Math.random() - 0.5) * 0.05;
          state.targetEyeLookY = -0.05;
          state.targetMouthSmile = 0.6;
        } else {
          if (Math.random() < 0.02) {
            state.targetHeadX = (Math.random() - 0.5) * 0.5;
            state.targetHeadY = (Math.random() - 0.5) * 0.3;
            state.targetHeadZ = state.targetHeadX * -5;
            state.targetEyeLookX = state.targetHeadX * 0.6 + (Math.random() - 0.5) * 0.3;
            state.targetEyeLookY = state.targetHeadY * 0.6 + (Math.random() - 0.5) * 0.2;
          }
          state.targetMouthSmile = 0.25;
        }
      } else {
        state.targetHeadX = 0;
        state.targetHeadY = 0.15;
        state.targetHeadZ = 1.5;
        state.targetEyeLookX = 0;
        state.targetEyeLookY = 0.2;
        state.targetMouthSmile = 0.1;
      }

      // 2. Head Spring physics solver
      const springK = 65;
      const springDamp = 11;
      
      const forceX = (state.targetHeadX - state.headX) * springK - state.headXVel * springDamp;
      state.headXVel += forceX * dt;
      state.headX += state.headXVel * dt;

      const forceY = (state.targetHeadY - state.headY) * springK - state.headYVel * springDamp;
      state.headYVel += forceY * dt;
      state.headY += state.headYVel * dt;

      const forceZ = (state.targetHeadZ - state.headZ) * springK - state.headZVel * springDamp;
      state.headZVel += forceZ * dt;
      state.headZ += state.headZVel * dt;

      state.eyeLookX += (state.targetEyeLookX - state.eyeLookX) * 12 * dt;
      state.eyeLookY += (state.targetEyeLookY - state.eyeLookY) * 12 * dt;

      // 3. Double Eyelid Blinking
      state.blinkTimer += dt;
      if (isConnected) {
        if (state.blinkTimer > 0) {
          state.blinkL = 0.0;
          state.blinkR = 0.0;
          state.blinkTimer = -(3.0 + Math.random() * 4.0);
        } else if (state.blinkL < 1.0) {
          state.blinkL = Math.min(state.blinkL + 14 * dt, 1.0);
          state.blinkR = Math.min(state.blinkR + 14 * dt, 1.0);
        }
      } else {
        state.blinkL = 0.0;
        state.blinkR = 0.0;
      }

      // 4. Low-pass Lip Sync
      if (isConnected && isSpeaking) {
        const normalizedSpk = Math.min(speakerLevel / 220, 1.0);
        state.targetMouthOpen = 0.1 + normalizedSpk * 0.9;
      } else if (isConnected && isListening) {
        const normalizedMic = Math.min(micLevel / 220, 1.0);
        state.targetMouthOpen = normalizedMic * 0.15;
      } else {
        state.targetMouthOpen = 0;
      }

      state.mouthOpen += (state.targetMouthOpen - state.mouthOpen) * 18 * dt;
      state.mouthSmile += (state.targetMouthSmile - state.mouthSmile) * 6 * dt;

      // 5. Hair Physics
      const hairK = 90;
      const hairDamp = 6;
      const inertiaForce = state.headXVel * 0.15 + state.headZVel * 0.08;
      
      const hairForce = (-state.hairAngle) * hairK - state.hairVelocity * hairDamp + inertiaForce;
      state.hairVelocity += hairForce * dt;
      state.hairAngle += state.hairVelocity * dt;

      const windDrift = Math.sin(timestamp * 0.005) * 0.015;
      const swayLeft = state.hairAngle + windDrift;
      const swayRight = -state.hairAngle + windDrift;

      setRig({
        headX: state.headX,
        headY: state.headY,
        headZ: state.headZ,
        eyeLookX: state.eyeLookX,
        eyeLookY: state.eyeLookY,
        blinkL: state.blinkL,
        blinkR: state.blinkR,
        mouthOpen: state.mouthOpen,
        mouthSmile: state.mouthSmile,
        hairSwayL: swayLeft,
        hairSwayR: swayRight,
        breathPhase: timestamp * 0.002,
      });

      animId = requestAnimationFrame(updatePhysics);
    };

    animId = requestAnimationFrame(updatePhysics);
    return () => cancelAnimationFrame(animId);
  }, [mode, connectionStatus, voiceState, speakerLevel, micLevel]);

  // --- Neural Orb Canvas Animation Loop (60 FPS, Retina Optimized) ---
  useEffect(() => {
    if (mode !== "orb") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let particles: Particle[] = [];
    const numParticles = 40;

    // Set pixel ratio for sharp displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const cx = width / 2;
    const cy = height / 2;

    // Helper: Initialize particles
    const initParticles = () => {
      particles = [];
      const colors = ["#00f2ff", "#ff007f", "#9d00ff", "#39ff14"];
      for (let i = 0; i < numParticles; i++) {
        const angle = Math.random() * Math.PI * 2;
        const orbitRadius = 40 + Math.random() * 70;
        particles.push({
          x: cx + Math.cos(angle) * orbitRadius,
          y: cy + Math.sin(angle) * orbitRadius,
          angle,
          orbitRadius,
          speed: (0.01 + Math.random() * 0.015) * (Math.random() > 0.5 ? 1 : -1),
          size: 1 + Math.random() * 2.5,
          opacity: 0.2 + Math.random() * 0.6,
          color: colors[Math.floor(Math.random() * colors.length)],
          vx: 0,
          vy: 0,
          life: 0,
          maxLife: 0,
        });
      }
    };

    initParticles();

    let time = 0;
    let breathAcc = 0;

    const drawOrb = () => {
      // Clear canvas with transparent background
      ctx.clearRect(0, 0, width, height);

      time += 0.04;
      
      // Update custom status coefficients
      const amplitudeFactor = isConnected ? 1.0 : 0.35;
      const finalGlow = getGlowColor();

      // Slow organic breath accumulator
      const breathFreq = isConnecting ? 0.09 : isSpeaking ? 0.06 : isListening ? 0.08 : 0.025;
      breathAcc += breathFreq;
      const breathScale = 1.0 + Math.sin(breathAcc) * (isSpeaking ? 0.08 : isListening ? 0.05 : 0.035);

      // --- 1. Background Aura Glow Layers ---
      ctx.globalCompositeOperation = "screen";
      
      const glowGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 95);
      glowGrad.addColorStop(0, finalGlow + "26"); // 15% opacity
      glowGrad.addColorStop(0.4, isSpeaking ? "#ff007f15" : "#9d00ff15");
      glowGrad.addColorStop(1, "rgba(0,0,0,0)");
      
      ctx.beginPath();
      ctx.arc(cx, cy, 95, 0, Math.PI * 2);
      ctx.fillStyle = glowGrad;
      ctx.fill();

      // --- 2. Update and Render Particle Field ---
      particles.forEach((p, idx) => {
        if (!isConnected) {
          // Sleeping/disconnected - slow lazy floating particles
          p.angle += p.speed * 0.3;
          p.orbitRadius += Math.sin(time + idx) * 0.08;
          p.x = cx + Math.cos(p.angle) * p.orbitRadius;
          p.y = cy + Math.sin(p.angle) * p.orbitRadius;
          p.opacity = 0.2 + Math.sin(time + idx) * 0.15;
        } else if (isListening) {
          // Listening mode - Particles gravitate inwards to represent data capture
          p.angle += p.speed * 1.5;
          p.orbitRadius -= 1.2; // pull inwards
          
          // Modulate color to neon cyan / listening green
          p.color = idx % 2 === 0 ? "#00f2ff" : "#39ff14";

          if (p.orbitRadius < 18) {
            // Respawn particles on outer boundary
            p.orbitRadius = 100 + Math.random() * 25;
            p.angle = Math.random() * Math.PI * 2;
          }
          p.x = cx + Math.cos(p.angle) * p.orbitRadius;
          p.y = cy + Math.sin(p.angle) * p.orbitRadius;
          p.opacity = Math.min(1.0, (p.orbitRadius - 15) / 80);
        } else if (isConnecting) {
          // Thinking/connecting state - planetary acceleration ring (Equator halo)
          p.angle += 0.05; // rapid rotation
          const targetOrbit = 74 + Math.sin(time + idx) * 5;
          p.orbitRadius += (targetOrbit - p.orbitRadius) * 0.1;
          p.color = "#9d00ff";
          p.x = cx + Math.cos(p.angle) * p.orbitRadius;
          p.y = cy + Math.sin(p.angle) * p.orbitRadius * 0.35 + (idx % 2 === 0 ? -10 : 10); // flat planetary ring look
          p.opacity = 0.5 + Math.sin(time + idx) * 0.3;
        } else if (isSpeaking) {
          // Speaking mode - Sound level spikes trigger particles exploding from core
          const volNormalized = speakerLevel / 255;
          
          if (p.life > 0) {
            // Run explosion physics
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 1;
            p.opacity = p.life / p.maxLife;
            
            // Decelerate
            p.vx *= 0.94;
            p.vy *= 0.94;
          } else {
            // Re-anchor or trigger on dynamic speech threshold
            if (volNormalized > 0.18 && Math.random() < 0.22) {
              p.x = cx + (Math.random() - 0.5) * 15;
              p.y = cy + (Math.random() - 0.5) * 15;
              const angle = Math.random() * Math.PI * 2;
              const speed = 1.5 + volNormalized * 5.0 + Math.random() * 2;
              p.vx = Math.cos(angle) * speed;
              p.vy = Math.sin(angle) * speed;
              p.maxLife = 15 + Math.floor(Math.random() * 25);
              p.life = p.maxLife;
              p.color = idx % 2 === 0 ? "#ff007f" : accentColor;
            } else {
              // Lazy orbit standby
              p.angle += p.speed * 1.2;
              p.orbitRadius = 55 + Math.sin(time * 0.5 + idx) * 12;
              p.x = cx + Math.cos(p.angle) * p.orbitRadius;
              p.y = cy + Math.sin(p.angle) * p.orbitRadius;
              p.opacity = 0.4 + Math.sin(time + idx) * 0.2;
            }
          }
        } else {
          // Standby/Idle mode - lazy floating
          p.angle += p.speed * 0.8;
          p.orbitRadius = p.orbitRadius * 0.98 + (60 + Math.sin(time * 0.2 + idx) * 15) * 0.02;
          p.x = cx + Math.cos(p.angle) * p.orbitRadius;
          p.y = cy + Math.sin(p.angle) * p.orbitRadius;
          p.opacity = p.opacity * 0.95 + (0.35 + Math.sin(time * 0.5 + idx) * 0.25) * 0.05;
          p.color = idx % 2 === 0 ? "#00f2ff" : "#9d00ff";
        }

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      });

      // --- 3. Dynamic Organic Morphing Waveforms (Central liquid orbs) ---
      ctx.globalAlpha = 1.0;

      // Render 3 concentric liquid gradient layers for an ultra premium organic 3D aesthetic
      const drawFluidLayer = (
        baseRadius: number,
        waveCount: number,
        waveSpeed: number,
        ampFactor: number,
        gradColors: { stop0: string; stop1: string }
      ) => {
        ctx.beginPath();
        const steps = 120;
        
        for (let i = 0; i <= steps; i++) {
          const angle = (i / steps) * Math.PI * 2;
          
          // Compute complex multi-harmonic modulation offset
          let waveOffset = 0;
          
          if (!isConnected) {
            // Calm slow flat ripples when sleep
            waveOffset = Math.sin(angle * 3 + time * 0.5) * 1.5;
          } else if (isSpeaking) {
            // Highly energetic conversational dancing waves reacting to voice levels
            const spkVal = speakerLevel / 255;
            waveOffset = 
              Math.sin(angle * waveCount + time * waveSpeed) * (2.0 + spkVal * 18.0) * ampFactor +
              Math.cos(angle * (waveCount - 2) - time * waveSpeed * 1.3) * (1.0 + spkVal * 9.0) * ampFactor;
          } else if (isListening) {
            // Sharp vibrating micro-frequency sound reception ripples
            const micVal = micLevel / 255;
            waveOffset = 
              Math.sin(angle * (waveCount + 4) + time * waveSpeed * 1.8) * (2.5 + micVal * 12.0) * ampFactor +
              Math.sin(angle * 12 - time * 3) * (0.5 + micVal * 4.0);
          } else if (isConnecting) {
            // Processing swirl shape
            waveOffset = Math.sin(angle * 4 + time * 4.0) * 5 * ampFactor;
          } else {
            // Standby Breathing Wave
            waveOffset = 
              Math.sin(angle * waveCount + time * waveSpeed) * 3.5 * ampFactor +
              Math.cos(angle * 3 - time * 0.8) * 1.8 * ampFactor;
          }

          const r = (baseRadius * breathScale) + waveOffset;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();

        // Establish gorgeous radial gradient filling
        const linearGrad = ctx.createLinearGradient(cx - baseRadius, cy - baseRadius, cx + baseRadius, cy + baseRadius);
        linearGrad.addColorStop(0, gradColors.stop0);
        linearGrad.addColorStop(1, gradColors.stop1);
        
        ctx.fillStyle = linearGrad;
        ctx.shadowBlur = 15;
        ctx.shadowColor = gradColors.stop0;
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      };

      // Layer 1 (Deepest Background: violet/purple)
      drawFluidLayer(
        42, 
        4, 
        1.2, 
        0.8, 
        { stop0: isSpeaking ? "#9d00ffcc" : isListening ? "#10403bcc" : "#4c00ffcc", stop1: "rgba(10, 15, 30, 0.95)" }
      );

      // Layer 2 (Middle Layer: dynamic purple/magenta)
      drawFluidLayer(
        46, 
        5, 
        -1.7, 
        0.95, 
        { stop0: isSpeaking ? "#ff0080aa" : isListening ? "#12ee2aaa" : "#5d00ffaa", stop1: "rgba(16, 26, 48, 0.85)" }
      );

      // Layer 3 (Foreground Primary Core: Neon blue/teal/pink highlights)
      drawFluidLayer(
        50, 
        6, 
        2.2, 
        1.1, 
        { stop0: isSpeaking ? "#ff007fee" : isListening ? "#00f2ffee" : "#00f2ffee", stop1: isSpeaking ? "#9d00ffee" : "#9d00ffee" }
      );

      // --- 4. Micro-Frequency Spectrum Ring Overlay (On top of Core) ---
      if (isConnected) {
        ctx.strokeStyle = finalGlow;
        ctx.lineWidth = 0.75;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        
        const tickCount = 60;
        const innerR = 56 * breathScale;
        const baseTickL = isSpeaking ? speakerLevel * 0.08 : isListening ? micLevel * 0.08 : 1.5;

        for (let i = 0; i < tickCount; i++) {
          const angle = (i / tickCount) * Math.PI * 2;
          const tickL = baseTickL + Math.sin(time * 3 + i) * 1.5;
          const rStart = innerR;
          const rEnd = innerR + Math.max(1, tickL);

          const x1 = cx + Math.cos(angle) * rStart;
          const y1 = cy + Math.sin(angle) * rStart;
          const x2 = cx + Math.cos(angle) * rEnd;
          const y2 = cy + Math.sin(angle) * rEnd;

          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
        }
        ctx.stroke();
      }

      // --- 5. High-Tech Glass Reflection on Orb Surface ---
      ctx.globalAlpha = 0.12;
      ctx.beginPath();
      ctx.arc(cx - 10, cy - 10, 32, 0, Math.PI * 2);
      const glossGrad = ctx.createLinearGradient(cx - 30, cy - 30, cx + 10, cy + 10);
      glossGrad.addColorStop(0, "#ffffff");
      glossGrad.addColorStop(0.5, "rgba(255,255,255,0.1)");
      glossGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glossGrad;
      ctx.fill();

      // --- 6. Inner Glowing Micro-Core ---
      if (isConnected) {
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        const coreRad = Math.max(3, 4.5 + (isSpeaking ? speakerLevel * 0.04 : isListening ? micLevel * 0.04 : 0));
        ctx.arc(cx, cy, coreRad, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#ffffff";
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // --- 7. Floating Digital Coordinate Labels ---
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = finalGlow;
      ctx.font = "bold 5.5px monospace";

      // Left-aligned system telemetry data
      ctx.fillText("SYS: ZOYA.ORB.v5", 28, 40);
      ctx.fillText("CORE: NEURAL_LINK", 28, 206);

      // Right-aligned status coordinates
      ctx.textAlign = "end";
      ctx.fillText("DEC: 60FPS.OK", width - 28, 40);
      const linkLabel = isSpeaking ? "LINK: TX_FREQ" : isListening ? "LINK: RX_FREQ" : "LINK: SLEEP_SYNC";
      ctx.fillText(linkLabel, width - 28, 206);
      ctx.textAlign = "left"; // restore

      // Top corner telemetry coordinate brackets
      ctx.strokeStyle = finalGlow;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.55;
      
      // Draw corner lines
      const bSz = 6; // bracket size
      const drawBrackets = (bx1: number, by1: number, bx2: number, by2: number, xDir: number, yDir: number) => {
        ctx.beginPath();
        ctx.moveTo(bx1 + bSz * xDir, by1);
        ctx.lineTo(bx1, by1);
        ctx.lineTo(bx1, by1 + bSz * yDir);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(bx2 - bSz * xDir, by2);
        ctx.lineTo(bx2, by2);
        ctx.lineTo(bx2, by2 - bSz * yDir);
        ctx.stroke();
      };
      drawBrackets(28, 46, width - 28, height - 46, 1, 1);
      drawBrackets(28, height - 46, width - 28, 46, 1, -1);

      ctx.globalCompositeOperation = "source-over"; // restore standard compositing

      animId = requestAnimationFrame(drawOrb);
    };

    animId = requestAnimationFrame(drawOrb);
    return () => cancelAnimationFrame(animId);
  }, [mode, connectionStatus, voiceState, speakerLevel, micLevel]);

  // --- Parallax 3D translations for Android face components ---
  const bgParallaxX = -rig.headX * 4;
  const bgParallaxY = -rig.headY * 2.5;
  const faceParallaxX = rig.headX * 5;
  const faceParallaxY = rig.headY * 3.5;
  const eyeLParallaxX = rig.headX * 9 + rig.eyeLookX * 4.5;
  const eyeLParallaxY = rig.headY * 5.5 + rig.eyeLookY * 3;
  const eyeRParallaxX = rig.headX * 9 + rig.eyeLookX * 4.5;
  const eyeRParallaxY = rig.headY * 5.5 + rig.eyeLookY * 3;
  const noseParallaxX = rig.headX * 14;
  const noseParallaxY = rig.headY * 9;
  const mouthParallaxX = rig.headX * 11;
  const mouthParallaxY = rig.headY * 7;
  const breathY = Math.sin(rig.breathPhase) * 1.8;
  const breathHeadY = Math.sin(rig.breathPhase + 0.3) * 0.8;
  const breathShouldersY = Math.sin(rig.breathPhase - 0.2) * 1.2;

  const getDynamicMouthPath = () => {
    const mouthCenterY = 135 + mouthParallaxY + breathHeadY;
    const mouthCenterX = 120 + mouthParallaxX;
    const w = 24 + rig.mouthSmile * 12;
    const h = rig.mouthOpen * 22;
    
    if (rig.mouthOpen > 0.05) {
      const topCtrlY = mouthCenterY - h * 0.25;
      const botCtrlY = mouthCenterY + h * 0.95;
      const leftX = mouthCenterX - w / 2;
      const rightX = mouthCenterX + w / 2;
      return `M ${leftX} ${mouthCenterY} 
              C ${leftX + 4} ${topCtrlY}, ${rightX - 4} ${topCtrlY}, ${rightX} ${mouthCenterY} 
              C ${rightX - 2} ${botCtrlY}, ${leftX + 2} ${botCtrlY}, ${leftX} ${mouthCenterY} Z`;
    } else {
      const leftX = mouthCenterX - w / 2;
      const rightX = mouthCenterX + w / 2;
      const smileDip = mouthCenterY + 4 + rig.mouthSmile * 4;
      return `M ${leftX} ${mouthCenterY} Q ${mouthCenterX} ${smileDip} ${rightX} ${mouthCenterY}`;
    }
  };

  const activeGlowColor = getGlowColor();

  return (
    <div className="relative w-full h-full flex items-center justify-center pointer-events-none select-none">
      
      {/* 1. Mode Switcher Floating Capsule (Stops parent click propagation to prevent triggering standby toggle) */}
      <div 
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 pointer-events-auto flex items-center gap-1 bg-black/55 backdrop-blur-md rounded-full p-0.5 border border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.5)] select-none text-[8.5px] font-mono tracking-wider transition-all duration-200 hover:border-white/20 hover:scale-105"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setMode("orb")}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold transition-all duration-300 ${
            mode === "orb"
              ? "bg-white/10 text-white shadow-[0_1px_5px_rgba(255,255,255,0.1)]"
              : "text-white/40 hover:text-white/70"
          }`}
          title="Interactive Quantum Orb"
        >
          <Sparkles className="w-2.5 h-2.5" />
          ORB
        </button>
        <button
          onClick={() => setMode("face")}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold transition-all duration-300 ${
            mode === "face"
              ? "bg-white/10 text-white shadow-[0_1px_5px_rgba(255,255,255,0.1)]"
              : "text-white/40 hover:text-white/70"
          }`}
          title="Parallax Android Avatar"
        >
          <Smile className="w-2.5 h-2.5" />
          AVATAR
        </button>
      </div>

      {/* 2. RENDER PATH: Premium Quantum Neural Orb (Canvas) */}
      {mode === "orb" && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ width: "100%", height: "100%" }}
        />
      )}

      {/* 3. RENDER PATH: Mechanical Hologram Android Head (SVG Vector) */}
      {mode === "face" && (
        <svg
          viewBox="0 0 240 240"
          className="w-full h-full max-w-[280px] max-h-[280px] filter drop-shadow-[0_0_15px_rgba(0,242,255,0.2)]"
        >
          <defs>
            <filter id="zoya-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            
            <filter id="eye-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <radialGradient id="cyber-blush" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ff0080" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#ff0080" stopOpacity="0" />
            </radialGradient>

            <pattern id="hud-grid" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="0.75" />
            </pattern>
          </defs>

          {/* --- Background HUD Telemetry --- */}
          <g opacity={isConnected ? 0.9 : 0.45}>
            <circle cx="120" cy="120" r="112" fill="url(#hud-grid)" />
            <circle
              cx="120"
              cy="120"
              r="108"
              fill="none"
              stroke={activeGlowColor}
              strokeWidth="0.75"
              strokeDasharray="6 12 18 12"
              opacity="0.25"
              style={{
                transformOrigin: "120px 120px",
                transform: `rotate(${rig.breathPhase * 15}deg)`,
              }}
            />
            <circle
              cx="120"
              cy="120"
              r="98"
              fill="none"
              stroke={activeGlowColor}
              strokeWidth="1.5"
              strokeDasharray="3 14"
              opacity="0.4"
              style={{
                transformOrigin: "120px 120px",
                transform: `rotate(${rig.breathPhase * -22}deg)`,
              }}
            />
            <circle cx="120" cy="120" r="85" fill="none" stroke={activeGlowColor} strokeWidth="0.5" opacity="0.15" />
            <path d="M 120 12 L 120 24 M 120 216 L 120 228 M 12 120 L 24 120 M 216 120 L 228 120" stroke={activeGlowColor} strokeWidth="0.75" opacity="0.3" />
          </g>

          {/* --- MAIN AVATAR RIGGING --- */}
          <g style={{ transform: `translateY(${breathY * 0.4}px)` }}>
            
            {/* Neck & Chest base */}
            <g style={{ transform: `translateY(${breathShouldersY}px)` }}>
              <path
                d="M 104 142 L 100 188 Q 120 194 140 188 L 136 142 Z"
                fill="#0b0f19"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1"
              />
              <path
                d="M 120 144 L 120 185"
                stroke={activeGlowColor}
                strokeWidth={isSpeaking ? 4.5 : isListening ? 3.5 : 2.5}
                strokeLinecap="round"
                opacity="0.8"
                filter="url(#zoya-glow)"
                className="transition-all duration-150"
              />
              <path
                d="M 68 195 Q 120 185 172 195 Q 192 205 198 226 L 42 226 Q 48 205 68 195 Z"
                fill="#060913"
                stroke="rgba(255, 255, 255, 0.16)"
                strokeWidth="1.2"
              />
              <path
                d="M 74 198 Q 120 189 166 198"
                fill="none"
                stroke={activeGlowColor}
                strokeWidth="1.5"
                opacity="0.7"
                filter="url(#zoya-glow)"
              />
              <circle cx="120" cy="211" r="7" fill="#03050a" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
              <circle
                cx="120"
                cy="211"
                r="4.2"
                fill={activeGlowColor}
                filter="url(#zoya-glow)"
                className="transition-all duration-200"
                opacity={isConnected ? 0.9 : 0.4}
              />
            </g>

            {/* Scalp metallic plates */}
            <g
              style={{
                transform: `translate(${bgParallaxX}px, ${bgParallaxY}px) rotate(${rig.headZ * 0.4}deg)`,
                transformOrigin: "120px 100px",
              }}
            >
              <path
                d="M 66 100 C 66 48, 174 48, 174 100 C 174 140, 168 152, 154 158 C 144 165, 134 167, 120 167 C 106 167, 96 165, 86 158 C 72 152, 66 140, 66 100 Z"
                fill="#0a0e1a"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
              <path d="M 58 110 C 52 140, 60 178, 62 188 L 74 184 C 72 174, 66 140, 72 110 Z" fill="#04060d" opacity="0.85" />
              <path d="M 182 110 C 188 140, 180 178, 178 188 L 166 184 C 168 174, 174 140, 168 110 Z" fill="#04060d" opacity="0.85" />
            </g>

            {/* Main Faceplate */}
            <g
              style={{
                transform: `translate(${faceParallaxX}px, ${faceParallaxY + breathHeadY}px) rotate(${rig.headZ}deg)`,
                transformOrigin: "120px 100px",
              }}
            >
              <path
                d="M 76 96 C 76 65, 164 65, 164 96 C 164 128, 156 146, 146 151 C 136 156, 128 157, 120 157 C 112 157, 104 156, 94 151 C 84 146, 76 128, 76 96 Z"
                fill="#111a33"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="1.2"
              />
              <path
                d="M 76 80 C 85 70, 155 70, 164 80"
                fill="none"
                stroke={activeGlowColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                opacity="0.75"
                filter="url(#zoya-glow)"
              />
              <circle cx="71" cy="90" r="2.2" fill={activeGlowColor} filter="url(#zoya-glow)" opacity="0.8" />
              <circle cx="169" cy="90" r="2.2" fill={activeGlowColor} filter="url(#zoya-glow)" opacity="0.8" />
              
              {isConnected && (
                <>
                  <ellipse cx="94" cy="115" rx="10" ry="4" fill="url(#cyber-blush)" opacity={isSpeaking ? 0.95 : isListening ? 0.7 : 0.4} />
                  <ellipse cx="146" cy="115" rx="10" ry="4" fill="url(#cyber-blush)" opacity={isSpeaking ? 0.95 : isListening ? 0.7 : 0.4} />
                </>
              )}

              <path d="M 94 68 Q 120 73 146 68" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.75" />
              <path d="M 85 118 Q 100 124 112 124" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.75" />
              <path d="M 155 118 Q 140 124 128 124" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.75" />
              <path d="M 120 65 L 120 78" stroke="rgba(255,255,255,0.08)" strokeWidth="0.75" />
            </g>

            {/* Left Eye */}
            <g
              style={{
                transform: `translate(${eyeLParallaxX}px, ${eyeLParallaxY + breathHeadY}px) rotate(${rig.headZ * 0.9}deg)`,
                transformOrigin: "94px 95px",
              }}
            >
              <ellipse cx="94" cy="95" rx="14" ry="8" fill="#070b17" stroke="rgba(255,255,255,0.05)" />
              <ellipse cx="94" cy="95" rx="12.5" ry="6.5" fill="none" stroke={activeGlowColor} strokeWidth="0.5" opacity="0.25" />

              {rig.blinkL > 0.08 ? (
                <g>
                  <circle
                    cx="94"
                    cy="95"
                    r={5.5 * rig.blinkL}
                    fill="none"
                    stroke={activeGlowColor}
                    strokeWidth="1.25"
                    opacity="0.9"
                    style={{ transform: `scaleY(${rig.blinkL})`, transformOrigin: "94px 95px" }}
                  />
                  <circle
                    cx="94"
                    cy="95"
                    r={3.2 * rig.blinkL}
                    fill={isConnected ? "#00f2ff" : "#557799"}
                    filter="url(#eye-glow)"
                    className="transition-all duration-200"
                    style={{ transform: `scaleY(${rig.blinkL})`, transformOrigin: "94px 95px" }}
                  />
                  <circle cx="92.8" cy="93.8" r="1.1" fill="#ffffff" opacity="0.9" />

                  {isConnected && (
                    <circle
                      cx="94"
                      cy="95"
                      r="9.5"
                      fill="none"
                      stroke={activeGlowColor}
                      strokeWidth="0.5"
                      strokeDasharray="2 3"
                      opacity={isListening ? 0.75 : 0.35}
                      style={{
                        transformOrigin: "94px 95px",
                        transform: `rotate(${rig.breathPhase * 25}deg)`,
                      }}
                    />
                  )}
                </g>
              ) : (
                <path d="M 81.5 95 Q 94 96.5 106.5 95" stroke={activeGlowColor} strokeWidth="2.5" strokeLinecap="round" filter="url(#zoya-glow)" />
              )}
              <path d="M 80 93.5 Q 94 90 108 93.5" fill="none" stroke="#070a14" strokeWidth="2" strokeLinecap="round" />
            </g>

            {/* Right Eye */}
            <g
              style={{
                transform: `translate(${eyeRParallaxX}px, ${eyeRParallaxY + breathHeadY}px) rotate(${rig.headZ * 0.9}deg)`,
                transformOrigin: "146px 95px",
              }}
            >
              <ellipse cx="146" cy="95" rx="14" ry="8" fill="#070b17" stroke="rgba(255,255,255,0.05)" />
              <ellipse cx="146" cy="95" rx="12.5" ry="6.5" fill="none" stroke={activeGlowColor} strokeWidth="0.5" opacity="0.25" />

              {rig.blinkR > 0.08 ? (
                <g>
                  <circle
                    cx="146"
                    cy="95"
                    r={5.5 * rig.blinkR}
                    fill="none"
                    stroke={activeGlowColor}
                    strokeWidth="1.25"
                    opacity="0.9"
                    style={{ transform: `scaleY(${rig.blinkR})`, transformOrigin: "146px 95px" }}
                  />
                  <circle
                    cx="146"
                    cy="95"
                    r={3.2 * rig.blinkR}
                    fill={isConnected ? "#00f2ff" : "#557799"}
                    filter="url(#eye-glow)"
                    className="transition-all duration-200"
                    style={{ transform: `scaleY(${rig.blinkR})`, transformOrigin: "146px 95px" }}
                  />
                  <circle cx="144.8" cy="93.8" r="1.1" fill="#ffffff" opacity="0.9" />

                  {isConnected && (
                    <circle
                      cx="146"
                      cy="95"
                      r="9.5"
                      fill="none"
                      stroke={activeGlowColor}
                      strokeWidth="0.5"
                      strokeDasharray="2 3"
                      opacity={isListening ? 0.75 : 0.35}
                      style={{
                        transformOrigin: "146px 95px",
                        transform: `rotate(${rig.breathPhase * -25}deg)`,
                      }}
                    />
                  )}
                </g>
              ) : (
                <path d="M 133.5 95 Q 146 96.5 158.5 95" stroke={activeGlowColor} strokeWidth="2.5" strokeLinecap="round" filter="url(#zoya-glow)" />
              )}
              <path d="M 132 93.5 Q 146 90 160 93.5" fill="none" stroke="#070a14" strokeWidth="2" strokeLinecap="round" />
            </g>

            {/* Eyebrows */}
            <g style={{ transform: `translate(${faceParallaxX}px, ${faceParallaxY + breathHeadY}px) rotate(${rig.headZ * 0.95}deg)`, transformOrigin: "120px 85px" }}>
              <path
                d={isSpeaking ? "M 81 85 Q 92 81 103 86" : isListening ? "M 81 83 Q 92 80 103 87" : "M 81 86 Q 92 82 103 87"}
                fill="none"
                stroke="rgba(255,255,255,0.45)"
                strokeWidth="1.75"
                strokeLinecap="round"
                className="transition-all duration-300"
              />
              <path
                d={isSpeaking ? "M 137 86 Q 148 81 159 85" : isListening ? "M 137 87 Q 148 80 159 83" : "M 137 87 Q 148 82 159 86"}
                fill="none"
                stroke="rgba(255,255,255,0.45)"
                strokeWidth="1.75"
                strokeLinecap="round"
                className="transition-all duration-300"
              />
            </g>

            {/* Nose */}
            <g style={{ transform: `translate(${noseParallaxX}px, ${noseParallaxY + breathHeadY}px) rotate(${rig.headZ * 0.95}deg)`, transformOrigin: "120px 110px" }}>
              <path d="M 120 95 L 120 110 M 117.5 110 L 122.5 110" fill="none" stroke="rgba(255, 255, 255, 0.14)" strokeWidth="1.5" strokeLinecap="round" />
            </g>

            {/* Mouth */}
            <g>
              <path
                d={getDynamicMouthPath()}
                fill={rig.mouthOpen > 0.05 ? "#070c1a" : "none"}
                stroke={activeGlowColor}
                strokeWidth="2"
                strokeLinecap="round"
                filter="url(#eye-glow)"
                className="transition-all duration-75 ease-out"
              />
              {isConnected && rig.mouthOpen > 0.15 && (
                <ellipse
                  cx={120 + mouthParallaxX}
                  cy={135 + mouthParallaxY + breathHeadY}
                  rx={Math.max(2, rig.mouthSmile * 4)}
                  ry={Math.max(1, rig.mouthOpen * 6)}
                  fill={activeGlowColor}
                  opacity="0.8"
                  filter="url(#zoya-glow)"
                />
              )}
            </g>

            {/* Hair and Helmet sway */}
            <g
              style={{
                transform: `translate(${faceParallaxX * 1.3}px, ${faceParallaxY * 1.2 + breathHeadY * 1.1}px) rotate(${rig.headZ * 1.05}deg)`,
                transformOrigin: "120px 90px",
              }}
            >
              <path
                d="M 64 91 C 64 36, 176 36, 176 91 C 176 120, 166 142, 166 142 L 157 131 C 157 131, 166 114, 166 93 C 166 52, 74 52, 74 93 C 74 114, 83 131, 83 131 L 74 142 C 74 142, 64 120, 64 91 Z"
                fill="#0d172e"
                stroke="rgba(255,255,255,0.18)"
                strokeWidth="1.2"
              />

              {/* Left sway strand */}
              <g style={{ transform: `rotate(${rig.hairSwayL * 15}deg)`, transformOrigin: "81px 90px" }}>
                <path d="M 83 110 C 80 135, 71 168, 64 186 C 68 186, 78 160, 84 135 Z" fill="#132247" stroke="rgba(255,255,255,0.06)" strokeWidth="0.75" />
                <path d="M 82 118 Q 78 142 70 172" fill="none" stroke={activeGlowColor} strokeWidth="1" opacity="0.65" />
              </g>

              {/* Right sway strand */}
              <g style={{ transform: `rotate(${rig.hairSwayR * 15}deg)`, transformOrigin: "159px 90px" }}>
                <path d="M 157 110 C 160 135, 169 168, 176 186 C 172 186, 162 160, 156 135 Z" fill="#132247" stroke="rgba(255,255,255,0.06)" strokeWidth="0.75" />
                <path d="M 158 118 Q 162 142 170 172" fill="none" stroke={activeGlowColor} strokeWidth="1" opacity="0.65" />
              </g>

              {/* Antennae arrays */}
              <path d="M 120 48 Q 112 28 92 18" fill="none" stroke="#0d172e" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 120 48 Q 112 28 92 18" fill="none" stroke={activeGlowColor} strokeWidth="0.75" opacity="0.5" />
              <circle cx="92" cy="18" r="2" fill={activeGlowColor} filter="url(#zoya-glow)" />

              <path d="M 120 48 Q 128 28 148 18" fill="none" stroke="#0d172e" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 120 48 Q 128 28 148 18" fill="none" stroke={activeGlowColor} strokeWidth="0.75" opacity="0.5" />
              <circle cx="148" cy="18" r="2" fill={activeGlowColor} filter="url(#zoya-glow)" />
            </g>
          </g>

          {/* --- Foregrounds Diagnostic HUD elements --- */}
          {isConnected && (
            <g opacity="0.8" stroke={activeGlowColor}>
              <g strokeWidth="1.2" strokeLinecap="round" filter="url(#eye-glow)">
                <path d="M 32 54 L 32 42 L 44 42" fill="none" />
                <path d="M 208 54 L 208 42 L 196 42" fill="none" />
                <path d="M 32 186 L 32 198 L 44 198" fill="none" />
                <path d="M 208 186 L 208 198 L 196 198" fill="none" />
              </g>

              <text x="32" y="34" fill={activeGlowColor} fontSize="5" fontFamily="monospace" fontWeight="bold" opacity="0.8">
                RIG: ACTIVE 60FPS
              </text>
              <text x="32" y="206" fill={activeGlowColor} fontSize="5" fontFamily="monospace" fontWeight="bold" opacity="0.8">
                NODE: ZOYA.L2D.v4
              </text>
              <text x="208" y="34" fill={activeGlowColor} fontSize="5" fontFamily="monospace" fontWeight="bold" opacity="0.8" textAnchor="end">
                SYS: SECURE
              </text>
              <text x="208" y="206" fill={activeGlowColor} fontSize="5" fontFamily="monospace" fontWeight="bold" opacity="0.8" textAnchor="end">
                {isSpeaking ? "LINK: TX_AUDIO" : isListening ? "LINK: RX_MIC" : "LINK: IDLE_SYNC"}
              </text>

              <line x1="50" y1="222" x2={50 + Math.max(10, speakerLevel * 0.5)} y2="222" strokeWidth="1.5" opacity="0.7" />
              <line x1="190" y1="222" x2={190 - Math.max(10, micLevel * 0.5)} y2="222" strokeWidth="1.5" opacity="0.7" />
            </g>
          )}
        </svg>
      )}
    </div>
  );
};
