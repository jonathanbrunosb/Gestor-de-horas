import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GITHUB_PAGES_BASE é definido pelo workflow de deploy como '/<nome-do-repo>/'.
// Em desenvolvimento local, cai para '/'.
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES_BASE || '/',
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
