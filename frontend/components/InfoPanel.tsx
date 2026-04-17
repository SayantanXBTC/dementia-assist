'use client';

import { RecognitionResult } from '@/lib/types';

interface InfoPanelProps {
  result: RecognitionResult;
  onAddPerson: () => void;
}

function formatLastSeen(iso: string): string {
  if (!iso) return 'Never';
  try {
    const dt = new Date(iso);
    const diff = Date.now() - dt.getTime();
    const mins = Math.floor(diff / 60_000);
    const hrs  = Math.floor(mins  / 60);
    const days = Math.floor(hrs   / 24);
    if (mins  <  1)  return 'Just now';
    if (mins  < 60)  return `${mins}m ago`;
    if (hrs   < 24)  return `${hrs}h ago`;
    if (days  === 1) return 'Yesterday';
    if (days  <  7)  return `${days} days ago`;
    if (days  < 30)  return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  } catch {
    return 'Unknown';
  }
}

// ─── Idle ────────────────────────────────────────────────────────────────────

function IdleCard() {
  return (
    <div className="glass rounded-2xl p-8 flex flex-col items-center justify-center gap-4 text-center anim-fade-in" style={{ minHeight: 280 }}>
      <div className="w-16 h-16 rounded-full border border-white/8 flex items-center justify-center">
        <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
            d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
      <div>
        <p className="text-white/50 font-medium">Ready to recognize</p>
        <p className="text-white/25 text-sm mt-1">Start the camera to begin</p>
      </div>
    </div>
  );
}

// ─── No face ─────────────────────────────────────────────────────────────────

function NoFaceCard() {
  return (
    <div className="glass rounded-2xl p-8 flex flex-col items-center justify-center gap-4 text-center anim-fade-in" style={{ minHeight: 280 }}>
      <div className="w-16 h-16 rounded-full border border-white/8 flex items-center justify-center">
        <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      </div>
      <div>
        <p className="text-white/50 font-medium">No face detected</p>
        <p className="text-white/25 text-sm mt-1 leading-relaxed">
          Position yourself in front<br />of the camera
        </p>
      </div>
    </div>
  );
}

// ─── Unknown ─────────────────────────────────────────────────────────────────

function UnknownCard({ onAddPerson }: { onAddPerson: () => void }) {
  return (
    <div className="glass-amber rounded-2xl p-8 flex flex-col items-center justify-center gap-5 text-center anim-fade-in glow-amber" style={{ minHeight: 280 }}>
      <div className="w-16 h-16 rounded-full border border-amber-400/20 flex items-center justify-center bg-amber-400/5">
        <svg className="w-8 h-8 text-amber-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <p className="text-amber-300 font-semibold text-lg">Unknown Person</p>
        <p className="text-amber-300/50 text-sm mt-1">Face detected but not in the database</p>
      </div>
      <button
        onClick={onAddPerson}
        className="btn-amber px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add This Person
      </button>
    </div>
  );
}

// ─── Recognized ──────────────────────────────────────────────────────────────

function RecognizedCard({ result }: { result: RecognitionResult }) {
  const { name, confidence, memory, suggestion } = result;
  const pct = Math.round((confidence ?? 0) * 100);

  return (
    <div className="glass-teal rounded-2xl p-6 flex flex-col gap-5 anim-fade-in glow-teal" style={{ minHeight: 280 }}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-xs font-semibold text-teal-400/70 tracking-widest uppercase">Recognized</span>
          </div>
          <h2
            className="font-extrabold leading-none tracking-tight text-gradient-teal"
            style={{ fontSize: 'clamp(28px, 4vw, 42px)' }}
          >
            {name}
          </h2>
          {memory?.relation && (
            <p className="text-teal-300/70 font-medium mt-1" style={{ fontSize: '1.05rem' }}>
              {memory.relation}
            </p>
          )}
        </div>

        {/* Confidence badge */}
        <div className="shrink-0 text-right">
          <p className="text-2xl font-extrabold text-teal-400 tabular-nums leading-none">{pct}%</p>
          <p className="text-[11px] text-white/30 mt-0.5">confidence</p>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="space-y-1.5">
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="confidence-bar h-full rounded-full"
            style={{
              '--target-width': `${pct}%`,
              background: 'linear-gradient(90deg, #4fd1c5, #81e6d9)',
            } as React.CSSProperties}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/5" />

      {/* Age + Notes row */}
      <div className="flex flex-col gap-3">
        {memory?.age != null && (
          <div className="flex items-center gap-2 text-sm text-white/40">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>{memory.age} yrs old</span>
          </div>
        )}

        {memory?.notes && (
          <div className="flex gap-3">
            <svg className="w-4 h-4 text-white/20 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-white/55 text-sm leading-relaxed">{memory.notes}</p>
          </div>
        )}

        {/* Likes pills */}
        {memory?.likes && memory.likes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {memory.likes.map((like) => (
              <span
                key={like}
                className="glass px-2.5 py-0.5 rounded-full text-xs text-teal-300/70 border border-teal-400/15"
              >
                {like}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Last seen */}
      {memory?.last_seen && (
        <div className="flex items-center gap-2 text-sm text-white/35">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Last seen {formatLastSeen(memory.last_seen)}</span>
        </div>
      )}

      {/* Suggestion */}
      {suggestion && (
        <div className="mt-auto glass rounded-xl px-4 py-3 flex items-start gap-3">
          <svg className="w-4 h-4 text-teal-400/60 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <p className="text-sm text-white/60 italic leading-snug">{suggestion}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function InfoPanel({ result, onAddPerson }: InfoPanelProps) {
  switch (result.status) {
    case 'recognized':
      return <RecognizedCard result={result} />;
    case 'unknown':
      return <UnknownCard onAddPerson={onAddPerson} />;
    case 'no_face':
      return <NoFaceCard />;
    default:
      return <IdleCard />;
  }
}
