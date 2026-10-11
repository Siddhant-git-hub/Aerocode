/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f7f6fb',
        ink: '#0e0c16',
        iris: {
          DEFAULT: '#6d28d9',
          deep: '#4c1d95',
          soft: '#a78bfa',
          wash: '#ede9fe',
        },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'Instrument Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
