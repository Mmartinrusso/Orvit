/**
 * Tests: lib/cache/redis-client.ts
 *
 * Validates the synchronous isRedisAvailable() implementation
 * using event listeners instead of async ping per request.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test the module in isolation, so we mock ioredis
const mockOn = vi.fn();
const mockQuit = vi.fn().mockResolvedValue('OK');
const mockRedisInstance = {
  on: mockOn,
  quit: mockQuit,
};

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => mockRedisInstance),
}));

// Import after mocking
import { getRedisClient, isRedisAvailable, closeRedisConnection } from '@/lib/cache/redis-client';

describe('Redis Client - Synchronous Connection State', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the module-level singleton by closing the connection
    // We need to reset the internal state
  });

  afterEach(async () => {
    await closeRedisConnection();
  });

  it('should return false for isRedisAvailable when no client exists', () => {
    // Before any client is created
    const result = isRedisAvailable();
    expect(typeof result).toBe('boolean');
    // After close, client is null, should return false
    expect(result).toBe(false);
  });

  it('should return a Redis client instance from getRedisClient()', () => {
    const client = getRedisClient();
    expect(client).toBeDefined();
    expect(client).toBe(mockRedisInstance);
  });

  it('should return same singleton instance on subsequent calls', () => {
    const client1 = getRedisClient();
    const client2 = getRedisClient();
    expect(client1).toBe(client2);
  });

  it('should register event listeners on first getRedisClient() call', () => {
    getRedisClient();

    // Should have registered: error, connect, ready, close, end
    const registeredEvents = mockOn.mock.calls.map((call) => call[0]);
    expect(registeredEvents).toContain('error');
    expect(registeredEvents).toContain('connect');
    expect(registeredEvents).toContain('ready');
    expect(registeredEvents).toContain('close');
    expect(registeredEvents).toContain('end');
  });

  it('should track connection state via connect event', () => {
    getRedisClient();

    // Find the connect handler and call it
    const connectCall = mockOn.mock.calls.find((call) => call[0] === 'connect');
    expect(connectCall).toBeDefined();

    const connectHandler = connectCall![1];
    connectHandler();

    expect(isRedisAvailable()).toBe(true);
  });

  it('should track connection state via ready event', () => {
    getRedisClient();

    const readyCall = mockOn.mock.calls.find((call) => call[0] === 'ready');
    const readyHandler = readyCall![1];
    readyHandler();

    expect(isRedisAvailable()).toBe(true);
  });

  it('should set unavailable on error event', () => {
    getRedisClient();

    // First connect
    const connectCall = mockOn.mock.calls.find((call) => call[0] === 'connect');
    connectCall![1]();
    expect(isRedisAvailable()).toBe(true);

    // Then error
    const errorCall = mockOn.mock.calls.find((call) => call[0] === 'error');
    errorCall![1](new Error('Connection refused'));
    expect(isRedisAvailable()).toBe(false);
  });

  it('should set unavailable on close event', () => {
    getRedisClient();

    // Connect first
    const connectCall = mockOn.mock.calls.find((call) => call[0] === 'connect');
    connectCall![1]();
    expect(isRedisAvailable()).toBe(true);

    // Then close
    const closeCall = mockOn.mock.calls.find((call) => call[0] === 'close');
    closeCall![1]();
    expect(isRedisAvailable()).toBe(false);
  });

  it('should set unavailable on end event', () => {
    getRedisClient();

    // Connect first
    const connectCall = mockOn.mock.calls.find((call) => call[0] === 'connect');
    connectCall![1]();
    expect(isRedisAvailable()).toBe(true);

    // Then end
    const endCall = mockOn.mock.calls.find((call) => call[0] === 'end');
    endCall![1]();
    expect(isRedisAvailable()).toBe(false);
  });

  it('should isRedisAvailable return boolean (not Promise)', () => {
    const result = isRedisAvailable();
    // This verifies the change from async to sync - result should NOT be a Promise
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result).toBe('boolean');
  });

  it('should close connection and reset client', async () => {
    getRedisClient();
    await closeRedisConnection();

    expect(mockQuit).toHaveBeenCalled();
    expect(isRedisAvailable()).toBe(false);
  });
});
