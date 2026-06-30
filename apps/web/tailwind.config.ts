import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // NXP brand palette
        brand: {
          blue: '#0B6EFF',
          gold: '#F5B301',
          emerald: '#00C896',
          dark: '#0D1117',
        },
        bg: {
          DEFAULT: '#0A0E17',
          surface: '#0F1622',
          elevated: '#151E2D',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        glow: '0 0 40px -10px rgba(11,110,255,0.45)',
        'glow-emerald': '0 0 40px -10px rgba(0,200,150,0.45)',
        card: '0 8px 30px -12px rgba(0,0,0,0.6)',
      },
      backgroundImage: {
        'grid-dark':
          'linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)',
        'brand-gradient': 'linear-gradient(135deg, #0B6EFF 0%, #00C896 100%)',
        'gold-gradient': 'linear-gradient(135deg, #F5B301 0%, #FF8A00 100%)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 2s infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
