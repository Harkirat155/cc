import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';

export default defineConfig({
  plugins: [react()],
  base: '/cc/',
  esbuild: {
    // loader: 'jsx', // Remove or set as string if needed
    minify: true, // Minify JS in dev and build
    treeShaking: true, // Remove unused JS
  },
  build: {
    minify: 'esbuild', // Use esbuild for minification
    rollupOptions: {
      treeshake: true, // Remove unused code
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          const normalized = id.split('node_modules')[1] || '';
          if (normalized.includes('simple-peer')) {
            return 'voice';
          }
          if (normalized.includes('socket.io-client')) {
            return 'socket';
          }
          if (normalized.includes('react-joyride')) {
            return 'walkthrough';
          }
          if (
            normalized.includes('/react/') ||
            normalized.includes('/react-dom/') ||
            normalized.includes('/scheduler/') ||
            normalized.includes('react/jsx-runtime')
          ) {
            return 'react';
          }
          if (normalized.includes('@radix-ui') || normalized.includes('lucide-react')) {
            return 'ui';
          }
          return 'vendor';
        },
      },
    },
  },
  css: {
    postcss: {
      plugins: [
        autoprefixer,
        tailwindcss,
      ],
    },
  },
});
