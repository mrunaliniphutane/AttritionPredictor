/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0F1A2E',
        card: '#1B2A4A',
        'card-dark': '#142038',
        gold: '#D4A843',
        'gold-light': '#E8C068',
        success: '#34D399',
        danger: '#FB7185',
        warning: '#FBBF24',
        muted: '#8899BB',
        border: '#2A3F6A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #D4A843 0%, #E8C068 50%, #D4A843 100%)',
        'card-gradient': 'linear-gradient(135deg, #1B2A4A 0%, #142038 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
      }
    },
  },
  plugins: [],
}
