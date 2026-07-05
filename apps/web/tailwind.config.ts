import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // NXP brand palette — premium dark, sky-blue + cyan accents.
        brand: {
          blue: '#0EA5E9', // primary sky-blue
          blueDark: '#0891D4', // primary hover
          cyan: '#22D3EE', // accent
          gold: '#F59E0B',
          emerald: '#34D399', // profit / up
          red: '#F87171', // loss / down
          dark: '#020B18',
        },
        bg: {
          DEFAULT: '#04090F', // page background
          darker: '#020710', // alternating sections / ticker bar
          surface: '#080F1C', // cards
          elevated: '#0F1D35', // inputs / raised surfaces
        },
        ink: {
          DEFAULT: '#E8F1FF', // primary text
          soft: '#A0BDD8', // secondary text
          muted: '#5E7A96', // muted text / labels
          faint: '#2E3F54', // disabled / placeholders
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Figtree', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Barlow Condensed', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1rem',
      },
      boxShadow: {
        glow: '0 0 40px -10px rgba(14,165,233,0.45)',
        'glow-emerald': '0 0 40px -10px rgba(52,211,153,0.45)',
        card: '0 8px 30px -12px rgba(0,0,0,0.7)',
      },
      backgroundImage: {
        'grid-dark':
          'linear-gradient(to right, rgba(14,165,233,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(14,165,233,0.05) 1px, transparent 1px)',
        'brand-gradient': 'linear-gradient(135deg, #0EA5E9 0%, #22D3EE 100%)',
        'gold-gradient': 'linear-gradient(135deg, #F59E0B 0%, #FF8A00 100%)',
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
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 2s infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        ticker: 'ticker 40s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
