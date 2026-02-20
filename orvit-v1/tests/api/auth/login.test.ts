/**
 * Integration Tests: POST /api/auth/login
 *
 * Tests:
 * - Successful login with valid credentials
 * - Invalid credentials (wrong password)
 * - Non-existent user
 * - Inactive user
 * - User without password
 * - Missing fields
 * - JWT cookie generation
 * - Rate limiting
 * - Login by username (name field)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initTestDatabase, cleanDatabase, disconnectTestDatabase, getTestPrisma } from '../../setup/db-setup';
import { createUser, createInactiveUser, createUserWithoutPassword } from '../../factories/user.factory';
import { createCompany } from '../../factories/company.factory';
import { createMockRequest, parseJsonResponse } from '../../utils/test-helpers';
import { POST } from '@/app/api/auth/login/route';
import {
  checkRateLimit,
  incrementRateLimit,
  resetRateLimit,
} from '@/lib/auth/rate-limit';

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await initTestDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  // ========================================================================
  // Successful Login
  // ========================================================================

  it('should login successfully with valid email and password', async () => {
    const company = await createCompany({ name: 'Login Test Co' });
    const { user, plainPassword } = await createUser({
      email: 'valid@test.com',
      companyId: company.id,
    });

    const request = createMockRequest('/api/auth/login', {
      method: 'POST',
      body: { email: user.email, password: plainPassword },
    });

    const response = await POST(request);
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(200);
    expect(data.user).toBeDefined();
    expect(data.user.id).toBe(user.id);
    expect(data.user.email).toBe(user.email);
    expect(data.user.name).toBe(user.name);
    expect(data.user.permissions).toBeDefined();
    expect(Array.isArray(data.user.permissions)).toBe(true);
    expect(data.sessionId).toBeDefined();
    expect(data.expiresAt).toBeDefined();
    expect(data.hasCompany).toBe(true);
    // Password should NOT be in the response
    expect(data.user.password).toBeUndefined();
  });

  it('should login successfully by username (name field)', async () => {
    const { user, plainPassword } = await createUser({
      name: 'UniqueTestUser',
      email: 'byname@test.com',
    });

    const request = createMockRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'UniqueTestUser', password: plainPassword },
    });

    const response = await POST(request);
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(200);
    expect(data.user.id).toBe(user.id);
  });

  it('should return user role from company association', async () => {
    const prisma = getTestPrisma();
    const company = await createCompany();
    const role = await prisma.role.create({
      data: {
        name: 'SUPERVISOR',
        displayName: 'Supervisor',
        companyId: company.id,
      },
    });

    const { user, plainPassword } = await createUser({
      email: 'supervisor@test.com',
      companyId: company.id,
      roleId: role.id,
    });

    const request = createMockRequest('/api/auth/login', {
      method: 'POST',
      body: { email: user.email, password: plainPassword },
    });

    const response = await POST(request);
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(200);
    expect(data.user.role).toBe('SUPERVISOR');
  });

  it('should update lastLogin timestamp', async () => {
    const prisma = getTestPrisma();
    const { user, plainPassword } = await createUser({
      email: 'lastlogin@test.com',
    });

    // Verify no lastLogin initially
    const beforeLogin = await prisma.user.findUnique({ where: { id: user.id } });
    expect(beforeLogin?.lastLogin).toBeNull();

    const request = createMockRequest('/api/auth/login', {
      method: 'POST',
      body: { email: user.email, password: plainPassword },
    });

    await POST(request);

    const afterLogin = await prisma.user.findUnique({ where: { id: user.id } });
    expect(afterLogin?.lastLogin).not.toBeNull();
  });

  // ========================================================================
  // Invalid Credentials
  // ========================================================================

  it('should reject login with wrong password', async () => {
    const { user } = await createUser({ email: 'wrongpw@test.com' });

    const request = createMockRequest('/api/auth/login', {
      method: 'POST',
      body: { email: user.email, password: 'WrongPassword123!' },
    });

    const response = await POST(request);
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(401);
    expect(data.error).toBeDefined();
  });

  it('should reject login with non-existent user', async () => {
    const request = createMockRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'nobody@nonexistent.com', password: 'AnyPass123!' },
    });

    const response = await POST(request);
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(401);
    expect(data.error).toBeDefined();
  });

  // ========================================================================
  // Inactive User
  // ========================================================================

  it('should reject login for inactive user', async () => {
    const { user, plainPassword } = await createInactiveUser({
      email: 'inactive@test.com',
    });

    const request = createMockRequest('/api/auth/login', {
      method: 'POST',
      body: { email: user.email, password: plainPassword },
    });

    const response = await POST(request);
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(401);
    expect(data.error).toContain('inactivo');
  });

  // ========================================================================
  // User Without Password
  // ========================================================================

  it('should reject login for user without password set', async () => {
    const { user } = await createUserWithoutPassword({
      email: 'nopass@test.com',
    });

    const request = createMockRequest('/api/auth/login', {
      method: 'POST',
      body: { email: user.email, password: 'AnyPassword123!' },
    });

    const response = await POST(request);
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(401);
    expect(data.error).toBeDefined();
  });

  // ========================================================================
  // Validation
  // ========================================================================

  it('should reject login with missing email', async () => {
    const request = createMockRequest('/api/auth/login', {
      method: 'POST',
      body: { password: 'SomePassword123!' },
    });

    const response = await POST(request);
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it('should reject login with missing password', async () => {
    const request = createMockRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'test@test.com' },
    });

    const response = await POST(request);
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it('should reject login with empty body', async () => {
    const request = createMockRequest('/api/auth/login', {
      method: 'POST',
      body: {},
    });

    const response = await POST(request);
    const { status } = await parseJsonResponse(response);

    expect(status).toBe(400);
  });

  // ========================================================================
  // Login Attempt Auditing
  // ========================================================================

  it('should log failed login attempts', async () => {
    const prisma = getTestPrisma();

    const request = createMockRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'audit@test.com', password: 'wrong' },
    });

    await POST(request);

    const attempts = await prisma.loginAttempt.findMany({
      where: { email: 'audit@test.com' },
    });

    expect(attempts.length).toBeGreaterThanOrEqual(1);
    expect(attempts[0].success).toBe(false);
  });

  it('should log successful login attempts', async () => {
    const prisma = getTestPrisma();
    const { user, plainPassword } = await createUser({
      email: 'auditok@test.com',
    });

    const request = createMockRequest('/api/auth/login', {
      method: 'POST',
      body: { email: user.email, password: plainPassword },
    });

    await POST(request);

    const attempts = await prisma.loginAttempt.findMany({
      where: { email: user.email, success: true },
    });

    expect(attempts.length).toBe(1);
    expect(attempts[0].userId).toBe(user.id);
  });

  // ========================================================================
  // Session Creation
  // ========================================================================

  it('should create a session on successful login', async () => {
    const prisma = getTestPrisma();
    const { user, plainPassword } = await createUser({
      email: 'session@test.com',
    });

    const request = createMockRequest('/api/auth/login', {
      method: 'POST',
      body: { email: user.email, password: plainPassword },
    });

    const response = await POST(request);
    const { data } = await parseJsonResponse(response);

    const sessions = await prisma.session.findMany({
      where: { userId: user.id, isActive: true },
    });

    expect(sessions.length).toBe(1);
    expect(data.sessionId).toBe(sessions[0].id);
  });

  // ========================================================================
  // Rate Limiting
  // ========================================================================
  // Nota: checkRateLimit bypasses en NODE_ENV !== 'production' para login/loginByEmail.
  // Testeamos las funciones de rate limit directamente con action='api' (no bypassed)
  // para verificar la lógica de rate limiting funciona correctamente.

  describe('Rate Limiting (direct function tests)', () => {
    const testIdentifier = 'test-ip-rate-limit';

    beforeEach(async () => {
      await resetRateLimit(testIdentifier, 'api');
    });

    it('should allow requests within rate limit', async () => {
      const result = await checkRateLimit(testIdentifier, 'api');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
      expect(result.blocked).toBe(false);
    });

    it('should decrement remaining count after incrementing', async () => {
      const before = await checkRateLimit(testIdentifier, 'api');
      await incrementRateLimit(testIdentifier, 'api');
      const after = await checkRateLimit(testIdentifier, 'api');

      expect(after.remaining).toBeLessThan(before.remaining);
    });

    it('should block after exceeding max attempts', async () => {
      // api config: max 100 per 60s — use passwordReset for faster test (max 3)
      const id = 'rate-test-block';
      await resetRateLimit(id, 'passwordReset');

      // Increment beyond max (passwordReset: max 3)
      for (let i = 0; i < 4; i++) {
        await incrementRateLimit(id, 'passwordReset');
      }

      const result = await checkRateLimit(id, 'passwordReset');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);

      // Cleanup
      await resetRateLimit(id, 'passwordReset');
    });

    it('should reset rate limit after explicit reset', async () => {
      const id = 'rate-test-reset';
      await resetRateLimit(id, 'passwordReset');

      // Fill up the limit
      for (let i = 0; i < 4; i++) {
        await incrementRateLimit(id, 'passwordReset');
      }

      const blocked = await checkRateLimit(id, 'passwordReset');
      expect(blocked.allowed).toBe(false);

      // Reset
      await resetRateLimit(id, 'passwordReset');

      const afterReset = await checkRateLimit(id, 'passwordReset');
      expect(afterReset.allowed).toBe(true);
      expect(afterReset.remaining).toBeGreaterThan(0);
    });

    it('should persist rate limit entries in database', async () => {
      const prisma = getTestPrisma();
      const id = 'rate-test-persist';
      await resetRateLimit(id, 'passwordReset');

      await incrementRateLimit(id, 'passwordReset');

      // Esperar un momento para que la escritura async a BD complete
      await new Promise(resolve => setTimeout(resolve, 200));

      const entry = await prisma.rateLimitEntry.findUnique({
        where: { identifier_action: { identifier: id, action: 'passwordReset' } },
      });

      expect(entry).not.toBeNull();
      expect(entry!.count).toBeGreaterThanOrEqual(1);

      // Cleanup
      await resetRateLimit(id, 'passwordReset');
    });

    it('should track retryAfter when blocked', async () => {
      const id = 'rate-test-retry';
      await resetRateLimit(id, 'passwordReset');

      // passwordReset: max 3, blockDuration 3600s
      for (let i = 0; i < 4; i++) {
        await incrementRateLimit(id, 'passwordReset');
      }

      const result = await checkRateLimit(id, 'passwordReset');

      expect(result.allowed).toBe(false);
      expect(result.blocked).toBe(true);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.blockedUntil).toBeDefined();

      // Cleanup
      await resetRateLimit(id, 'passwordReset');
    });
  });
});
