/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        short: { raw: '(max-height: 600px)' },
        tall: { raw: '(min-height: 600px)' },
      },
    },
  },
  plugins: [],
};
