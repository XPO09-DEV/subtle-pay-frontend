import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/auth": "http://127.0.0.1:4000",
      "/me": "http://127.0.0.1:4000",
      "/home": "http://127.0.0.1:4000",
      "/wallet": "http://127.0.0.1:4000",
      "/alias": "http://127.0.0.1:4000",
      "/rates": "http://127.0.0.1:4000",
      "/payments": "http://127.0.0.1:4000",
      "/withdraw": "http://127.0.0.1:4000",
      "/contacts": "http://127.0.0.1:4000",
      "/bills": "http://127.0.0.1:4000",
      "/assets": "http://127.0.0.1:4000",
      "/mandates": "http://127.0.0.1:4000",
      "/merchant": "http://127.0.0.1:4000",
      "/bridge": "http://127.0.0.1:4000",
      "/health": "http://127.0.0.1:4000",
    },
  },
});
