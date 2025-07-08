import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl = env.VITE_BACKEND_URL;

  console.log("Vite backend URL:", backendUrl);

  return {
    plugins: [react()],
    server: {
      proxy: {
        // Proxy API requests to the backend server
        "/api": {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path,
        },
      },
    },
  };
});
