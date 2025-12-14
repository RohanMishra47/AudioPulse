"use client";

import { Mic, MicOff, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const CircularAudioEqualizer = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState("");
  const [isPaused, setIsPaused] = useState(false);

  const startAudio = async () => {
    try {
      setError("");

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Create audio context
      const audioContext = new AudioContext();

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      audioContextRef.current = audioContext;

      // Create analyser node
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      // Connect microphone to analyser
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // Create data array
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      dataArrayRef.current = dataArray;

      setIsActive(true);
      setIsPaused(false);
      animate();
    } catch (err) {
      setError(
        "Microphone access denied. Please allow microphone permissions."
      );
      console.error("Error accessing microphone:", err);
    }
  };

  const stopAudio = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsActive(false);
    setIsPaused(false);

    // Clear canvas
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const togglePause = () => {
    if (isPaused) {
      animate();
      setIsPaused(false);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      setIsPaused(true);
    }
  };

  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;

    if (!analyser || !dataArray) return;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      // Get frequency data
      analyser.getByteFrequencyData(dataArray);

      // Clear canvas with fade effect
      ctx.fillStyle = "rgba(10, 10, 20, 0.2)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = Math.min(centerX, centerY) * 0.6;
      const barCount = 128;

      // Draw outer glow
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        radius * 0.5,
        centerX,
        centerY,
        radius * 1.5
      );
      gradient.addColorStop(0, "rgba(99, 102, 241, 0.1)");
      gradient.addColorStop(1, "rgba(99, 102, 241, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw center circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.3, 0, Math.PI * 2);
      const centerGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        radius * 0.3
      );
      centerGradient.addColorStop(0, "rgba(139, 92, 246, 0.8)");
      centerGradient.addColorStop(1, "rgba(99, 102, 241, 0.4)");
      ctx.fillStyle = centerGradient;
      ctx.fill();

      // Draw frequency bars
      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor((i / barCount) * dataArray.length);
        const value = dataArray[dataIndex];
        const percent = value / 255;

        const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
        const barHeight = percent * radius * 0.8;

        // Calculate bar position
        const startX = centerX + Math.cos(angle) * (radius * 0.4);
        const startY = centerY + Math.sin(angle) * (radius * 0.4);
        const endX = centerX + Math.cos(angle) * (radius * 0.4 + barHeight);
        const endY = centerY + Math.sin(angle) * (radius * 0.4 + barHeight);

        // Color based on frequency
        const hue = 250 + percent * 60;
        const lightness = 50 + percent * 20;

        // Draw bar with gradient
        const barGradient = ctx.createLinearGradient(
          startX,
          startY,
          endX,
          endY
        );
        barGradient.addColorStop(0, `hsla(${hue}, 80%, ${lightness}%, 0.8)`);
        barGradient.addColorStop(1, `hsla(${hue}, 90%, ${lightness + 10}%, 1)`);

        ctx.strokeStyle = barGradient;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Add glow effect for high frequencies
        if (percent > 0.6) {
          ctx.shadowBlur = 15;
          ctx.shadowColor = `hsla(${hue}, 90%, ${lightness}%, 0.8)`;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }

      // Draw pulsing ring
      const avgFrequency = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const pulseRadius = radius * 0.4 + (avgFrequency / 255) * 10;

      ctx.beginPath();
      ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(139, 92, 246, ${
        0.3 + (avgFrequency / 255) * 0.4
      })`;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw outer ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.1, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(99, 102, 241, 0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    draw();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const resizeCanvas = () => {
        const container = canvas.parentElement;
        if (!container) return;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      };

      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);

      return () => window.removeEventListener("resize", resizeCanvas);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  return (
    <div className="w-full min-h-screen bg-linear-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">
            Circular Audio Equalizer
          </h1>
          <p className="text-purple-200 text-lg">
            Real-time frequency visualization with 60 FPS smooth animation
          </p>
        </div>

        <div className="relative w-full aspect-square max-h-150 bg-slate-900/50 rounded-3xl backdrop-blur-sm border border-purple-500/20 shadow-2xl overflow-hidden">
          <canvas ref={canvasRef} className="w-full h-full" />

          {!isActive && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-purple-600/20 flex items-center justify-center">
                  <Mic className="w-12 h-12 text-purple-300" />
                </div>
                <p className="text-purple-200 text-lg">Click start to begin</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="flex gap-4">
            {!isActive ? (
              <button
                onClick={startAudio}
                className="px-8 py-4 bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-lg shadow-lg shadow-purple-500/50 transition-all duration-300 flex items-center gap-3 hover:scale-105"
              >
                <Mic className="w-6 h-6" />
                Start Microphone
              </button>
            ) : (
              <>
                <button
                  onClick={togglePause}
                  className="px-8 py-4 bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-xl font-semibold text-lg shadow-lg shadow-blue-500/50 transition-all duration-300 flex items-center gap-3 hover:scale-105"
                >
                  {isPaused ? (
                    <>
                      <Play className="w-6 h-6" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="w-6 h-6" />
                      Pause
                    </>
                  )}
                </button>
                <button
                  onClick={stopAudio}
                  className="px-8 py-4 bg-linear-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white rounded-xl font-semibold text-lg shadow-lg shadow-red-500/50 transition-all duration-300 flex items-center gap-3 hover:scale-105"
                >
                  <MicOff className="w-6 h-6" />
                  Stop
                </button>
              </>
            )}
          </div>

          {error && (
            <div className="px-6 py-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
              {error}
            </div>
          )}

          {isActive && (
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-full text-green-200">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="font-medium">Live</span>
              </div>
              <p className="text-purple-300 text-sm">
                Speak or play audio to see the visualization
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 p-6 bg-slate-900/50 rounded-xl border border-purple-500/20">
          <h3 className="text-white font-semibold mb-3 text-lg">Features</h3>
          <ul className="text-purple-200 space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-1">•</span>
              <span>Real-time frequency analysis using Web Audio API</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-1">•</span>
              <span>Smooth 60 FPS animations with RequestAnimationFrame</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-1">•</span>
              <span>128 frequency bars arranged in a circular pattern</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-1">•</span>
              <span>Dynamic color gradients based on frequency intensity</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-1">•</span>
              <span>Responsive design that adapts to any screen size</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-1">•</span>
              <span>Pulsing center and glow effects for enhanced visuals</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CircularAudioEqualizer;
