// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { offlineEntryPlugin } from "./config/offline-entry";

export default defineConfig({
  plugins: [offlineEntryPlugin(), VitePWA({
    strategies: "generateSW", filename: "sw.js", outDir: "dist/client",
    injectRegister: null, registerType: "autoUpdate", manifest: false,
    devOptions: { enabled: false },
    // Override autoUpdate's defaults after resolution: never interrupt drafts.
    integration: { beforeBuildServiceWorker: async options => {
      options.workbox.skipWaiting = false; options.workbox.clientsClaim = false;
      // Missing emitted fallback aborts the release. Version navigation caches
      // so old SSR documents cannot reference chunks removed by a later release.
      const fallback = await readFile("dist/client/offline.html");
      const release = createHash("sha256").update(fallback).digest("hex").slice(0, 12);
      const pages = options.workbox.runtimeCaching?.[0]?.options;
      if (pages) pages.cacheName = `catchback-pages-${release}`;
    } },
    workbox: {
      cacheId: "catchback-offline", cleanupOutdatedCaches: false,
      globPatterns: ["**/*.{js,css,jpg,jpeg,png,webp,woff2,ico}", "offline.html"],
      globIgnores: ["**/server/**"], maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      navigateFallback: null, skipWaiting: false, clientsClaim: false,
      runtimeCaching: [
        {
          urlPattern: ({ request, url, sameOrigin }) => sameOrigin && request.mode === "navigate" && /^(?:\/$|\/(?:journal|add|more|insights|reminders|plans|community)\/?$|\/catch\/[^/]+\/?$|\/trips(?:\/[^/]+)?\/?$)/.test(url.pathname) && !url.search,
          handler: "NetworkFirst", options: { cacheName: "catchback-pages", networkTimeoutSeconds: 3, cacheableResponse: { statuses: [200] }, expiration: { maxEntries: 40 }, precacheFallback: { fallbackURL: "/offline.html" } },
        },
        {
          urlPattern: ({ url, sameOrigin }) => sameOrigin && /^\/assets\/[^/]+-[\w-]{8,}\.(?:js|css|jpg|jpeg|png|webp|woff2)$/.test(url.pathname),
          handler: "CacheFirst", options: { cacheName: "catchback-assets", cacheableResponse: { statuses: [200] }, expiration: { maxEntries: 200 } },
        },
      ],
    },
  })],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
