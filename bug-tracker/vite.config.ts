import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Produces build/app.js + build/app.css (stable file names; WordPress adds ?ver= cache busting).
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'build',
    emptyOutDir: true,
    cssCodeSplit: false,
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/main.tsx'),
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'app.js',
        assetFileNames: (info) => (info.name?.endsWith('.css') ? 'app.css' : 'assets/[name][extname]'),
      },
    },
  },
});
