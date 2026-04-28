/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // *** สำคัญมาก: ต้องมีบรรทัดนี้ ***
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#050505',
          surface: '#111111',
          accent: '#deff9a',
        }
      }
    },
  },
  plugins: [],
}