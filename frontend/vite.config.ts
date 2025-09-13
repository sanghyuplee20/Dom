import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isExtension = mode === 'extension';
  
  const config = {
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {} as Record<string, string>,
        output: {
          entryFileNames: (chunkInfo: any) => {
            if (isExtension) {
              if (chunkInfo.name === 'content') return 'content.js'
              if (chunkInfo.name === 'background') return 'background.js'
              if (chunkInfo.name === 'popup') return 'popup.js'
            }
            return '[name]-[hash].js'
          },
          chunkFileNames: '[name]-[hash].js',
          assetFileNames: '[name]-[hash].[ext]'
        }
      },
      outDir: 'dist',
      emptyOutDir: true
    },
    resolve: {
      alias: {
        '@': resolve(fileURLToPath(new URL('.', import.meta.url)), 'src')
      }
    }
  };

  if (isExtension) {
    config.build.rollupOptions.input = {
      // Extension popup
      popup: resolve(fileURLToPath(new URL('.', import.meta.url)), 'popup/popup.html'),
      // Content script
      content: resolve(fileURLToPath(new URL('.', import.meta.url)), 'content/content.ts'),
      // Background script
      background: resolve(fileURLToPath(new URL('.', import.meta.url)), 'background/background.ts'),
    };
  } else {
    config.build.rollupOptions.input = {
      // Web app entry
      main: resolve(fileURLToPath(new URL('.', import.meta.url)), 'index.html'),
    };
  }

  return config;
})
