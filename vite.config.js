import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';

export default defineConfig({
  plugins: [react()],
  base: '/crissCross/',
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
          if (id.includes('node_modules')) {
            if (id.includes('simple-peer')) {
              return 'voice';
            }
            if (id.includes('socket.io-client')) {
              return 'socket';
            }
            if (id.includes('@radix-ui') || id.includes('lucide-react')) {
              return 'ui';
            }
            return 'vendor';
          }
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
