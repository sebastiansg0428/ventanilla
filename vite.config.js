import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Cada HTML es una entrada independiente para conservar las URL actuales.
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        radicar: resolve(root, 'index.html'),
        login: resolve(root, 'login.html'),
        consultar: resolve(root, 'consultar.html'),
        usuarios: resolve(root, 'registro_usuario.html'),
      },
    },
  },
});
