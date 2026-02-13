/**
 * Global test setup
 * - Load environment variables for test
 * - Configure global mocks
 * - Set NODE_ENV to 'test'
 */
import { vi, beforeAll, afterAll } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.test from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

// Ensure test environment
process.env.NODE_ENV = 'test';

// ============================================================================
// Global Mocks
// ============================================================================

// Mock next/headers cookies() - returns a mock cookie store
const mockCookieStore = new Map<string, { value: string }>();

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) => mockCookieStore.get(name) || undefined,
    set: (name: string, value: string, _options?: any) => {
      mockCookieStore.set(name, { value });
    },
    delete: (name: string) => {
      mockCookieStore.delete(name);
    },
    getAll: () => Array.from(mockCookieStore.entries()).map(([name, v]) => ({ name, value: v.value })),
    has: (name: string) => mockCookieStore.has(name),
  }),
  headers: () => new Map(),
}));

// Mock logger to avoid noise in tests
vi.mock('@/lib/logger', () => {
  const noopLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: () => noopLogger,
  };
  return {
    loggers: new Proxy({}, {
      get: () => noopLogger,
    }),
    logger: noopLogger,
    default: noopLogger,
  };
});

// Mock S3 client
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
  ListObjectsV2Command: vi.fn(),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://mock-s3.example.com/signed-url'),
}));

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  withScope: vi.fn((cb: any) => cb({ setTag: vi.fn(), setExtra: vi.fn() })),
  init: vi.fn(),
}));

// Export mock cookie store for tests to manipulate
export { mockCookieStore };

// ============================================================================
// Global Hooks
// ============================================================================

beforeAll(() => {
  // Clear admin permissions cache
  (global as any).__adminPermissionsCache = undefined;
});

afterAll(() => {
  mockCookieStore.clear();
});
