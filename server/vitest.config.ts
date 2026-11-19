import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    env: { NODE_ENV: "test" },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/db/cli.ts", "src/jobs/worker.ts", "src/drivers/**"],
      reporter: ["text-summary", "html"],
      // N9 target: >= 70%. Enforced once modules are implemented (Iteration 2+).
      // thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 },
    },
  },
});
