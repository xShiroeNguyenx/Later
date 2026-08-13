import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'

// Avoids pulling in @types/node just to read one variable.
declare const process: { env: Record<string, string | undefined> }

/**
 * GitHub Pages serves a project site from /<repo>/, so the build has to know its
 * own prefix. CI sets BASE_PATH; locally it stays at the root.
 *
 * Everything that references an asset goes through this: `%BASE_URL%` in
 * index.html, `import.meta.env.BASE_URL` in src/audio/layers.ts, and the
 * generated manifest below.
 */
const base = process.env.BASE_PATH || '/'

/**
 * Source is written as ordinary React + TypeScript; `react` and `react-dom` are
 * aliased to preact/compat at build time (the preset does this for us). That
 * keeps the runtime at ~11 KB gzip instead of ~48 KB, which is what makes the
 * "visible before you finish reading the screen" budget achievable. To go back
 * to real React: drop the preact() plugin, `npm i react react-dom`, and remove
 * the `paths` block in tsconfig.json. No source file changes.
 */
export default defineConfig({
  base,
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // registered by hand at idle — see src/main.tsx
      // Generated rather than a static file in public/, so start_url, scope and
      // the icon paths all pick up `base` instead of assuming the root.
      manifest: {
        name: 'Later.',
        short_name: 'Later.',
        description: "A tiny app for nights when your mind won't stop.",
        lang: 'en',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#05070b',
        theme_color: '#05070b',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Audio is deliberately NOT precached: a first visit should cost a few
        // KB, not a megabyte. The beds land in the cache the first time they
        // actually play, via the runtime rule below.
        globPatterns: ['**/*.{js,css,html,png,webmanifest}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /\/audio\/.*\.m4a$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'later-audio-v1',
              // Media elements request byte ranges; without this the cached
              // 200 could never satisfy a 206 request.
              rangeRequests: true,
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 12 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 2048,
    reportCompressedSize: true,
  },
  server: { host: true },
})
