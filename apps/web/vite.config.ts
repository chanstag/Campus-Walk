import path from "node:path";
import process from "node:process";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// The API is on 3001 in dev. The Playwright run sets API_PORT for its own API (3101); another
// worktree can point at a full URL with API_URL=http://localhost:3002.
const api = process.env.API_URL ?? `http://localhost:${process.env.API_PORT ?? 3001}`;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Service worker (production builds only): precaches the app shell so /walk opens with no
    // network. Data offline comes from the persisted query cache (src/offline), not from here,
    // so API, auth and photo routes are never served from the worker.
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: {
        name: "Campus Walk",
        short_name: "Campus Walk",
        start_url: "/walk",
        display: "standalone",
        icons: [{ src: "/campus-walk-logo.svg", sizes: "any", type: "image/svg+xml" }],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/trpc/, /^\/api\//, /^\/files\//],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Forward tRPC calls to the Fastify API in dev so the browser sees one origin.
      "/trpc": {
        target: api,
        changeOrigin: true,
      },
      // Better Auth endpoints live on the API too; same-origin so session cookies just work.
      "/api/auth": {
        target: api,
        changeOrigin: true,
      },
      // Photo bytes (signed blob-store URLs) are served by the API as well.
      "/files": {
        target: api,
        changeOrigin: true,
      },
    },
  },
});
