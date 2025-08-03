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
        manualChunks: undefined, // Reduce chunk splitting for smaller files
        format: 'es', // Use ES module format
      },
      sourcemap: true, // Generate source maps for easier debugging
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
