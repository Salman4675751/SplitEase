/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary uses CSS variables so themes can swap palettes at runtime
        // without rebuilding Tailwind. See themes block in index.css.
        primary: {
          50:  'rgb(var(--p-50)  / <alpha-value>)',
          100: 'rgb(var(--p-100) / <alpha-value>)',
          200: 'rgb(var(--p-200) / <alpha-value>)',
          300: 'rgb(var(--p-300) / <alpha-value>)',
          400: 'rgb(var(--p-400) / <alpha-value>)',
          500: 'rgb(var(--p-500) / <alpha-value>)',
          600: 'rgb(var(--p-600) / <alpha-value>)',
          700: 'rgb(var(--p-700) / <alpha-value>)',
          800: 'rgb(var(--p-800) / <alpha-value>)',
          900: 'rgb(var(--p-900) / <alpha-value>)',
        },
        dark: {
          bg: '#0f172a',
          card: '#1e293b',
          border: '#334155',
          text: '#e2e8f0',
          muted: '#94a3b8',
        },
      },
      fontFamily: {
        sans: ['Montserrat', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Montserrat', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'logo-bar-top': {
          '0%':   { transform: 'translateX(-12px)', opacity: '0' },
          '60%':  { transform: 'translateX(2px)',   opacity: '1' },
          '100%': { transform: 'translateX(0)',     opacity: '1' },
        },
        'logo-bar-bottom': {
          '0%':   { transform: 'translateX(12px)',  opacity: '0' },
          '60%':  { transform: 'translateX(-2px)',  opacity: '1' },
          '100%': { transform: 'translateX(0)',     opacity: '1' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
        'pulse-ring': {
          '0%':   { transform: 'scale(0.8)', opacity: '0.6' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
      },
      animation: {
        'logo-bar-top':    'logo-bar-top 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'logo-bar-bottom': 'logo-bar-bottom 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both 0.1s',
        'float':           'float 4s ease-in-out infinite',
        'pulse-ring':      'pulse-ring 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      boxShadow: {
        'glow':    '0 0 40px -8px rgb(var(--p-500) / 0.4)',
        'glow-lg': '0 0 60px -12px rgb(var(--p-500) / 0.5)',
      },
    },
  },
  plugins: [],
};
