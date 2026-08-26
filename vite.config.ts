import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_TARGET || 'http://localhost:9000';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      tsconfigPaths: true,
    },
    server: {
      host: true,
      port: 8000,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/webhook': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: true,
      port: 8000,
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: env.VITE_SOURCEMAP === 'true',
    },
  };
});
