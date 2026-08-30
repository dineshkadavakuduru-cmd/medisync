/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#00695C',
        'primary-light': '#E0F2F1',
        emergency: '#C62828',
        'emergency-light': '#FFCDD2',
        warning: '#FF8F00',
        success: '#2E7D32',
      },
    },
  },
  plugins: [],
};
