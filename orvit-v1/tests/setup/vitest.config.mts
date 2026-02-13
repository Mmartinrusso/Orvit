import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    setupFiles: ['tests/setup/setup.ts'],
    testTimeout: 10_000,
    hookTimeout: 60_000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'html'],
      reportsDirectory: 'coverage',
      include: [
        'app/api/auth/**/*.ts',
        'app/api/permissions/**/*.ts',
        'app/api/admin/permissions/**/*.ts',
        'app/api/admin/user-permissions/**/*.ts',
        'app/api/costs/**/*.ts',
        'app/api/work-orders/**/*.ts',
        'lib/auth/**/*.ts',
        'lib/auth.ts',
        'lib/permissions-helpers.ts',
        'lib/costs/calculator.ts',
      ],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': projectRoot,
    },
  },
});
