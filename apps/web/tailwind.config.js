/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#F7F8F4',
        surface: {
          DEFAULT: '#FFFFFF',
          subtle: '#EEF2EB',
        },
        ink: {
          DEFAULT: '#18251D',
          secondary: '#526158',
        },
        line: '#DCE3DA',
        brand: {
          DEFAULT: '#245C3B',
          hover: '#19452B',
          soft: '#E5EFE4',
          lime: '#D9E8AA',
        },
        status: {
          warning: '#8A570B',
          'warning-bg': '#FDF7EC',
          'warning-border': '#EAD4AA',
          error: '#B33D35',
          'error-bg': '#FDF2F1',
          'error-border': '#EBC5C2',
          info: '#315E8B',
          'info-bg': '#EFF5FA',
          'info-border': '#C7D8EA',
        },
      },
      fontFamily: {
        sans: ['Montserrat', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
