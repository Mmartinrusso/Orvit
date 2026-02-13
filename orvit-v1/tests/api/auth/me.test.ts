/**
 * Integration Tests: GET /api/auth/me
 *
 * Tests:
 * - Returns user data with valid token
 * - Returns permissions list
 * - Rejects invalid token
 * - Rejects expired token
 * - Handles deleted/inactive user
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initTestDatabase, cleanDatabase, disconnectTestDatabase } from '../../setup/db-setup';
import { createUser, createInactiveUser } from '../../factories/user.factory';
import { createCompany } from '../../factories/company.factory';
import {
  createMockRequest,
  parseJsonResponse,
  generateExpiredToken,
  generateInvalidToken,
  generateTestToken,
} from '../../utils/test-helpers';
import { mockCookieStore } from '../../setup/setup';
import { GET } from '@/app/api/auth/me/route';

describe('GET /api/auth/me', () => {
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
  // Valid Token
  // ========================================================================

  it('should return user data with valid token', async () => {
    const company = await createCompany();
    const { user } = await createUser({
      email: 'me@test.com',
      companyId: company.id,
    });

    const token = await generateTestToken({
      userId: user.id,
      email: user.email,
      role: 'USER',
      companyId: company.id,
    });

    // Set cookie in mockCookieStore (route reads from cookies() mock, not request)
    mockCookieStore.set('token', { value: token });

    const request = createMockRequest('/api/auth/me');
    const response = await GET(request);
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(200);
    expect(data.id).toBe(user.id);
    expect(data.email).toBe(user.email);
    expect(data.name).toBe(user.name);
    expect(data.permissions).toBeDefined();
    expect(Array.isArray(data.permissions)).toBe(true);
    // Should not include sensitive data
    expect(data.password).toBeUndefined();
  });

  it('should return permissions for admin user', async () => {
    const company = await createCompany();
    const { user } = await createUser({
      email: 'admin@test.com',
      role: 'ADMIN',
      companyId: company.id,
    });

    const token = await generateTestToken({
      userId: user.id,
      email: user.email,
      role: 'ADMIN',
      companyId: company.id,
    });

    mockCookieStore.set('token', { value: token });

    const request = createMockRequest('/api/auth/me');
    const response = await GET(request);
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(200);
    expect(data.role).toBe('ADMIN');
    expect(data.permissions.length).toBeGreaterThan(0);
  });

  // ========================================================================
  // Invalid/Expired Token
  // ========================================================================

  it('should reject request with no token', async () => {
    const request = createMockRequest('/api/auth/me');

    const response = await GET(request);
    const { status } = await parseJsonResponse(response);

    expect(status).toBe(401);
  });

  it('should reject request with expired token', async () => {
    const { user } = await createUser({ email: 'expired@test.com' });
    const expiredToken = await generateExpiredToken({
      userId: user.id,
      email: user.email,
    });

    mockCookieStore.set('token', { value: expiredToken });

    const request = createMockRequest('/api/auth/me');
    const response = await GET(request);
    const { status } = await parseJsonResponse(response);

    expect(status).toBe(401);
  });

  it('should reject request with invalid token (wrong secret)', async () => {
    const invalidToken = await generateInvalidToken({
      userId: 999,
      email: 'fake@test.com',
    });

    mockCookieStore.set('token', { value: invalidToken });

    const request = createMockRequest('/api/auth/me');
    const response = await GET(request);
    const { status } = await parseJsonResponse(response);

    expect(status).toBe(401);
  });

  it('should reject request with malformed token', async () => {
    mockCookieStore.set('token', { value: 'not-a-valid-jwt-token' });

    const request = createMockRequest('/api/auth/me');
    const response = await GET(request);
    const { status } = await parseJsonResponse(response);

    expect(status).toBe(401);
  });

  // ========================================================================
  // User State
  // ========================================================================

  it('should handle deleted user (valid token but user no longer exists)', async () => {
    // Generate a token for a userId that doesn't exist
    const token = await generateTestToken({
      userId: 99999,
      email: 'deleted@test.com',
    });

    mockCookieStore.set('token', { value: token });

    const request = createMockRequest('/api/auth/me');
    const response = await GET(request);
    const { status } = await parseJsonResponse(response);

    // Should return 401 or 404 since user doesn't exist
    // The /api/auth/me route returns 404 for non-existent users
    expect([401, 404]).toContain(status);
  });

  it('should handle accessToken cookie (new auth system)', async () => {
    const company = await createCompany();
    const { user } = await createUser({
      email: 'newauth@test.com',
      companyId: company.id,
    });

    const token = await generateTestToken({
      userId: user.id,
      email: user.email,
      companyId: company.id,
    });

    // Use accessToken cookie (new system) instead of token (legacy)
    mockCookieStore.set('accessToken', { value: token });

    const request = createMockRequest('/api/auth/me');
    const response = await GET(request);
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(200);
    expect(data.id).toBe(user.id);
  });
});
