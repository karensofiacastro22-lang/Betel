import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// La interfaz React vive en client/ y se compila en dist/, que sirve Express.
// En desarrollo (npm run dev) Vite corre en el puerto 5173 y reenvía la API al servidor Express (puerto 3000).
const API = 'http://localhost:3000';

export default defineConfig({
  root: 'client',
  publicDir: false,                 // las imágenes siguen en public/img y las sirve Express
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // React y el router van en un archivo aparte que el navegador guarda en caché entre versiones
        manualChunks: { react: ['react', 'react-dom', 'react-router-dom'] }
      }
    }
  },
  server: {
    port: 5173,
    proxy: { '/api': API, '/img': API, '/uploads': API }
  }
});
