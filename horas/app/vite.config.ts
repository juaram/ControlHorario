import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  // Base de la app en producción: https://<dominio>/horas
  const env = loadEnv(mode, '.', '');
  const BASE = env.VITE_BASE_PATH || '/horas';

  return {
  plugins: [react(), tailwindcss()],
  base: BASE,
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    port: 5173,
    proxy: {
      // En desarrollo, redirige las llamadas a la API al servidor PHP local
      [`${BASE}/api`]: {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
  };
});