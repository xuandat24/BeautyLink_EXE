import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (/node_modules[\\/]react(?:-dom)?[\\/]/.test(id) || id.includes('node_modules/scheduler/')) return 'react-vendor';
            if (id.includes('node_modules/lucide-react/')) return 'icons-vendor';
            if (id.includes('node_modules/motion/')) return 'motion-vendor';
            if (id.includes('node_modules/axios/')) return 'api-vendor';
            if (id.includes('node_modules/zod/')) return 'validation-vendor';
            if (id.includes('node_modules/browser-image-compression/')) return 'image-vendor';
            return undefined;
          },
        },
      },
    },
    server: {
      port: 5173,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
  };
});
