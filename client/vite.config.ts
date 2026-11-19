import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Forward API calls to the Express server during development.
    proxy: { "/api": "http://localhost:3000" },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.tsx", "src/**/*.test.ts"],
    coverage: { provider: "v8", include: ["src/**/*.{ts,tsx}"], reporter: ["text-summary", "html"] },
  },
});
