import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['../tests/xss-sanitization.test.ts'],
    testTimeout: 15_000,
  },
  resolve: {
    alias: {
      '@/': path.resolve(__dirname, './') + '/',
      '@': path.resolve(__dirname, '.'),
      // Mock isomorphic-dompurify con un shim que no depende de jsdom
      'isomorphic-dompurify': path.resolve(__dirname, '../tests/__mocks__/isomorphic-dompurify.ts'),
    },
  },
});
