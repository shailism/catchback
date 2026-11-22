// Builds a self-contained, server-free copy of CatchBack for Capacitor.
// Reuses the client-only offline entry (existing TanStack router, no SSR);
// output: dist-native/index.html + hashed assets. Run: bun run build:native
import { resolve } from "node:path";
import { rename, rm } from "node:fs/promises";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Marks the bundle as the app-store build so offline status explains bundled files.
process.env["VITE_NATIVE_BUILD"] = "1";
const root = process.cwd();
const outDir = resolve(root, "dist-native");
await rm(outDir, { recursive: true, force: true });
await build({
  configFile: false,
  root,
  base: "/",
  logLevel: "warn",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": resolve(root, "src") } },
  build: { outDir, emptyOutDir: true, rollupOptions: { input: resolve(root, "offline.html") } },
});
await rename(resolve(outDir, "offline.html"), resolve(outDir, "index.html"));
console.log("Native web bundle ready in dist-native");
