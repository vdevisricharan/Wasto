/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        wasto: {
          50: '#eefdf5',
          100: '#d6fae6',
          200: '#b0f4d0',
          300: '#77eab3',
          400: '#38d790',
          500: '#17DE8F', // Wasto Brand Accent
          600: '#0ca86a',
          700: '#0c8455',
          800: '#0e6845',
          900: '#0e563a',
          950: '#053020',
        },
        surface: {
          900: '#0B0F17',
          800: '#111827',
          700: '#1F2937',
          600: '#374151',
        }
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
