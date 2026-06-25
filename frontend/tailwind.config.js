/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'pulse-slow': 'pulse-slow 3s ease-in-out infinite',
      },
      keyframes: {
        'pulse-slow': {
          '0%, 100%': { opacity: 1, boxShadow: '0 0 0 0 rgba(59,130,246,0.3)' },
          '50%': { opacity: 0.85, boxShadow: '0 0 0 6px rgba(59,130,246,0)' },
        },
      },
    },
  },
  plugins: [],
}
