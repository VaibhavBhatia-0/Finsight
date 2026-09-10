/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          dark: '#0B0E14',
          light: '#F8F9FA',
        },
        card: {
          dark: '#121620',
          light: '#FFFFFF',
        },
        border: {
          dark: '#1F2633',
          light: '#E2E8F0',
        },
        gold: {
          50: '#FDFBF4',
          100: '#FBF7E9',
          200: '#F5ECBE',
          300: '#EFE193',
          400: '#E5C158',
          500: '#D4AF37', // Primary champagne/gold accent
          600: '#B89326',
          700: '#997E20',
          800: '#7A641A',
          900: '#5C4A13',
        },
        movement: {
          up: '#10B981',
          down: '#EF4444',
          neutral: '#9CA3AF',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

