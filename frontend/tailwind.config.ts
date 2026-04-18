import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // App (dark) palette
        teal: { 300: '#81e6d9', 400: '#4fd1c5', 500: '#38b2ac' },
        amber: { 300: '#fbd38d', 400: '#f6ad55', 500: '#ed8936' },
        // Landing (warm) palette
        cream:  '#FAF6F1',
        sky:    '#D6E9F8',
        peach:  '#FDDFC4',
        gold: {
          DEFAULT: '#C9943A',
          light:   '#F0C97A',
          pale:    '#FDF3E0',
        },
        text: {
          dark: '#3A2F28',
          mid:  '#6B5C52',
          soft: '#9A8C84',
        },
      },
      fontFamily: {
        // App font
        sans:  ['var(--font-plus-jakarta)', 'system-ui', 'sans-serif'],
        // Landing fonts
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
        'dm-sans': ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg, #FAF6F1 0%, #EEF4FB 45%, #FDF0E8 100%)',
        'gold-gradient': 'linear-gradient(135deg, #C9943A 0%, #F0C97A 100%)',
      },
      boxShadow: {
        'warm-sm': '0 4px 14px rgba(180,140,100,0.12)',
        'warm-md': '0 8px 32px rgba(180,140,100,0.16)',
        'warm-lg': '0 16px 48px rgba(180,140,100,0.20)',
        'gold':    '0 4px 20px rgba(201,148,58,0.35)',
      },
      backdropBlur: {
        glass: '16px',
        '2xl': '40px',
      },
      animation: {
        'ping-slow':  'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'float':      'float 6s ease-in-out infinite',
        'float-slow': 'float 9s ease-in-out infinite reverse',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-20px)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
