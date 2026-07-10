import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Node environment: the code under test uses Web APIs (fetch, TextEncoder,
    // ReadableStream) that are global in modern Node, not DOM APIs.
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
});
