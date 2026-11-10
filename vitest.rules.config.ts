import { defineConfig } from "vitest/config";

// Firestore güvenlik kuralları testleri: Emulator içinde çalışır (npm run test:rules).
export default defineConfig({
  test: {
    include: ["tests/rules.test.ts"],
    testTimeout: 20000,
    fileParallelism: false,
  },
});
