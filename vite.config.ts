import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Allow Cloudflare Quick Tunnel hosts when sharing this dev server temporarily.
    allowedHosts: [".trycloudflare.com", ".app.github.dev"],
  },
});
