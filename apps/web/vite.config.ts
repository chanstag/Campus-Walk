import path from "node:path";
import process from "node:process";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The API is on 3001 in dev. The Playwright run sets API_PORT for its own API (3101); another
// worktree can point at a full URL with API_URL=http://localhost:3002.
const api = process.env.API_URL ?? `http://localhost:${process.env.API_PORT ?? 3001}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    },
  },
});
