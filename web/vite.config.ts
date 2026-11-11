import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
      manifest: {
        name: 'ניהול משימות',
        short_name: 'משימות',
        lang: 'he',
        dir: 'rtl',
        start_url: '/today',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#5B5FEF',
        background_color: '#F5F6FA',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'משימה חדשה', url: '/today?new=1' },
          { name: 'היום', url: '/today' },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query', '@supabase/supabase-js'],
          radix: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-popover', '@radix-ui/react-tooltip'],
          charts: ['recharts'],
          calendar: ['@fullcalendar/core', '@fullcalendar/react', '@fullcalendar/daygrid', '@fullcalendar/interaction'],
          hebcal: ['@hebcal/core'],
          dnd: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },
  },
});
