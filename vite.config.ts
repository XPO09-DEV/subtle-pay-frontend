import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Allow Cloudflare Quick Tunnel hosts when sharing this dev server temporarily.
    allowedHosts: [".trycloudflare.com", ".app.github.dev"],
    // Let a temporary HTTPS tunnel expose one origin for both the UI and API.
    // Local development still uses the configured API base URL directly.
    proxy: Object.fromEntries([
      "/auth", "/me", "/home", "/wallet", "/gas", "/rates", "/assets",
      "/providers", "/contacts", "/payments", "/merchant", "/qr", "/bills",
      "/mandates", "/withdrawals", "/admin", "/meta",
    ].map((route) => [route, {
      target: process.env.SUBTLEPAY_API_PROXY_TARGET || "http://127.0.0.1:4055",
      changeOrigin: true,
    }])),
  },
});
