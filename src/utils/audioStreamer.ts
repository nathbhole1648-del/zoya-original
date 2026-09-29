/**
 * Audio processing utilities for real-time PCM voice capture and playback.
 * Handles PCM 16-bit little-endian conversion, and reactive level monitoring.
 */

// Helper to convert base64 string to Float32Array
export function base64ToFloat32Array(base64: string): Float32Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // 16-bit PCM has 2 bytes per sample
  const numSamples = len / 2;
  const float32 = new Float32Array(numSamples);
  const dataView = new DataView(bytes.buffer);
  for (let i = 0; i < numSamples; i++) {
    const sample = dataView.getInt16(i * 2, true); // true for little-endian
    float32[i] = sample / 32768.0;
  }
  return float32;
}

// Helper to convert Float32Array to 16-bit signed PCM ArrayBuffer
export function float32ToInt16PCM(float32: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    // Convert float to 16-bit signed integer
    const sample = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(i * 2, sample, true); // true for little-endian
  }
  return buffer;
}

// Helper to convert ArrayBuffer to base64 string
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Audio Recorder captures mic audio at 16kHz and converts to 16-bit PCM.
 */
export class AudioRecorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  public analyser: AnalyserNode | null = null;
  private onAudioChunk: (base64Chunk: string) => void;

  constructor(onAudioChunk: (base64Chunk: string) => void) {
    this.onAudioChunk = onAudioChunk;
  }

  async start(deviceId?: string) {
    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };
    if (deviceId) {
      audioConstraints.deviceId = { exact: deviceId };
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
    });

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioCtx({ sampleRate: 16000 });
    this.source = this.ctx.createMediaStreamSource(this.stream);
    
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    
    // Use standard 2048 buffer size for real-time responsiveness
    this.processor = this.ctx.createScriptProcessor(2048, 1, 1);
    
    this.source.connect(this.analyser);
    this.analyser.connect(this.processor);
    this.processor.connect(this.ctx.destination);

    this.processor.onaudioprocess = (e) => {
      // Don't send audio if stream tracks are disabled (muted)
      if (this.stream && !this.stream.getAudioTracks().some(t => t.enabled)) {
        return;
      }
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBuffer = float32ToInt16PCM(inputData);
      const base64 = arrayBufferToBase64(pcmBuffer);
      if (base64) {
        this.onAudioChunk(base64);
      }
    };
  }

  setMuted(muted: boolean) {
    if (this.stream) {
      this.stream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  stop() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }

  getVolume(): number {
    if (!this.analyser) return 0;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    return sum / dataArray.length; // Average frequency volume (0-255)
  }
}

/**
 * Audio Player schedules and plays base64 24kHz PCM chunks gaplessly.
 */
export class AudioPlayer {
  public ctx: AudioContext | null = null;
  public analyser: AnalyserNode | null = null;
  private nextStartTime = 0;
  public playbackRate = 1.0;

  constructor() {}

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx({ sampleRate: 24000 });
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.connect(this.ctx.destination);
      this.nextStartTime = this.ctx.currentTime;
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  playChunk(base64Data: string) {
    this.init();
    if (!this.ctx || !this.analyser) return;

    const float32 = base64ToFloat32Array(base64Data);
    if (float32.length === 0) return;

    const buffer = this.ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = this.playbackRate;
    source.connect(this.analyser);

    const currentTime = this.ctx.currentTime;
    // Handle gapless playback with a tiny transition buffer
    if (this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime + 0.01;
    }

    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration / this.playbackRate;
  }

  clearQueue() {
    if (this.ctx) {
      this.nextStartTime = this.ctx.currentTime;
    }
  }

  close() {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
      this.analyser = null;
    }
  }

  getVolume(): number {
    if (!this.analyser) return 0;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    return sum / dataArray.length; // Average frequency volume (0-255)
  }
}
