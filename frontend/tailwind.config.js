/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f4f2',
          100: '#f0efed',
          200: '#ede9e5',
          300: '#c4c4c4',
          400: '#b0aba7',
          500: '#7a7370',
          600: '#655b55',
          700: '#554e4a',
          800: '#3b3530',
          900: '#2a2421',
        },
      },
      fontFamily: {
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        'xl': '14px',
        '2xl': '20px',
        '3xl': '24px',
        '4xl': '28px',
        '5xl': '32px',
      },
    },
  },
  plugins: [],
};
