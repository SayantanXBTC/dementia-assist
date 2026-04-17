'use client';

import { useEffect, useState } from 'react';
import { Person } from '@/lib/types';

interface PeopleSidebarProps {
  refreshTrigger: number;
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// Stable hue per name, so avatar colour is consistent
function nameHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return h % 360;
}

export default function PeopleSidebar({ refreshTrigger }: PeopleSidebarProps) {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/people')
      .then((r) => r.json())
      .then((d) => setPeople(d.people ?? []))
      .catch(() => setPeople([]))
      .finally(() => setLoading(false));
  }, [refreshTrigger]);

  return (
    <aside className="glass rounded-2xl flex flex-col overflow-hidden" style={{ maxHeight: '320px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm font-semibold text-white/70 tracking-wide">Known People</span>
        </div>
        <span className="text-xs font-bold text-teal-400/70 tabular-nums">{people.length}</span>
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1 p-2 space-y-1">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-teal-400/30 border-t-teal-400 rounded-full animate-spin" />
          </div>
        )}

        {!loading && people.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <svg className="w-8 h-8 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <p className="text-xs text-white/25 text-center">No people enrolled yet</p>
          </div>
        )}

        {!loading &&
          people.map((person) => {
            const hue = nameHue(person.name);
            return (
              <div
                key={person.name}
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.04] transition-colors duration-150 cursor-default anim-fade-in"
              >
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{
                    background: `hsla(${hue}, 60%, 25%, 0.8)`,
                    border: `1px solid hsla(${hue}, 60%, 50%, 0.35)`,
                    color: `hsl(${hue}, 70%, 70%)`,
                  }}
                >
                  {initials(person.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white/85 truncate leading-tight">
                    {person.name}
                  </p>
                  {person.relation && (
                    <p className="text-xs text-white/35 truncate leading-tight">{person.relation}</p>
                  )}
                </div>

                {/* Embedding count badge */}
                <span className="text-[10px] font-medium text-white/20 tabular-nums shrink-0">
                  {person.embeddings_count}
                </span>
              </div>
            );
          })}
      </div>
    </aside>
  );
}
