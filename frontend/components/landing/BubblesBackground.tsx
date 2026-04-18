'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from '@/lib/theme-context';

// Each bubble config
interface Bubble {
  id:       number;
  x:        number;   // % from left
  size:     number;   // px
  duration: number;   // seconds to float up
  delay:    number;   // seconds before starting
  opacity:  number;
  wobble:   number;   // horizontal sway amplitude px
}

// Pre-generated so SSR matches client (no Math.random on render)
const BUBBLES: Bubble[] = [
  { id:  1, x:  5, size: 18, duration: 9,  delay: 0,    opacity: 0.55, wobble: 14 },
  { id:  2, x: 12, size: 32, duration: 14, delay: 1.5,  opacity: 0.35, wobble: 22 },
  { id:  3, x: 21, size: 12, duration: 8,  delay: 3,    opacity: 0.65, wobble: 10 },
  { id:  4, x: 31, size: 44, duration: 17, delay: 0.8,  opacity: 0.25, wobble: 30 },
  { id:  5, x: 40, size: 20, duration: 11, delay: 4.2,  opacity: 0.50, wobble: 16 },
  { id:  6, x: 48, size: 58, duration: 20, delay: 2,    opacity: 0.18, wobble: 38 },
  { id:  7, x: 55, size: 14, duration: 7,  delay: 5.5,  opacity: 0.60, wobble: 12 },
  { id:  8, x: 63, size: 36, duration: 15, delay: 0.3,  opacity: 0.30, wobble: 24 },
  { id:  9, x: 70, size: 22, duration: 12, delay: 3.8,  opacity: 0.45, wobble: 18 },
  { id: 10, x: 78, size: 48, duration: 18, delay: 1.1,  opacity: 0.22, wobble: 32 },
  { id: 11, x: 85, size: 16, duration: 9,  delay: 6,    opacity: 0.58, wobble: 13 },
  { id: 12, x: 92, size: 28, duration: 13, delay: 2.7,  opacity: 0.38, wobble: 20 },
  // second wave (offset positions)
  { id: 13, x:  8, size: 38, duration: 16, delay: 7,    opacity: 0.28, wobble: 26 },
  { id: 14, x: 17, size: 24, duration: 10, delay: 8.5,  opacity: 0.48, wobble: 17 },
  { id: 15, x: 26, size: 52, duration: 19, delay: 4,    opacity: 0.20, wobble: 36 },
  { id: 16, x: 36, size: 10, duration: 6,  delay: 9.2,  opacity: 0.70, wobble:  8 },
  { id: 17, x: 44, size: 30, duration: 14, delay: 6.8,  opacity: 0.33, wobble: 22 },
  { id: 18, x: 52, size: 42, duration: 17, delay: 3.5,  opacity: 0.24, wobble: 29 },
  { id: 19, x: 60, size: 16, duration: 8,  delay: 10,   opacity: 0.60, wobble: 13 },
  { id: 20, x: 68, size: 26, duration: 12, delay: 5,    opacity: 0.42, wobble: 19 },
  { id: 21, x: 76, size: 60, duration: 21, delay: 1.8,  opacity: 0.16, wobble: 40 },
  { id: 22, x: 83, size: 20, duration: 9,  delay: 7.5,  opacity: 0.52, wobble: 15 },
  { id: 23, x: 89, size: 34, duration: 15, delay: 4.7,  opacity: 0.32, wobble: 24 },
  { id: 24, x: 96, size: 14, duration: 7,  delay: 11,   opacity: 0.62, wobble: 11 },
];

export default function BubblesBackground() {
  const { theme } = useTheme();

  // Bubble colour based on theme
  const bubbleColor = theme === 'dark'
    ? 'rgba(201,148,58,'    // gold tint for dark
    : 'rgba(201,148,58,';   // same warm gold for light

  const shimmerColor = theme === 'dark'
    ? 'rgba(255,255,255,0.12)'
    : 'rgba(255,255,255,0.55)';

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      aria-hidden
      style={{ zIndex: 0 }}
    >
      {BUBBLES.map((b) => (
        <div
          key={b.id}
          className="absolute rounded-full"
          style={{
            left:    `${b.x}%`,
            bottom:  `-${b.size + 20}px`,
            width:   `${b.size}px`,
            height:  `${b.size}px`,
            // Layered radial for glass-bubble look: inner highlight + ring
            background: `radial-gradient(circle at 35% 35%, ${shimmerColor} 0%, transparent 60%), radial-gradient(circle at 50% 50%, ${bubbleColor}${b.opacity * 0.6}) 0%, ${bubbleColor}${b.opacity}) 70%, transparent 100%)`,
            border: `1px solid ${bubbleColor}${Math.min(b.opacity + 0.15, 0.8)})`,
            boxShadow: `inset 0 0 ${b.size * 0.3}px ${bubbleColor}${b.opacity * 0.4}), 0 0 ${b.size * 0.2}px ${bubbleColor}${b.opacity * 0.2})`,
            animation: `bubble-rise ${b.duration}s ease-in ${b.delay}s infinite, bubble-wobble ${b.duration * 0.6}s ease-in-out ${b.delay}s infinite alternate`,
            '--wobble': `${b.wobble}px`,
          } as React.CSSProperties}
        />
      ))}

      <style>{`
        @keyframes bubble-rise {
          0%   { transform: translateY(0)   scale(1);    opacity: 0; }
          5%   { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(-110vh) scale(0.85); opacity: 0; }
        }
        @keyframes bubble-wobble {
          0%   { margin-left: 0px; }
          100% { margin-left: var(--wobble); }
        }
        @media (prefers-reduced-motion: reduce) {
          .bubble-bg-el { animation: none !important; opacity: 0 !important; }
        }
      `}</style>
    </div>
  );
}
