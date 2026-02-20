import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['../tests/xss-sanitization-v3.test.ts'],
    testTimeout: 15_000,
  },
  resolve: {
    alias: {
      '@/': path.resolve(__dirname, './') + '/',
      '@': path.resolve(__dirname, '.'),
      // Mock isomorphic-dompurify (la versión real RC crashea en Node.js v20)
      'isomorphic-dompurify': path.resolve(__dirname, '../tests/__mocks__/isomorphic-dompurify.ts'),
    },
  },
});
