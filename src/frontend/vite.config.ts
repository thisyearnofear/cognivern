import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  console.log(
    "Vite backend URL:",
    env.VITE_BACKEND_URL || "http://localhost:3000"
  );
  return {
    plugins: [react()],
    // Disable proxy - use direct API calls instead
    server: {
      // No proxy configuration - frontend will make direct calls to VITE_API_BASE_URL
    },
  };
});
