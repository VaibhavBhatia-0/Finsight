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
        // Lavender accent. Text shades are remapped to theme tokens in index.css so they stay legible in light mode.
        accent: {
          50: '#F6F2FE',
          100: '#ECE4FD',
          200: '#DDD0FB',
          300: '#C5B3F6',
          400: '#B39CF2',
          500: '#9D80EC',
          600: '#8466DD',
          700: '#6F52CC',
          800: '#5A40A8',
          900: '#46327F',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"DM Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
