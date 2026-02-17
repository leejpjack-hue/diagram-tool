/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Executive Heritage Palette
        'deep-navy': '#1E293B',
        'slate-charcoal': '#334155',
        'electric-indigo': '#6366F1',
        'midnight-gold': '#854D0E',
        'canvas-white': '#FDFDFD',
        'panel-light': '#F8FAFC',
        'border-gray': '#E2E8F0',
        'success': '#10B981',
        'warning': '#F59E0B',
        'error': '#EF4444',
        'info': '#3B82F6',
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        'sans': ['Inter', 'Segoe UI', '-apple-system', 'sans-serif'],
      },
      spacing: {
        'panel-w': '400px',
        'sidebar-w': '280px',
        'header-h': '64px',
        'toolbar-h': '48px',
      },
    },
  },
  plugins: [],
}
