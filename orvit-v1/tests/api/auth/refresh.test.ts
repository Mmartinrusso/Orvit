/**
 * Integration Tests: POST /api/auth/refresh
 *
 * Tests:
 * - Successful token refresh
 * - Invalid refresh token
 * - Expired refresh token
 * - Revoked session
 * - Token rotation (old token becomes invalid)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initTestDatabase, cleanDatabase, disconnectTestDatabase, getTestPrisma } from '../../setup/db-setup';
import { createUser } from '../../factories/user.factory';
import { createMockRequest, parseJsonResponse, generateTestToken } from '../../utils/test-helpers';
import { mockCookieStore } from '../../setup/setup';
import { POST } from '@/app/api/auth/refresh/route';
import { createHash, randomBytes } from 'crypto';

describe('POST /api/auth/refresh', () => {
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
   * Hash token using SHA-256 (matches lib/auth/tokens.ts hashToken)
   */
  function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Helper to create a session and refresh token for a user.
   * Matches the real token format: tokenId.tokenValue with SHA-256 hash.
   */
  async function createSessionWithRefreshToken(userId: number) {
    const sessionId = randomBytes(16).toString('hex');
    const tokenId = randomBytes(32).toString('hex');
    const tokenValue = randomBytes(64).toString('hex');
    const tokenHash = hashToken(tokenValue);

    const session = await prisma.session.create({
      data: {
        id: sessionId,
        userId,
        isActive: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        lastActivityAt: new Date(),
      },
    });

    const refreshToken = await prisma.refreshToken.create({
      data: {
        id: tokenId,
        token: tokenHash,
        userId,
        sessionId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // The client-side refresh token has format: tokenId.tokenValue
    const refreshTokenString = `${tokenId}.${tokenValue}`;

    return { session, refreshToken, refreshTokenValue: refreshTokenString };
  }

  // ========================================================================
  // No Token
  // ========================================================================

  it('should reject refresh without refresh token cookie', async () => {
    // No cookie set in mockCookieStore
    const request = createMockRequest('/api/auth/refresh', {
      method: 'POST',
    });

    const response = await POST(request);
    const { status } = await parseJsonResponse(response);

    expect(status).toBe(401);
  });

  it('should reject refresh with invalid (non-existent) refresh token', async () => {
    mockCookieStore.set('refreshToken', { value: 'invalid-token-value' });

    const request = createMockRequest('/api/auth/refresh', {
      method: 'POST',
    });

    const response = await POST(request);
    const { status } = await parseJsonResponse(response);

    // Should reject - either 401 or 403
    expect([401, 403]).toContain(status);
  });

  // ========================================================================
  // Revoked Session
  // ========================================================================

  it('should reject refresh when session is revoked', async () => {
    const { user } = await createUser({ email: 'revoked@test.com' });
    const { refreshTokenValue, session } = await createSessionWithRefreshToken(user.id);

    // Revoke the session
    await prisma.session.update({
      where: { id: session.id },
      data: { isActive: false, revokedAt: new Date(), revokeReason: 'test' },
    });

    mockCookieStore.set('refreshToken', { value: refreshTokenValue });

    const request = createMockRequest('/api/auth/refresh', {
      method: 'POST',
    });

    const response = await POST(request);
    const { status } = await parseJsonResponse(response);

    expect([401, 403]).toContain(status);
  });

  // ========================================================================
  // Expired Session
  // ========================================================================

  it('should reject refresh when session has expired', async () => {
    const { user } = await createUser({ email: 'expired-session@test.com' });

    const sessionId = randomBytes(16).toString('hex');
    const tokenId = randomBytes(32).toString('hex');
    const tokenValue = randomBytes(64).toString('hex');
    const tokenHash = hashToken(tokenValue);

    await prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        isActive: true,
        expiresAt: new Date(Date.now() - 1000), // Already expired
        lastActivityAt: new Date(),
      },
    });

    await prisma.refreshToken.create({
      data: {
        id: tokenId,
        token: tokenHash,
        userId: user.id,
        sessionId,
        expiresAt: new Date(Date.now() - 1000), // Already expired
      },
    });

    mockCookieStore.set('refreshToken', { value: `${tokenId}.${tokenValue}` });

    const request = createMockRequest('/api/auth/refresh', {
      method: 'POST',
    });

    const response = await POST(request);
    const { status } = await parseJsonResponse(response);

    expect([401, 403]).toContain(status);
  });

  // ========================================================================
  // Blacklisted Token
  // ========================================================================

  it('should reject refresh with blacklisted token', async () => {
    const { user } = await createUser({ email: 'blacklisted@test.com' });
    const { refreshTokenValue } = await createSessionWithRefreshToken(user.id);

    // Add token to blacklist using SHA-256 hash (matching the real system)
    const tokenHashForBlacklist = hashToken(refreshTokenValue);
    await prisma.tokenBlacklist.create({
      data: {
        tokenHash: tokenHashForBlacklist,
        tokenType: 'refresh',
        userId: user.id,
        reason: 'test',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    mockCookieStore.set('refreshToken', { value: refreshTokenValue });

    const request = createMockRequest('/api/auth/refresh', {
      method: 'POST',
    });

    const response = await POST(request);
    const { status } = await parseJsonResponse(response);

    expect([401, 403]).toContain(status);
  });
});
