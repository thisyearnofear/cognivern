import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  let backendUrl = env.VITE_BACKEND_URL || "http://localhost:3000";

  // Ensure backend URL uses HTTPS in production
  if (mode === "production" && !backendUrl.startsWith("https://")) {
    console.warn(`Backend URL ${backendUrl} does not use HTTPS. Switching to HTTPS for production.`);
    backendUrl = backendUrl.replace("http://", "https://");
  }

  console.log(`Vite backend URL [${mode}]:`, backendUrl);

  return {
    plugins: [react()],

    // Simplified build configuration
    build: {
      minify: 'esbuild',
      sourcemap: false,
    },

    server: {
      proxy: {
        "/api": {
          target: backendUrl,
          changeOrigin: true,
          secure: mode === "production", // Require HTTPS in production
          rewrite: (path) => path,
          // Handle CORS headers
          onProxyRes: (proxyRes) => {
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-API-KEY';
          },
        },
      },
    },
  };
});
