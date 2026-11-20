import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base keeps the build portable (Vercel root or any static host)
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { chunkSizeWarningLimit: 2000 },
});
