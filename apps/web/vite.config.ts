import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

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
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      // Better Auth endpoints live on the API too; same-origin so session cookies just work.
      "/api/auth": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
