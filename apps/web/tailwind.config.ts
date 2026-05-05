import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#E6F7F2',
          100: '#C0EBD9',
          500: '#1D9E75',
          600: '#178060',
          700: '#0F5E46',
        },
        danger: { 500: '#D4537E', 100: '#FCEBEB' },
        warning: { 500: '#BA7517', 100: '#FAEEDA' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
