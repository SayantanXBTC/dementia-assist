'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Person } from '@/lib/types';
import { useTheme } from '@/lib/theme-context';

interface PeopleSidebarProps {
  refreshTrigger: number;
  onAddPerson: () => void;
}

const RELATIONS = [
  'Son', 'Daughter', 'Husband', 'Wife', 'Partner',
  'Father', 'Mother', 'Brother', 'Sister',
  'Grandfather', 'Grandmother', 'Grandson', 'Granddaughter',
  'Friend', 'Neighbour', 'Caregiver', 'Doctor', 'Nurse', 'Other',
];

function initials(name: string): string {
  return name.split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase();
}

function nameHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return h % 360;
}

interface EditState {
  relation: string;
  notes:    string;
  age:      string;
  likes:    string[];
  likeInput: string;
}

function PersonCard({
  person,
  dark,
  onUpdated,
}: {
  person: Person;
  dark: boolean;
  onUpdated: () => void;
}) {
  const hue = nameHue(person.name);
  const [editing, setEditing]   = useState(false);
  const [saving,  setSaving]    = useState(false);
  const [error,   setError]     = useState<string | null>(null);
  const [edit,    setEdit]      = useState<EditState>({
    relation:  person.relation || '',
    notes:     person.notes    || '',
    age:       person.age != null ? String(person.age) : '',
    likes:     person.likes    || [],
    likeInput: '',
  });

  const openEdit = () => {
    setEdit({
      relation:  person.relation || '',
      notes:     person.notes    || '',
      age:       person.age != null ? String(person.age) : '',
      likes:     person.likes    || [],
      likeInput: '',
    });
    setError(null);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/update-person', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:     person.name,
          relation: edit.relation,
          notes:    edit.notes,
          age:      edit.age.trim() ? parseInt(edit.age, 10) : null,
          likes:    edit.likes,
        }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setEditing(false);
        onUpdated();
      } else {
        setError(data.message ?? 'Update failed');
      }
    } catch {
      setError('Connection error');
    } finally {
      setSaving(false);
    }
  };

  const addLike = () => {
    const tag = edit.likeInput.trim().replace(/,$/, '');
    if (tag && !edit.likes.includes(tag)) {
      setEdit((e) => ({ ...e, likes: [...e.likes, tag], likeInput: '' }));
    } else {
      setEdit((e) => ({ ...e, likeInput: '' }));
    }
  };

  // theme-aware input style
  const inputStyle: React.CSSProperties = {
    background:   dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.75)',
    border:       `1px solid ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'}`,
    color:        dark ? '#F5EFE8' : '#3A2F28',
    borderRadius: '0.75rem',
    padding:      '0.45rem 0.75rem',
    fontSize:     '0.82rem',
    width:        '100%',
    outline:      'none',
    fontFamily:   'var(--font-dm-sans)',
  };

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        background:   dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.65)',
        border:       `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.80)'}`,
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Person row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 font-dm-sans"
          style={{
            background: `hsla(${hue},55%,${dark ? 22 : 88}%,0.9)`,
            border:     `1.5px solid hsla(${hue},60%,50%,0.35)`,
            color:      `hsl(${hue},65%,${dark ? 68 : 38}%)`,
          }}
        >
          {initials(person.name)}
        </div>

        {/* Name + relation */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate leading-tight font-dm-sans"
             style={{ color: dark ? '#F5EFE8' : '#3A2F28' }}>
            {person.name}
          </p>
          {person.relation && (
            <p className="text-xs truncate leading-tight font-dm-sans"
               style={{ color: dark ? '#8A7D72' : '#9A8C84' }}>
              {person.relation}
            </p>
          )}
        </div>

        {/* Edit toggle */}
        <button
          onClick={editing ? () => setEditing(false) : openEdit}
          className="w-7 h-7 rounded-xl flex items-center justify-center transition-all shrink-0"
          style={{
            background:  editing
              ? 'rgba(201,148,58,0.15)'
              : dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
            border:      `1px solid ${editing ? 'rgba(201,148,58,0.35)' : dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}`,
            color:       editing ? '#C9943A' : dark ? '#8A7D72' : '#9A8C84',
          }}
          aria-label={editing ? 'Close edit' : 'Edit person'}
        >
          {editing ? (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          )}
        </button>
      </div>

      {/* Edit panel (animated) */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div
              className="px-4 pb-4 flex flex-col gap-3"
              style={{ borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}` }}
            >
              <div className="pt-3" />

              {/* Relation */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium font-dm-sans"
                       style={{ color: dark ? '#8A7D72' : '#9A8C84' }}>Relationship</label>
                <select
                  value={edit.relation}
                  onChange={(e) => setEdit((s) => ({ ...s, relation: e.target.value }))}
                  style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
                >
                  <option value="">Select…</option>
                  {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Age */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium font-dm-sans"
                       style={{ color: dark ? '#8A7D72' : '#9A8C84' }}>Age</label>
                <input
                  type="number" min={1} max={130}
                  value={edit.age}
                  onChange={(e) => setEdit((s) => ({ ...s, age: e.target.value }))}
                  placeholder="e.g. 68"
                  style={inputStyle}
                />
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium font-dm-sans"
                       style={{ color: dark ? '#8A7D72' : '#9A8C84' }}>Notes</label>
                <textarea
                  rows={2}
                  value={edit.notes}
                  onChange={(e) => setEdit((s) => ({ ...s, notes: e.target.value }))}
                  placeholder="Things to remember…"
                  style={{ ...inputStyle, resize: 'none' }}
                />
              </div>

              {/* Likes */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium font-dm-sans"
                       style={{ color: dark ? '#8A7D72' : '#9A8C84' }}>Interests</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={edit.likeInput}
                    onChange={(e) => setEdit((s) => ({ ...s, likeInput: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addLike(); } }}
                    placeholder="Add interest, Enter"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    onClick={addLike}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold font-dm-sans shrink-0"
                    style={{ background: 'rgba(201,148,58,0.15)', color: '#C9943A', border: '1px solid rgba(201,148,58,0.30)' }}
                  >+</button>
                </div>
                {edit.likes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {edit.likes.map((like) => (
                      <span key={like}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-dm-sans"
                            style={{ background: 'rgba(201,148,58,0.10)', color: '#C9943A', border: '1px solid rgba(201,148,58,0.20)' }}>
                        {like}
                        <button
                          onClick={() => setEdit((s) => ({ ...s, likes: s.likes.filter((l) => l !== like) }))}
                          className="hover:text-red-400 transition-colors"
                          aria-label={`Remove ${like}`}
                        >×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <p className="text-[11px] text-red-400 font-dm-sans">{error}</p>
              )}

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-2 rounded-xl text-xs font-semibold font-dm-sans flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#C9943A,#F0C97A)', color: 'white', boxShadow: '0 3px 12px rgba(201,148,58,0.30)' }}
              >
                {saving ? (
                  <>
                    <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                    Saving…
                  </>
                ) : 'Save Changes'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PeopleSidebar({ refreshTrigger, onAddPerson }: PeopleSidebarProps) {
  const { theme }  = useTheme();
  const dark       = theme === 'dark';
  const [people,  setPeople]  = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  const reload = () => setRefresh((n) => n + 1);

  useEffect(() => {
    setLoading(true);
    fetch('/api/people')
      .then((r) => r.json())
      .then((d) => setPeople(d.people ?? []))
      .catch(() => setPeople([]))
      .finally(() => setLoading(false));
  }, [refreshTrigger, refresh]);

  return (
    <div className="flex flex-col h-full gap-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" style={{ color: '#C9943A' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm font-semibold font-dm-sans" style={{ color: dark ? '#C4B09A' : '#6B5C52' }}>
            Known People
          </span>
          <span
            className="text-[11px] font-bold font-dm-sans px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(201,148,58,0.12)', color: '#C9943A' }}
          >
            {people.length}
          </span>
        </div>

        <button
          onClick={onAddPerson}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold font-dm-sans transition-all"
          style={{ background: 'linear-gradient(135deg,#C9943A,#F0C97A)', color: 'white', boxShadow: '0 2px 10px rgba(201,148,58,0.30)' }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2.5"
           style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(201,148,58,0.25) transparent' }}>
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 rounded-full animate-spin"
                 style={{ borderColor: 'rgba(201,148,58,0.25)', borderTopColor: '#C9943A' }} />
          </div>
        )}

        {!loading && people.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center"
                 style={{ background: 'rgba(201,148,58,0.08)', border: '1.5px dashed rgba(201,148,58,0.25)' }}>
              <svg className="w-7 h-7" style={{ color: 'rgba(201,148,58,0.40)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium font-dm-sans" style={{ color: dark ? '#C4B09A' : '#6B5C52' }}>
                No people enrolled yet
              </p>
              <p className="text-xs font-dm-sans mt-0.5" style={{ color: dark ? '#8A7D72' : '#9A8C84' }}>
                Tap Add to get started
              </p>
            </div>
          </div>
        )}

        {!loading && people.map((person) => (
          <motion.div
            key={person.name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
          >
            <PersonCard
              person={person}
              dark={dark}
              onUpdated={reload}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
