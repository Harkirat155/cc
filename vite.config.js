import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/cc/',
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
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
          if (normalized.includes('motion')) {
            return 'motion';
          }
          // Let React and its helpers live with the rest of the vendor chunk to
          // prevent chunk loading order issues at runtime (e.g., React depending on
          // other vendor utilities that in turn depend on React).
          if (normalized.includes('@radix-ui') || normalized.includes('lucide-react')) {
            return 'ui';
          }
          return 'vendor';
        },
      },
    },
  },
});
