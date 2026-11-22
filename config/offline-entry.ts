import { resolve } from "node:path";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { Plugin } from "vite";

// TanStack's client-manifest capture requires exactly one client entry, so the
// offline fallback cannot be a second input of the main client build. Build it
// as a separate small client bundle after the main client build finishes and
// before vite-plugin-pwa generates the service worker (plugin order guarantees
// this closeBundle runs first). The fallback reuses the existing TanStack
// router client-side; SSR hydration stays reserved for real SSR documents.
export function offlineEntryPlugin(): Plugin {
  return {
    name: "catchback-offline-entry",
    apply: "build",
    async closeBundle() {
      if (this.environment?.name !== "client") return;
      const root = process.cwd();
      await build({
        configFile: false,
        root,
        mode: this.environment.config.mode,
        logLevel: "warn",
        plugins: [react(), tailwindcss()],
        resolve: { alias: { "@": resolve(root, "src") } },
        build: {
          outDir: "dist/client",
          emptyOutDir: false,
          rollupOptions: { input: resolve(root, "offline.html") },
        },
      });
    },
  };
}
