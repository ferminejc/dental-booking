import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Scoped away from Vitest's default include glob (which also matches
    // *.spec.ts) so a future Phase 5 Playwright spec under src/ can't get
    // picked up and run here by mistake.
    include: ["src/**/*.test.ts"],
  },
});
