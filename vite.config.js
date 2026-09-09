import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const isLib = mode === 'lib';

  return {
    plugins: [react()],
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    server: {
      port: 5173,
      open: '/gallery-preview.html',
    },
    build: isLib
      ? {
          outDir: 'assets/js',
          emptyOutDir: false,
          cssCodeSplit: false,
          lib: {
            entry: path.resolve(__dirname, 'clinic-galleries-main.jsx'),
            name: 'ClinicGalleries',
            formats: ['iife'],
            fileName: () => 'clinic-galleries.js',
          },
          rollupOptions: {
            output: {
              inlineDynamicImports: true,
              assetFileNames: (assetInfo) => {
                if (assetInfo.name && assetInfo.name.endsWith('.css')) {
                  return 'clinic-galleries.css';
                }
                return 'clinic-galleries-[name][extname]';
              },
            },
          },
        }
      : {
          outDir: 'dist-galleries',
          emptyOutDir: true,
          rollupOptions: {
            input: {
              preview: path.resolve(__dirname, 'gallery-preview.html'),
            },
          },
        },
  };
});
