import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['../tests/bulk-authorization*.test.ts'],
    setupFiles: ['tests/setup/setup.ts'],
    testTimeout: 10_000,
  },
  resolve: {
    alias: {
      '@/': path.resolve(__dirname, './') + '/',
      '@': path.resolve(__dirname, '.'),
    },
  },
});
