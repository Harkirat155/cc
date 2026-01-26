/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  jit: true,
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./index.html"
  ],
  theme: {
    extend: {
      /**
       * Responsive Design System
       * Based on industry best practices (Apple HIG, Material Design, WCAG)
       * Extensible for future grid sizes (5x5, etc.)
       */
      
      // Custom breakpoints aligned with design tokens
      screens: {
        'xs': '320px',
        // sm: 640px (default)
        // md: 768px (default)
        // lg: 1024px (default)
        // xl: 1280px (default)
      },
      
      // Fluid font sizes using clamp()
      fontSize: {
        // Responsive text scale
        'fluid-xs': ['clamp(0.6875rem, 0.625rem + 0.25vw, 0.75rem)', { lineHeight: '1.5' }],
        'fluid-sm': ['clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)', { lineHeight: '1.5' }],
        'fluid-base': ['clamp(0.875rem, 0.8rem + 0.35vw, 1rem)', { lineHeight: '1.5' }],
        'fluid-lg': ['clamp(1rem, 0.9rem + 0.5vw, 1.125rem)', { lineHeight: '1.4' }],
        'fluid-xl': ['clamp(1.125rem, 1rem + 0.625vw, 1.25rem)', { lineHeight: '1.4' }],
        'fluid-2xl': ['clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem)', { lineHeight: '1.3' }],
        'fluid-3xl': ['clamp(1.5rem, 1.25rem + 1.25vw, 1.875rem)', { lineHeight: '1.25' }],
        // Labels and badges
        'label': ['clamp(0.625rem, 0.575rem + 0.25vw, 0.6875rem)', { lineHeight: '1.4', letterSpacing: '0.05em' }],
        'badge': ['clamp(0.5625rem, 0.525rem + 0.2vw, 0.625rem)', { lineHeight: '1.4', letterSpacing: '0.1em' }],
      },
      
      // Responsive spacing
      spacing: {
        // Touch-friendly sizes (minimum 44px for Apple HIG, 48dp for Material)
        'touch-min': '44px',
        'touch': '48px',
        'touch-lg': '52px',
        // Grid cell sizes
        'cell-sm': 'clamp(3rem, 2.5rem + 2.5vw, 5rem)',
        'cell-md': 'clamp(4.375rem, 3.75rem + 3.125vw, 6.875rem)',
        // Panel heights
        'panel-sm': 'clamp(4.5rem, 4rem + 2.5vw, 5.5rem)',
        'panel-md': 'clamp(5rem, 4.5rem + 2.5vw, 6.25rem)',
        // Avatar/icon containers
        'avatar-sm': 'clamp(2rem, 1.75rem + 1.25vw, 2.5rem)',
        'avatar-md': 'clamp(2.5rem, 2.25rem + 1.25vw, 3rem)',
        'avatar-lg': 'clamp(3rem, 2.5rem + 2.5vw, 4rem)',
      },
      
      // Responsive min-width/height for touch targets
      minWidth: {
        'touch': '44px',
        'touch-lg': '48px',
        'btn': 'clamp(5rem, 4rem + 5vw, 7.5rem)',
      },
      minHeight: {
        'touch': '44px',
        'touch-lg': '48px',
        'btn-sm': 'clamp(2.25rem, 2rem + 1.25vw, 2.5rem)',
        'btn': 'clamp(2.5rem, 2.25rem + 1.25vw, 3rem)',
        'btn-lg': 'clamp(2.75rem, 2.5rem + 1.25vw, 3.25rem)',
        'navbar': 'clamp(3.5rem, 3.25rem + 1.25vw, 4rem)',
      },
      
      // Max widths for containers
      maxWidth: {
        'grid-3x3': 'min(90vw, 420px)',
        'grid-5x5': 'min(95vw, 520px)',
        'modal': 'min(90vw, 28rem)',
      },
      
      // Border radius
      borderRadius: {
        'cell': 'clamp(0.75rem, 0.625rem + 0.625vw, 1rem)',
        'card': 'clamp(0.875rem, 0.75rem + 0.625vw, 1.25rem)',
        'btn': 'clamp(0.5rem, 0.4rem + 0.5vw, 0.75rem)',
        'panel': 'clamp(1rem, 0.875rem + 0.625vw, 1.5rem)',
      },
      
      // Responsive padding
      padding: {
        'btn-x': 'clamp(1rem, 0.875rem + 0.625vw, 1.5rem)',
        'btn-y': 'clamp(0.5rem, 0.4rem + 0.5vw, 0.75rem)',
        'card': 'clamp(0.75rem, 0.625rem + 0.625vw, 1.25rem)',
        'panel': 'clamp(0.75rem, 0.625rem + 0.625vw, 1.25rem)',
      },
      
      // Responsive gap
      gap: {
        'cell': 'clamp(0.375rem, 0.25rem + 0.625vw, 0.75rem)',
        'panel': 'clamp(0.75rem, 0.625rem + 0.625vw, 1rem)',
      },
    },
  },
  plugins: [],
};
