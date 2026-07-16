import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Scoped away from Vitest's default include glob (which also matches
    // *.spec.ts) so a future Phase 5 Playwright spec under src/ can't get
    // picked up and run here by mistake.
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    // Mirrors tsconfig.json's "@/*" path so Vitest (which doesn't read
    // tsconfig paths on its own) can resolve the same "@/..." imports the
    // Next.js build already does.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
