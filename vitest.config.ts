import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Transform .tsx with the automatic JSX runtime so importing client
  // components in tests doesn't require React in scope.
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Keep any accidental DB import off the real data volume during tests.
    env: {
      DATABASE_PATH: ":memory:",
    },
    // Integration tests share one in-memory SQLite DB (the db singleton), so run
    // test files serially to avoid one file's cleanup racing another's data.
    fileParallelism: false,
  },
});
