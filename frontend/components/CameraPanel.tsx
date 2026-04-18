'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RecognitionResult } from '@/lib/types';
import { useTheme } from '@/lib/theme-context';

interface CameraPanelProps {
  onRecognition: (result: RecognitionResult) => void;
  currentResult: RecognitionResult;
  onAddRequest?: () => void;
}

function formatLastSeen(iso: string): string {
  if (!iso) return '';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    const hrs  = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (mins < 1)   return 'just now';
    if (mins < 60)  return `${mins}m ago`;
    if (hrs  < 24)  return `${hrs}h ago`;
    if (days === 1) return 'yesterday';
    if (days < 7)   return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
  } catch { return ''; }
}

// Build the body text lines to display — always returns something
function buildInfoLines(result: RecognitionResult): string[] {
  const lines: string[] = [];
  const m = result.memory;

  if (m?.age != null)   lines.push(`Age: ${m.age}`);
  if (m?.notes?.trim()) lines.push(m.notes.trim());
  if (result.suggestion?.trim()) lines.push(result.suggestion.trim());
  if (m?.likes && m.likes.length > 0) lines.push(`Interests: ${m.likes.join(', ')}`);
  if (m?.last_seen) {
    const ls = formatLastSeen(m.last_seen);
    if (ls) lines.push(`Last seen: ${ls}`);
  }

  // Always show at least the relation or a greeting
  if (lines.length === 0) {
    if (m?.relation) lines.push(`Your ${m.relation}`);
    else lines.push(`Hello, ${result.name ?? 'there'}!`);
  }

  return lines;
}

