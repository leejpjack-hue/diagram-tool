/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      'mobile': { max: '639px' },          // Mobile portrait
      'sm': '640px',                        // Mobile landscape
      'tablet': '768px',                    // Tablet portrait
      'tablet-only': { min: '768px', max: '1023px' },
      'lg': '1024px',                       // Tablet landscape
      'desktop': '1280px',                  // Desktop
      'xl': '1536px',                       // Large desktop
    },
    extend: {
      colors: {
        // Vibrant Tech Palette (Colorful & Energetic)
        'electric-blue': '#3B82F6',
        'vivid-purple': '#8B5CF6',
        'hot-pink': '#EC4899',
        'emerald': '#10B981',
        'amber': '#F59E0B',
        'red': '#EF4444',
        
        // Base colors
        'canvas-white': '#FDFDFD',
        'panel-light': '#F8FAFC',
        'border-gray': '#E2E8F0',
        'deep-navy': '#1E293B',
        'slate-charcoal': '#334155',
        
        // Semantic
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
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
