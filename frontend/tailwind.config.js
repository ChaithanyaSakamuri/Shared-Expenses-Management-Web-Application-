/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Vibrant modern color system
        brand: {
          50: '#f5f7ff',
          100: '#ebf0ff',
          200: '#d6e0ff',
          300: '#b3c7ff',
          400: '#85a3ff',
          500: '#4d73ff',
          600: '#2648ff',
          700: '#1533e6',
          800: '#1129bd',
          900: '#142794',
        }
      }
    },
  },
  plugins: [],
}
