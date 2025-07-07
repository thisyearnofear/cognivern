import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  console.log(
    "Vite proxy target:",
    env.VITE_BACKEND_URL || "http://localhost:3000"
  );
  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target: env.VITE_BACKEND_URL || "http://localhost:3000",
          changeOrigin: true,
          secure: false,
          configure: (proxy, options) => {
            proxy.on("error", (err, req, res) => {
              console.log("Proxy error:", err);
            });
            proxy.on("proxyReq", (proxyReq, req, res) => {
              console.log(
                "Proxying request to:",
                proxyReq.getHeader("host") + proxyReq.path
              );
            });
          },
        },
      },
    },
  };
});
