'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RecognitionResult } from '@/lib/types';

interface CameraPanelProps {
  onRecognition: (result: RecognitionResult) => void;
  currentResult: RecognitionResult;
}

export default function CameraPanel({ onRecognition, currentResult }: CameraPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const busyRef = useRef(false);
  // Fix #10 — store last captured frame for manual confirmation
  const lastFrameRef = useRef<string | null>(null);
  const [scanKey, setScanKey] = useState(0);

  const [isActive, setIsActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);

  // Fix #10 — confirmation state
  const [confirmName, setConfirmName] = useState<string | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);

  // ─── Camera control ────────────────────────────────────────────────────────

  const startCamera = async () => {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Fix #8 — request 640×480 instead of 1280×720 to keep processing fast
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsActive(true);
    } catch {
      setCamError('Camera access denied — please allow camera permissions and try again.');
    }
  };

  const stopCamera = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsActive(false);
    setConfirmName(null);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // ─── Capture & send ────────────────────────────────────────────────────────

  const captureAndRecognize = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (busyRef.current || !video || !canvas) return;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

    busyRef.current = true;
    setIsScanning(true);
    setScanKey((k) => k + 1);

    try {
      // Fix #8 — cap canvas at 640×480 before encoding
      canvas.width = Math.min(video.videoWidth || 640, 640);
      canvas.height = Math.min(video.videoHeight || 480, 480);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const b64 = canvas.toDataURL('image/jpeg', 0.80).split(',')[1];
      lastFrameRef.current = b64;   // Fix #10 — keep for confirmation

      const res = await fetch('/api/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: b64 }),
      });
      if (res.ok) {
        const data = await res.json() as RecognitionResult & { best_candidate?: string };
        onRecognition(data);

        // Fix #10 — surface best_candidate for manual confirmation
        if (data.status === 'unknown' && data.best_candidate) {
          setConfirmName(data.best_candidate);
        } else {
          setConfirmName(null);
        }
      }
    } catch {
      // silent
    } finally {
      busyRef.current = false;
      setIsScanning(false);
    }
  }, [onRecognition]);

  // Fix #8 — 1 frame per second (was 2 000 ms, now 1 000 ms… actually spec says 1/sec = 1000ms)
  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(captureAndRecognize, 1000);
    } else {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isActive, captureAndRecognize]);

  // ─── Fix #10 — manual confirmation handler ─────────────────────────────────

  const handleConfirm = useCallback(async (confirmed: boolean) => {
    if (!confirmed || !confirmName || !lastFrameRef.current) {
      setConfirmName(null);
      return;
    }
    setConfirmPending(true);
    try {
      await fetch('/api/confirm-person', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: confirmName, image: lastFrameRef.current }),
      });
    } catch { /* silent */ }
    setConfirmName(null);
    setConfirmPending(false);
  }, [confirmName]);

  // ─── Derived styles ────────────────────────────────────────────────────────

  const borderClass =
    currentResult.status === 'recognized' ? 'border-teal-400/35' :
      currentResult.status === 'unknown' ? 'border-amber-400/35' :
        'border-white/8';

  const outerGlow =
    currentResult.status === 'recognized' ? 'glow-teal' :
      currentResult.status === 'unknown' ? 'glow-amber' : '';

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={`glass rounded-2xl overflow-hidden flex flex-col transition-all duration-700 ${borderClass} ${outerGlow}`}
      style={{ minHeight: 480 }}
    >
      {/* Video area */}
      <div className="relative flex-1 bg-black/50 overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          muted
          playsInline
          style={{ display: isActive ? 'block' : 'none' }}
        />
        <canvas ref={canvasRef} className="hidden" aria-hidden />

        {/* Idle / error placeholder */}
        {!isActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6">
            <div className="w-20 h-20 rounded-full border border-white/8 flex items-center justify-center">
              <svg className="w-10 h-10 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                  d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            {camError
              ? <p className="text-red-400/80 text-sm text-center max-w-xs">{camError}</p>
              : <p className="text-white/25 text-sm tracking-widest uppercase">Camera off</p>
            }
          </div>
        )}

        {/* Scan line */}
        {isActive && isScanning && (
          <div key={scanKey} className="scan-line" />
        )}

        {/* LIVE badge */}
        {isActive && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 glass rounded-full px-2.5 py-1">
            <div className="relative w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-70" />
              <span className="relative block w-2 h-2 rounded-full bg-red-500" />
            </div>
            <span className="text-[10px] font-semibold text-white/60 tracking-widest uppercase">Live</span>
          </div>
        )}

        {/* Scanning indicator */}
        {isActive && isScanning && (
          <div className="absolute top-3 right-3 glass rounded-full px-2.5 py-1 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-[10px] font-medium text-teal-400/70 tracking-wider">Scanning</span>
          </div>
        )}

        {/* Recognized badge */}
        {isActive && currentResult.status === 'recognized' && currentResult.name && (
          <div
            key={currentResult.name}
            className="absolute bottom-3 left-3 right-3 glass-teal rounded-xl px-4 py-3 anim-badge-in"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-lg font-bold text-white truncate leading-tight">
                  {currentResult.name}
                </p>
                {currentResult.memory?.relation && (
                  <p className="text-sm text-teal-300/75 truncate">{currentResult.memory.relation}</p>
                )}
              </div>
              {/* Fix #9 — confidence score */}
              <div className="text-right shrink-0">
                <p className="text-xl font-extrabold text-teal-400 tabular-nums leading-none">
                  {Math.round((currentResult.confidence ?? 0) * 100)}%
                </p>
                <p className="text-[10px] text-white/30 mt-0.5">match</p>
              </div>
            </div>
          </div>
        )}

        {/* Unknown badge + Fix #10 confirmation prompt */}
        {isActive && currentResult.status === 'unknown' && (
          <div className="absolute bottom-3 left-3 right-3 glass-amber rounded-xl px-4 py-3 anim-badge-in">
            {confirmName && !confirmPending ? (
              /* Fix #10 — "Is this X?" prompt */
              <div className="flex flex-col gap-2">
                <p className="text-amber-300/90 font-medium text-sm">
                  Is this <span className="text-white font-bold">{confirmName}</span>?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleConfirm(true)}
                    className="flex-1 py-1 rounded-lg bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-semibold"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => handleConfirm(false)}
                    className="flex-1 py-1 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs font-semibold"
                  >
                    No
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-amber-400/80 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-amber-300/90 font-medium text-sm">
                  {confirmPending ? 'Saving confirmation…' : 'Unknown person detected'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-white/5">
        <div className="flex items-center gap-2 text-xs text-white/30">
          {isActive ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              {/* Fix #8 — updated copy to reflect 1 fps */}
              <span>Checking every 1 s</span>
            </>
          ) : (
            <span>Tap Start Camera to begin</span>
          )}
        </div>

        <button
          onClick={isActive ? stopCamera : startCamera}
          className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200
            ${isActive
              ? 'bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/18'
              : 'btn-teal'
            }`}
        >
          {isActive ? '⏹ Stop' : '▶ Start Camera'}
        </button>
      </div>
    </div>
  );
}