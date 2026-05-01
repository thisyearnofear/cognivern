import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-emotion': ['@emotion/react', '@emotion/styled'],
          'vendor-web3': [
            'viem',
            '@web3-react/core',
            '@tanstack/react-query',
          ],
          'vendor-charts': [
            'recharts',
            'chart.js',
            'react-chartjs-2',
          ],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
