import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The backend runs on port 3001. The browser talks to /api on the Vite
// dev server (port 5173) and Vite forwards it to the backend, so there are
// no CORS problems and no hard-coded port inside the React code.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = env.VITE_BACKEND_URL || 'http://localhost:3001';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': { target: backend, changeOrigin: true },
      },
    },
  };
});
