import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const api = "http://127.0.0.1:4000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    strictPort: true,
    open: false,
    proxy: {
      "/admin": api,
      "/health": api,
    },
  },
});
