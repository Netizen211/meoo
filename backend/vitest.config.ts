import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/services/**/*.ts'],
      thresholds: { statements: 60, branches: 50, functions: 60, lines: 60 },
    },
    testTimeout: 10000,
  },
});
