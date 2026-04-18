'use client';

import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export default function ScrollIndicator() {
  const scroll = () => {
    const el = document.querySelector('#about');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex justify-center pb-10">
      <motion.button
        onClick={scroll}
        animate={{ y: [0, 10, 0] }}
        transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
        className="text-text-soft/60 hover:text-gold transition-colors cursor-pointer"
        aria-label="Scroll down"
      >
        <ChevronDown size={28} />
      </motion.button>
    </div>
  );
}
