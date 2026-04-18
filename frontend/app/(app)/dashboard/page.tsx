'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import CameraPanel    from '@/components/CameraPanel';
import AddPersonModal from '@/components/AddPersonModal';
import PeopleSidebar  from '@/components/PeopleSidebar';
import { RecognitionResult } from '@/lib/types';
import { useTheme } from '@/lib/theme-context';

const IDLE_RESULT: RecognitionResult = {
  status: 'idle', name: null, confidence: 0, memory: null, suggestion: null,
};

export default function DashboardPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';

  const [result,        setResult]        = useState<RecognitionResult>(IDLE_RESULT);
  const [isModalOpen,   setIsModalOpen]   = useState(false);
  const [isMuted,       setIsMuted]       = useState(false);
  const [refreshPeople, setRefreshPeople] = useState(0);

  const lastSpokenRef = useRef<string | null>(null);

  // ─── Voice output ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (result.status === 'recognized' && result.name) {
      if (result.name !== lastSpokenRef.current) {
        lastSpokenRef.current = result.name;
        if (!isMuted && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const relation  = result.memory?.relation ?? 'person';
          const utterance = new SpeechSynthesisUtterance(`This is ${result.name}. They are your ${relation}.`);
          utterance.rate  = 0.88;
          utterance.pitch = 1.0;
          window.speechSynthesis.speak(utterance);
        }
      }
    } else if (result.status !== 'recognized') {
      lastSpokenRef.current = null;
    }
  }, [result, isMuted]);

  const handleRecognition = useCallback((r: RecognitionResult) => setResult(r), []);
  const handlePersonAdded = useCallback((name: string) => {
    setRefreshPeople((n) => n + 1);
    void name;
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    router.replace('/login');
  };

  // Theme-aware tokens
  const headerBg   = dark ? 'rgba(18,14,9,0.80)'  : 'rgba(255,255,255,0.75)';
  const headerBorder = dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.70)';
  const textMain   = dark ? '#F5EFE8'  : '#3A2F28';
  const textSoft   = dark ? '#8A7D72'  : '#9A8C84';

  return (
    <div className="min-h-screen flex flex-col" style={{ minHeight: '100vh' }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header
        className="shrink-0 flex items-center justify-between px-5 py-3 sticky top-0 z-40"
        style={{
          background:    headerBg,
          backdropFilter: 'blur(20px)',
          borderBottom:  `1px solid ${headerBorder}`,
        }}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 select-none">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#C9943A,#F0C97A)', boxShadow: '0 2px 8px rgba(201,148,58,0.35)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V9l-6-6z"/>
              <polyline points="9 3 9 9 15 9"/>
              <line x1="12" y1="13" x2="12" y2="17"/>
              <line x1="10" y1="15" x2="14" y2="15"/>
            </svg>
          </div>
          <span
            className="font-serif text-lg font-bold leading-none"
            style={{ background: 'linear-gradient(135deg,#C9943A,#F0C97A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
          >
            RecallPal
          </span>
        </Link>

        {/* Right controls */}
        <div className="flex items-center gap-3">

          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="relative rounded-full transition-all duration-300 focus:outline-none shrink-0 flex items-center"
            style={{ 
              width: 44, 
              height: 22,
              background: dark ? 'linear-gradient(135deg,#C9943A,#F0C97A)' : 'rgba(0,0,0,0.14)' 
            }}
          >
            <motion.span
              className="absolute rounded-full shadow-sm"
              style={{
                width: 18,
                height: 18,
                left: 2,
                background: dark ? 'white' : '#FAF6F1', 
                border: dark ? 'none' : '1px solid rgba(0,0,0,0.10)' 
              }}
              animate={{ x: dark ? 22 : 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>

          {/* Mute toggle */}
          <button
            onClick={() => setIsMuted((m) => !m)}
            aria-label={isMuted ? 'Unmute voice' : 'Mute voice'}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all shrink-0"
            style={{
              background: isMuted
                ? dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
                : 'rgba(201,148,58,0.12)',
              border: `1px solid ${isMuted
                ? dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
                : 'rgba(201,148,58,0.30)'}`,
              color: isMuted ? textSoft : '#C9943A',
            }}
          >
            {isMuted ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <line x1="17" y1="14" x2="21" y2="10" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                <line x1="17" y1="10" x2="21" y2="14" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15.536 8.464a5 5 0 010 7.072M12 6v12m-4.243-2.757A8 8 0 012 12a8 8 0 015.757-7.757M19.071 4.929A10 10 0 0112 2a10 10 0 00-7.071 2.929" />
              </svg>
            )}
          </button>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="px-3 py-1.5 rounded-xl text-xs font-medium font-dm-sans transition-all"
            style={{
              background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              border:     `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              color:      textSoft,
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden" style={{ minHeight: 0 }}>

        {/* Camera — left, 65% */}
        <section className="lg:flex-[65] flex flex-col p-4 min-w-0">
          {/* Section label */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#C9943A' }} />
            <span className="text-xs font-semibold uppercase tracking-widest font-dm-sans" style={{ color: textSoft }}>
              Live Camera
            </span>
          </div>
          <div className="flex-1" style={{ minHeight: 420 }}>
            <CameraPanel
              onRecognition={handleRecognition}
              currentResult={result}
              onAddRequest={() => setIsModalOpen(true)}
            />
          </div>
        </section>

        {/* Divider */}
        <div
          className="hidden lg:block w-px self-stretch"
          style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', margin: '1rem 0' }}
        />

        {/* People sidebar — right, 35% */}
        <aside
          className="lg:flex-[35] flex flex-col overflow-hidden"
          style={{ minWidth: 0, maxWidth: '100%' }}
        >
          {/* Section label */}
          <div className="flex items-center gap-2 px-4 pt-4 mb-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#C9943A' }} />
            <span className="text-xs font-semibold uppercase tracking-widest font-dm-sans" style={{ color: textSoft }}>
              People
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <PeopleSidebar
              refreshTrigger={refreshPeople}
              onAddPerson={() => setIsModalOpen(true)}
            />
          </div>
        </aside>
      </main>

      {/* ── Slim status bar ───────────────────────────────────────────────── */}
      <footer
        className="shrink-0 flex items-center gap-4 px-5 py-2.5 border-t"
        style={{
          background: dark ? 'rgba(18,14,9,0.60)' : 'rgba(255,255,255,0.55)',
          backdropFilter: 'blur(12px)',
          borderColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        }}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#C9943A' }} />
          <span className="text-[11px] font-dm-sans" style={{ color: textSoft }}>RecallPal v1.0</span>
        </div>
        <span className="text-[11px] font-dm-sans" style={{ color: dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.18)' }}>
          {result.status === 'recognized' && result.name
            ? `Recognized: ${result.name}`
            : result.status === 'unknown'
              ? 'Unknown face detected'
              : result.status === 'no_face'
                ? 'No face in frame'
                : 'Waiting for camera…'}
        </span>
        <span className="ml-auto text-[11px] font-dm-sans" style={{ color: textSoft }}>
          <span className="font-medium" style={{ color: textMain }}>
            {result.status === 'recognized' ? `${Math.round((result.confidence ?? 0) * 100)}%` : '—'}
          </span>
          {result.status === 'recognized' && ' confidence'}
        </span>
      </footer>

      {/* ── Add person modal ─────────────────────────────────────────────── */}
      <AddPersonModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handlePersonAdded}
      />
    </div>
  );
}
