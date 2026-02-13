/**
 * Security Tests: Unauthorized Access
 *
 * Tests:
 * - Accessing protected endpoints without authentication token
 * - Using malformed tokens
 * - Using expired tokens
 * - Proper 401 responses with no sensitive information leakage
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { initTestDatabase, cleanDatabase, disconnectTestDatabase } from '../../setup/db-setup';
import { createMockRequest, parseJsonResponse, generateExpiredToken, generateInvalidToken } from '../../utils/test-helpers';
import { mockCookieStore } from '../../setup/setup';

// Mock notification services
vi.mock('@/lib/notifications/notification-service', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
  default: { sendNotification: vi.fn() },
}));

vi.mock('@/lib/discord/agenda-notifications', () => ({
  sendDiscordNotification: vi.fn().mockResolvedValue(undefined),
}));

describe('Unauthorized Access Attempts', () => {
  beforeAll(async () => {
    await initTestDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
    mockCookieStore.clear();
  });

  // ========================================================================
  // No Token
  // ========================================================================

  it('should reject /api/auth/me without token', async () => {
    const { GET } = await import('@/app/api/auth/me/route');
    const request = createMockRequest('/api/auth/me');
    const response = await GET(request);
    const { status } = await parseJsonResponse(response);
    expect(status).toBe(401);
  });

  it('should reject cost endpoints without token', async () => {
    mockCookieStore.clear();
    const { GET } = await import('@/app/api/costs/inputs/route');
    const request = createMockRequest('/api/costs/inputs');
    const response = await GET(request);
    const { status } = await parseJsonResponse(response);
    expect(status).toBe(401);
  });

  it('should reject recipe endpoints without token', async () => {
    mockCookieStore.clear();
    const { GET } = await import('@/app/api/costs/recipes/route');
    const request = createMockRequest('/api/costs/recipes');
    const response = await GET(request);
    const { status } = await parseJsonResponse(response);
    expect(status).toBe(401);
  });

  // ========================================================================
  // Malformed Token
  // ========================================================================

  it('should reject request with random string as token', async () => {
    const { GET } = await import('@/app/api/auth/me/route');
    mockCookieStore.set('token', { value: 'this-is-not-a-valid-jwt' });
    const request = createMockRequest('/api/auth/me');
    const response = await GET(request);
    const { status } = await parseJsonResponse(response);
    expect(status).toBe(401);
  });

  it('should reject request with empty token', async () => {
    const { GET } = await import('@/app/api/auth/me/route');
    mockCookieStore.set('token', { value: '' });
    const request = createMockRequest('/api/auth/me');
    const response = await GET(request);
    const { status } = await parseJsonResponse(response);
    expect(status).toBe(401);
  });

  it('should reject request with token signed by wrong secret', async () => {
    const invalidToken = await generateInvalidToken({
      userId: 1,
      email: 'hacker@evil.com',
    });

    const { GET } = await import('@/app/api/auth/me/route');
    mockCookieStore.set('token', { value: invalidToken });
    const request = createMockRequest('/api/auth/me');
    const response = await GET(request);
    const { status } = await parseJsonResponse(response);
    expect(status).toBe(401);
  });

  // ========================================================================
  // Expired Token
  // ========================================================================

  it('should reject request with expired token', async () => {
    const expiredToken = await generateExpiredToken({
      userId: 1,
      email: 'expired@test.com',
    });

    const { GET } = await import('@/app/api/auth/me/route');
    mockCookieStore.set('token', { value: expiredToken });
    const request = createMockRequest('/api/auth/me');
    const response = await GET(request);
    const { status } = await parseJsonResponse(response);
    expect(status).toBe(401);
  });

  // ========================================================================
  // No Information Leakage
  // ========================================================================

  it('should not leak sensitive information in 401 responses', async () => {
    const { GET } = await import('@/app/api/auth/me/route');
    const request = createMockRequest('/api/auth/me');
    const response = await GET(request);
    const { data } = await parseJsonResponse(response);

    // Should not contain stack traces, internal paths, or DB info
    const responseStr = JSON.stringify(data);
    expect(responseStr).not.toContain('prisma');
    expect(responseStr).not.toContain('postgres');
    expect(responseStr).not.toContain('node_modules');
    expect(responseStr).not.toContain('SELECT');
    expect(responseStr).not.toContain('password');
  });

  it('should not leak user information on failed login', async () => {
    const { POST } = await import('@/app/api/auth/login/route');
    const request = createMockRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'nonexistent@test.com', password: 'wrong' },
    });
    const response = await POST(request);
    const { data } = await parseJsonResponse(response);

    // Error message should be generic
    expect(data.error).not.toContain('not found');
    expect(data.error).not.toContain('does not exist');
    // Should use generic "invalid credentials" message
    expect(data.error).toBeDefined();
  });
});