export default function CameraPanel({ onRecognition, currentResult, onAddRequest }: CameraPanelProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const busyRef     = useRef(false);
  const lastFrameRef = useRef<string | null>(null);
  const [scanKey, setScanKey] = useState(0);

  const [isActive,       setIsActive]       = useState(false);
  const [isScanning,     setIsScanning]     = useState(false);
  const [camError,       setCamError]       = useState<string | null>(null);
  const [confirmName,    setConfirmName]    = useState<string | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);

  // ─── Camera ────────────────────────────────────────────────────────────────

  const startCamera = async () => {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
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

  // ─── Capture & recognize ───────────────────────────────────────────────────

  const captureAndRecognize = useCallback(async () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (busyRef.current || !video || !canvas) return;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

    busyRef.current = true;
    setIsScanning(true);
    setScanKey((k) => k + 1);

    try {
      canvas.width  = Math.min(video.videoWidth  || 640, 640);
      canvas.height = Math.min(video.videoHeight || 480, 480);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const b64 = canvas.toDataURL('image/jpeg', 0.80).split(',')[1];
      lastFrameRef.current = b64;

      const res = await fetch('/api/recognize', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ image: b64 }),
      });
      if (res.ok) {
        const data = await res.json() as RecognitionResult & { best_candidate?: string };
        onRecognition(data);
        if (data.status === 'unknown' && data.best_candidate) {
          setConfirmName(data.best_candidate);
        } else {
          setConfirmName(null);
        }
      }
    } catch { /* silent */ } finally {
      busyRef.current = false;
      setIsScanning(false);
    }
  }, [onRecognition]);

  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(captureAndRecognize, 1000);
    } else {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isActive, captureAndRecognize]);

  // ─── Confirmation ──────────────────────────────────────────────────────────

  const handleConfirm = useCallback(async (confirmed: boolean) => {
    if (!confirmed || !confirmName || !lastFrameRef.current) {
      setConfirmName(null);
      return;
    }
    setConfirmPending(true);
    try {
      await fetch('/api/confirm-person', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: confirmName, image: lastFrameRef.current }),
      });
    } catch { /* silent */ }
    setConfirmName(null);
    setConfirmPending(false);
  }, [confirmName]);

  // ─── Render ────────────────────────────────────────────────────────────────

  const softColor = dark ? '#8A7D72' : '#9A8C84';

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col transition-all duration-700"
      style={{
        minHeight: 420,
        background: dark ? 'rgba(18,14,9,0.6)' : 'rgba(255,255,255,0.5)',
        backdropFilter: 'blur(2px)',
        border: currentResult.status === 'recognized'
          ? '2px solid rgba(201,148,58,0.40)'
          : currentResult.status === 'unknown'
            ? '2px solid rgba(246,173,85,0.35)'
            : `2px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      }}
    >
      {/* Video area */}
      <div className="relative flex-1 overflow-hidden bg-black/80" style={{ minHeight: 380 }}>
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay muted playsInline
          style={{ display: isActive ? 'block' : 'none' }}
        />
        <canvas ref={canvasRef} className="hidden" aria-hidden />

        {/* Idle placeholder */}
        {!isActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ border: `2px dashed ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'}` }}
            >
              <svg className="w-10 h-10" style={{ color: dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }}
                   fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                  d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            {camError
              ? <p className="text-red-400/80 text-sm text-center max-w-xs">{camError}</p>
              : <p className="text-sm tracking-wider font-dm-sans" style={{ color: softColor }}>Camera off — tap Start to begin</p>
            }
          </div>
        )}

        {/* Scan line */}
        {isActive && isScanning && (
          <div
            key={scanKey}
            className="absolute left-0 right-0 h-[2px] pointer-events-none z-10"
            style={{
              top: 0,
              background: 'linear-gradient(90deg,transparent,rgba(201,148,58,0.70),transparent)',
              animation: 'scan-line 1.6s ease-in-out',
            }}
          />
        )}

        {/* LIVE badge */}
        {isActive && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full px-2.5 py-1"
               style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(8px)' }}>
            <div className="relative w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
              <span className="relative block w-2 h-2 rounded-full bg-red-500" />
            </div>
            <span className="text-[10px] font-semibold text-white/80 tracking-widest uppercase font-dm-sans">Live</span>
          </div>
        )}

        {/* Scanning badge */}
        {isActive && isScanning && (
          <div className="absolute top-3 right-3 rounded-full px-2.5 py-1 flex items-center gap-1.5"
               style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(8px)' }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#C9943A' }} />
            <span className="text-[10px] font-medium tracking-wider font-dm-sans" style={{ color: '#F0C97A' }}>Scanning</span>
          </div>
        )}

        {/* ── RECOGNITION BUBBLE ──────────────────────────────────────── */}
        <AnimatePresence>
          {isActive && currentResult.status === 'recognized' && currentResult.name && (() => {
            const infoLines = buildInfoLines(currentResult);
            return (
              <motion.div
                key={currentResult.name}
                initial={{ opacity: 0, scale: 0.80, y: -12 }}
                animate={{ opacity: 1, scale: 1,    y: 0   }}
                exit={{    opacity: 0, scale: 0.85,  y: -8  }}
                transition={{ type: 'spring', stiffness: 340, damping: 26 }}
                className="absolute top-4 right-4 z-20"
                style={{ width: 270 }}
              >
                {/* ── Row 1: Name + Relation ────────────────────────── */}
                <div
                  className="flex items-center gap-2 flex-wrap px-3 py-2 rounded-t-2xl rounded-br-md"
                  style={{
                    background: 'rgba(30,30,30,0.75)',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  {/* Name badge */}
                  <span
                    className="font-serif font-bold text-xl leading-none text-white"
                  >
                    {currentResult.name}
                  </span>

                  {/* Relation pill */}
                  {currentResult.memory?.relation && (
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-semibold font-dm-sans"
                      style={{
                        background: 'rgba(79,209,197,0.30)',
                        color: '#81e6d9',
                        border: '1px solid rgba(79,209,197,0.45)',
                      }}
                    >
                      {currentResult.memory.relation}
                    </span>
                  )}


                </div>

                {/* ── Row 2: Info body ─────────────────────────────── */}
                <div
                  className="px-3 py-2.5 rounded-b-2xl rounded-tl-md"
                  style={{
                    background: 'rgba(255,255,255,0.88)',
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  {/* Age + last seen inline */}
                  {(currentResult.memory?.age != null || currentResult.memory?.last_seen) && (
                    <div className="flex items-center gap-3 mb-1.5">
                      {currentResult.memory?.age != null && (
                        <span className="text-[11px] font-dm-sans font-medium" style={{ color: '#6B5C52' }}>
                          {currentResult.memory.age} yrs
                        </span>
                      )}
                      {currentResult.memory?.last_seen && (
                        <span className="text-[11px] font-dm-sans" style={{ color: '#9A8C84' }}>
                          · {formatLastSeen(currentResult.memory.last_seen)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {currentResult.memory?.notes?.trim() && (
                    <p className="text-sm leading-snug font-dm-sans mb-1.5" style={{ color: '#3A2F28' }}>
                      {currentResult.memory.notes.trim()}
                    </p>
                  )}

                  {/* Suggestion (always shown) */}
                  {currentResult.suggestion?.trim() && (
                    <p className="text-[12px] leading-snug font-dm-sans italic" style={{ color: '#6B5C52' }}>
                      {currentResult.suggestion.trim()}
                    </p>
                  )}

                  {/* Fallback if somehow nothing above rendered */}
                  {!currentResult.memory?.notes?.trim() && !currentResult.suggestion?.trim() && infoLines.length > 0 && (
                    <p className="text-sm leading-snug font-dm-sans" style={{ color: '#3A2F28' }}>
                      {infoLines[0]}
                    </p>
                  )}

                  {/* Likes */}
                  {currentResult.memory?.likes && currentResult.memory.likes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {currentResult.memory.likes.map((like) => (
                        <span
                          key={like}
                          className="px-2 py-0.5 rounded-full text-[10px] font-dm-sans"
                          style={{
                            background: 'rgba(201,148,58,0.12)',
                            color: '#C9943A',
                            border: '1px solid rgba(201,148,58,0.25)',
                          }}
                        >
                          {like}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* ── Unknown / confirmation ──────────────────────────────────── */}
        <AnimatePresence>
          {isActive && currentResult.status === 'unknown' && (
            <motion.div
              key="unknown"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0  }}
              exit={{    opacity: 0, y: 10  }}
              className="absolute bottom-4 left-4 right-4 rounded-2xl px-4 py-3"
              style={{
                background: 'rgba(246,173,85,0.14)',
                border: '1px solid rgba(246,173,85,0.40)',
                backdropFilter: 'blur(12px)',
              }}
            >
              {confirmName && !confirmPending ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-dm-sans" style={{ color: '#f6ad55' }}>
                    Is this{' '}
                    <span className="font-bold text-white">{confirmName}</span>?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleConfirm(true)}
                      className="flex-1 py-1.5 rounded-xl text-xs font-semibold font-dm-sans"
                      style={{ background: 'rgba(201,148,58,0.25)', border: '1px solid rgba(201,148,58,0.45)', color: '#F0C97A' }}
                    >Yes</button>
                    <button
                      onClick={() => handleConfirm(false)}
                      className="flex-1 py-1.5 rounded-xl text-xs font-semibold font-dm-sans"
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.55)' }}
                    >No</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 w-full">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 shrink-0" style={{ color: '#f6ad55' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm font-dm-sans" style={{ color: '#f6ad55' }}>
                      {confirmPending ? 'Saving…' : 'Person not identified.'}
                    </p>
                  </div>
                  {!confirmPending && (
                    <button 
                      onClick={() => onAddRequest && onAddRequest()}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold font-dm-sans shrink-0 uppercase tracking-wide transition-all"
                      style={{ background: 'rgba(201,148,58,0.25)', border: '1px solid rgba(201,148,58,0.45)', color: '#F0C97A' }}
                    >
                      + Add
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls bar */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 border-t"
        style={{
          borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          background:  dark ? 'rgba(18,14,9,0.55)'    : 'rgba(255,255,255,0.55)',
        }}
      >
        <div className="flex items-center gap-2 text-xs font-dm-sans" style={{ color: softColor }}>
          {isActive ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#C9943A' }} />
              <span>Scanning every 1s</span>
            </>
          ) : (
            <span>Press Start Camera to begin</span>
          )}
        </div>
        <button
          onClick={isActive ? stopCamera : startCamera}
          className="px-5 py-2 rounded-xl text-xs font-semibold font-dm-sans transition-all duration-200"
          style={isActive
            ? { background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }
            : { background: 'linear-gradient(135deg,#C9943A,#F0C97A)', color: 'white', boxShadow: '0 4px 14px rgba(201,148,58,0.35)' }
          }
        >
          {isActive ? 'Stop Video' : 'Start Camera'}
        </button>
      </div>
    </div>
  );
}
