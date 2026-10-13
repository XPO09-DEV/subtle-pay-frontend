import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts: [".github.dev", ".githubpreview.dev", ".devtunnels.ms"],
    proxy: Object.fromEntries(
      [
        "/auth", "/me", "/home", "/wallet", "/payments", "/rates", "/alias",
        "/contacts", "/bills", "/mandates", "/withdraw", "/bridge", "/assets",
        "/api", "/market", "/search", "/coins", "/admin",
      ].map((path) => [
        path,
        {
          target: "http://127.0.0.1:4000",
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => proxyReq.removeHeader("origin"));
          },
        },
      ]),
    ),
  },
});
