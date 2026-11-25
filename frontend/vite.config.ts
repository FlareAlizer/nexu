import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    // Прокси /api на Express в dev
    proxy: { "/api": "http://localhost:8000" },
  },
});
