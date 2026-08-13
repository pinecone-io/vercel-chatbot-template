import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Node environment: the code under test uses Web APIs (fetch, TextEncoder,
    // ReadableStream) that are global in modern Node, not DOM APIs.
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      // Scope coverage to the backend/dependency-wrapping code these tests
      // target; the React components need a DOM harness and are out of scope.
      include: ["utils/**", "seed/**", "pages/api/**"],
      thresholds: {
        statements: 75,
        branches: 80,
        functions: 80,
        lines: 75,
      },
    },
  },
});
