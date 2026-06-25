import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api/nfemail': {
          target: 'https://api.nfemail.com.br',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/nfemail/, '/api'),
          secure: false
        },
        '/api/infinitepay-remote': {
          target: 'https://api.infinitepay.io',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/infinitepay-remote/, ''),
          secure: false
        }
      }
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'inline',
        devOptions: {
          enabled: true
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
        },
        manifestFilename: 'manifest.json',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg', 'logo_rtc_square.png'],
        manifest: {
          id: '/',
          name: 'RTC WEB - Sistema de Gestão',
          short_name: 'RTC WEB',
          description: 'Sistema de Gestão RTC - Toldos, Cortinas e Coberturas',
          theme_color: '#0f172a',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          start_url: './',
          scope: '/',
          lang: 'pt-BR',
          dir: 'ltr',
          categories: ['productivity', 'business'],
          icons: [
            {
              src: 'logo_rtc_square.png',
              sizes: '640x640',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'logo_rtc_square.png',
              sizes: '640x640',
              type: 'image/png',
              purpose: 'maskable'
            }
          ],
          screenshots: [
            {
              src: 'screenshot.png',
              sizes: '640x640',
              type: 'image/png',
              form_factor: 'wide'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      chunkSizeWarningLimit: 2000,
    }
  };
});
