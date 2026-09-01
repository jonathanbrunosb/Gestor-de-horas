import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GITHUB_PAGES_BASE é definido pelo workflow de deploy. Com domínio próprio
// (public/CNAME), o site é servido na raiz, então o valor é '/'. Sem domínio
// próprio, seria '/<nome-do-repo>/' (URL padrão <usuario>.github.io/<repo>/).
// Em desenvolvimento local, cai para '/'.
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES_BASE || '/',
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
