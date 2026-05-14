import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 2000,
  },
  server: {
    host: true,
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo-acetel.png', 'logo-noun.png'],
      manifest: {
        name: 'ACETEL Virtual Internship Management System',
        short_name: 'ACETEL IMS',
        description: 'Manage internship placements, logbooks, attendance and communication — from anywhere.',
        theme_color: '#0a5c36',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        categories: ['education', 'productivity'],
        icons: [
          { src: 'logo-acetel.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'logo-acetel.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        shortcuts: [
          { name: 'My Logbook',   short_name: 'Logbook',   url: '/logbook',  description: 'Open daily logbook' },
          { name: 'Team Chat',    short_name: 'Chat',      url: '/chat',     description: 'Open team chat' },
          { name: 'Feedback',     short_name: 'Feedback',  url: '/feedback', description: 'Submit or view feedback' },
          { name: 'Attendance',   short_name: 'Attendance',url: '/attendance',description: 'Mark attendance' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Cache API GET responses briefly for offline resilience
            urlPattern: /\/api\/(notifications|feedback|chat|logbook)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
    }),
  ],
});
