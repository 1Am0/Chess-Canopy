import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    environment: "node",
    passWithNoTests: true,
    include: ["tests/**/*.test.ts", "lib/**/*.test.ts"],
  },
});
