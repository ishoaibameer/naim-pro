import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    passWithNoTests: true,
    exclude: ["node_modules/**", "tests/e2e/**", "tests/integration/**"],
  },
})
