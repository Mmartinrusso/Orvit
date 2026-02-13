// Test setup file for Vitest
import { beforeAll, afterAll } from 'vitest';

// Mock environment variables for testing
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  // Add any other test environment setup here
});

afterAll(() => {
  // Cleanup after all tests
});

// Global test utilities can be added here
