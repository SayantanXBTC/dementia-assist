'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import CameraPanel     from '@/components/CameraPanel';
import InfoPanel       from '@/components/InfoPanel';
import AddPersonModal  from '@/components/AddPersonModal';
import PeopleSidebar   from '@/components/PeopleSidebar';
import StatusBar       from '@/components/StatusBar';
import { RecognitionResult } from '@/lib/types';

const IDLE_RESULT: RecognitionResult = {
  status:     'idle',
  name:       null,
  confidence: 0,
  memory:     null,
  suggestion: null,
};

export default function HomePage() {
  const [result,        setResult]        = useState<RecognitionResult>(IDLE_RESULT);
  const [isModalOpen,   setIsModalOpen]   = useState(false);
  const [isMuted,       setIsMuted]       = useState(false);
  const [refreshPeople, setRefreshPeople] = useState(0);

  // Track last spoken name to avoid repeating the same greeting
  const lastSpokenRef = useRef<string | null>(null);

  // ─── Voice output ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (result.status === 'recognized' && result.name) {
      if (result.name !== lastSpokenRef.current) {
        lastSpokenRef.current = result.name;
        if (!isMuted && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel(); // stop any previous utterance
          const relation = result.memory?.relation ?? 'person';
          const utterance = new SpeechSynthesisUtterance(
            `This is ${result.name}. They are your ${relation}.`
          );
          utterance.rate  = 0.88;
          utterance.pitch = 1.0;
          window.speechSynthesis.speak(utterance);
        }
      }
    } else if (result.status !== 'recognized') {
      lastSpokenRef.current = null;
    }
  }, [result, isMuted]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleRecognition = useCallback((r: RecognitionResult) => {
    setResult(r);
  }, []);

  const handlePersonAdded = useCallback((name: string) => {
    setRefreshPeople((n) => n + 1);
    void name; // already shown in toast by modal
  }, []);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col animated-bg">

      {/* Background orbs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden>
        <div
          className="orb w-[700px] h-[700px] -top-40 -left-40 opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(10,80,80,0.7) 0%, transparent 70%)',
            animation: 'orb-1 22s ease-in-out infinite',
          }}
        />
        <div
          className="orb w-[600px] h-[600px] top-1/2 -right-48 opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(6,28,70,0.8) 0%, transparent 70%)',
            animation: 'orb-2 28s ease-in-out infinite',
          }}
        />
        <div
          className="orb w-[500px] h-[500px] -bottom-32 left-1/3 opacity-25"
          style={{
            background: 'radial-gradient(circle, rgba(4,30,60,0.8) 0%, transparent 70%)',
            animation: 'orb-3 18s ease-in-out infinite',
          }}
        />
      </div>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg, rgba(79,209,197,0.25), rgba(79,209,197,0.08))', border: '1px solid rgba(79,209,197,0.30)' }}>
            <svg className="w-4 h-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold text-white/85 leading-none">Dementia Assist</h1>
            <p className="text-[10px] text-white/30 mt-0.5 leading-none">Memory recognition system</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Add person shortcut */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-teal px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Add Person
          </button>

          {/* Mute toggle */}
          <button
            onClick={() => setIsMuted((m) => !m)}
            aria-label={isMuted ? 'Unmute voice' : 'Mute voice'}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 text-xs
              ${isMuted
                ? 'bg-white/5 border border-white/10 text-white/30'
                : 'bg-teal-400/10 border border-teal-400/25 text-teal-400'}`}
          >
            {isMuted ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0-12L7.757 9.243A1 1 0 017 10H5a1 1 0 00-1 1v2a1 1 0 001 1h2a1 1 0 01.707.293L12 18m0-12l4.243 3.243" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col md:flex-row gap-4 p-4 overflow-hidden">
        {/* Camera — 60% on desktop */}
        <section className="md:flex-[6] min-w-0 flex flex-col">
          <CameraPanel
            onRecognition={handleRecognition}
            currentResult={result}
          />
        </section>

        {/* Right column — 40% on desktop */}
        <aside className="md:flex-[4] flex flex-col gap-4 min-w-0">
          <InfoPanel
            result={result}
            onAddPerson={() => setIsModalOpen(true)}
          />
          <PeopleSidebar refreshTrigger={refreshPeople} />
        </aside>
      </main>

      {/* ── Status bar ───────────────────────────────────────────────────── */}
      <StatusBar />

      {/* ── Add person modal ─────────────────────────────────────────────── */}
      <AddPersonModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handlePersonAdded}
      />
    </div>
  );
}
