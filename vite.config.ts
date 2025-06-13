import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base:
    process.env.NODE_ENV === 'production'
      ? '/react-yolo11n-object-detection-web/'
      : '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
