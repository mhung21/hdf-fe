/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
      },
    },
  },
  plugins: [
    require('daisyui')
  ],
  daisyui: {
    themes: [
      {
        crediflow: {
          "primary": "#16a34a",
          "primary-content": "#ffffff",
          "secondary": "#15803d",
          "secondary-content": "#ffffff",
          "accent": "#22c55e",
          "accent-content": "#ffffff",
          "neutral": "#3d4451",
          "neutral-content": "#ffffff",
          "base-100": "#ffffff",
          "base-200": "#f3f4f6",
          "base-300": "#e5e7eb",
          "base-content": "#1f2937",
          "info": "#3b82f6",
          "info-content": "#ffffff",
          "success": "#10b981",
          "success-content": "#ffffff",
          "warning": "#f59e0b",
          "warning-content": "#ffffff",
          "error": "#ef4444",
          "error-content": "#ffffff",
        },
      },
      "light",
      "dark",
    ],
    base: true,
    styled: true,
    utils: true,
    logs: false,
  },
}
