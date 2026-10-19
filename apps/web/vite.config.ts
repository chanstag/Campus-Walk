import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Forward tRPC calls to the Fastify API in dev so the browser sees one origin.
      "/trpc": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
