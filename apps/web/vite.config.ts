import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import { questionContentPlugin } from './vite-content-plugin';

export default defineConfig({
  build: {
    manifest: true,
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
  plugins: [
    react(),
    questionContentPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icon.svg',
        'icon-192.png',
        'icon-512.png',
        'apple-touch-icon.png',
        'question-assets/**/*',
      ],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,json}'],
      },
      manifest: {
        name: 'AgentPrep',
        short_name: 'AgentPrep',
        description: 'Agent / LLM 岗秋招的 local-first 学习 PWA',
        theme_color: '#172033',
        background_color: '#f5f2e9',
        display: 'standalone',
        start_url: '/',
        lang: 'zh-CN',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
});
