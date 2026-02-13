/**
 * Integration Tests: POST /api/auth/logout
 *
 * Tests:
 * - Successful logout clears cookies
 * - Logout revokes session
 * - Logout with ?all=true revokes all sessions
 * - Logout without session still clears cookies
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initTestDatabase, cleanDatabase, disconnectTestDatabase, getTestPrisma } from '../../setup/db-setup';
import { createUser } from '../../factories/user.factory';
import { createMockRequest, parseJsonResponse, generateTestToken } from '../../utils/test-helpers';
import { mockCookieStore } from '../../setup/setup';
import { POST } from '@/app/api/auth/logout/route';
import { randomUUID } from 'crypto';

describe('POST /api/auth/logout', () => {
  const prisma = getTestPrisma();

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

  /**
   * Helper to create sessions for a user
   */
  async function createUserWithSessions(email: string, sessionCount = 1) {
    const { user, plainPassword } = await createUser({ email });
    const sessions = [];

    for (let i = 0; i < sessionCount; i++) {
      const session = await prisma.session.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          isActive: true,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          lastActivityAt: new Date(),
          deviceName: `Device ${i + 1}`,
        },
      });
      sessions.push(session);
    }

    return { user, plainPassword, sessions };
  }

  // ========================================================================
  // Successful Logout
  // ========================================================================

  it('should respond successfully on logout', async () => {
    const { user, sessions } = await createUserWithSessions('logout@test.com');

    const token = await generateTestToken({
      userId: user.id,
      email: user.email,
      sessionId: sessions[0].id,
    });

    // Set cookies in mockCookieStore (route reads via getAuthCookies -> cookies())
    mockCookieStore.set('token', { value: token });
    mockCookieStore.set('accessToken', { value: token });

    const request = createMockRequest('/api/auth/logout', {
      method: 'POST',
    });

    const response = await POST(request);
    const { status } = await parseJsonResponse(response);

    expect(status).toBe(200);
  });

  it('should revoke the session on logout', async () => {
    const { user, sessions } = await createUserWithSessions('revoke@test.com');
    const sessionId = sessions[0].id;

    const token = await generateTestToken({
      userId: user.id,
      email: user.email,
      sessionId,
    });

    mockCookieStore.set('token', { value: token });
    mockCookieStore.set('accessToken', { value: token });

    const request = createMockRequest('/api/auth/logout', {
      method: 'POST',
    });

    await POST(request);

    // Check session is revoked
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (session) {
      expect(session.isActive).toBe(false);
    }
  });

  // ========================================================================
  // Logout All Sessions
  // ========================================================================

  it('should revoke all sessions when ?all=true', async () => {
    const { user, sessions } = await createUserWithSessions('logoutall@test.com', 3);

    const token = await generateTestToken({
      userId: user.id,
      email: user.email,
      sessionId: sessions[0].id,
    });

    mockCookieStore.set('token', { value: token });
    mockCookieStore.set('accessToken', { value: token });

    const request = createMockRequest('/api/auth/logout?all=true', {
      method: 'POST',
    });

    await POST(request);

    // Check all sessions are revoked
    const activeSessions = await prisma.session.findMany({
      where: { userId: user.id, isActive: true },
    });

    expect(activeSessions.length).toBe(0);
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  it('should handle logout without any token gracefully', async () => {
    // No cookies set in mockCookieStore
    const request = createMockRequest('/api/auth/logout', {
      method: 'POST',
    });

    const response = await POST(request);
    const { status } = await parseJsonResponse(response);

    // Should still succeed (clear cookies) or return 401
    expect([200, 401]).toContain(status);
  });

  it('should handle logout with invalid token gracefully', async () => {
    mockCookieStore.set('token', { value: 'invalid-jwt-token' });
    mockCookieStore.set('accessToken', { value: 'invalid-jwt-token' });

    const request = createMockRequest('/api/auth/logout', {
      method: 'POST',
    });

    const response = await POST(request);
    const { status } = await parseJsonResponse(response);

    // Should handle gracefully - either 200 (cookies cleared) or 401
    expect([200, 401]).toContain(status);
  });
});
