/**
 * Integration tests for withGuards middleware
 *
 * Tests:
 * - Rejects requests without JWT token (401)
 * - Rejects requests with invalid/expired token (401)
 * - Allows authenticated requests with no permission requirements
 * - Rejects requests when user lacks required permissions (403)
 * - Allows requests when user has required permissions
 * - Supports 'any' permission mode (OR logic)
 * - Supports 'all' permission mode (AND logic)
 * - Logs security events via loggers.auth
 * - Passes user context to handler
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { mockCookieStore } from '../../setup/setup';
import {
  generateTestToken,
  generateExpiredToken,
  generateInvalidToken,
  createMockRequest,
  parseJsonResponse,
} from '../../utils/test-helpers';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock prisma
const mockUserFindUnique = vi.fn();
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: (...args: any[]) => mockUserFindUnique(...args),
    },
    permission: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    rolePermission: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    userPermission: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

// Mock getUserPermissions
const mockGetUserPermissions = vi.fn();
vi.mock('@/lib/permissions-helpers', () => ({
  getUserPermissions: (...args: any[]) => mockGetUserPermissions(...args),
}));

// Import after mocks
import { withGuards } from '@/lib/middleware/withGuards';

// ─── Test Data ───────────────────────────────────────────────────────────────

const TEST_USER = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  role: 'USER',
  companies: [{ companyId: 10 }],
};

const ADMIN_USER = {
  id: 2,
  name: 'Admin User',
  email: 'admin@example.com',
  role: 'ADMIN',
  companies: [{ companyId: 10 }],
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('withGuards middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieStore.clear();
    mockUserFindUnique.mockResolvedValue(TEST_USER);
    mockGetUserPermissions.mockResolvedValue([]);
  });

  afterEach(() => {
    mockCookieStore.clear();
  });

  // ── Authentication Tests ──────────────────────────────────────────────────

  describe('authentication', () => {
    it('should return 401 when no token is present', async () => {
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const guarded = withGuards(handler);

      const request = createMockRequest('/api/test');
      const response = await guarded(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('No autorizado');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', async () => {
      const token = await generateInvalidToken({ userId: 1 });
      mockCookieStore.set('token', { value: token });

      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const guarded = withGuards(handler);

      const request = createMockRequest('/api/test');
      const response = await guarded(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Token');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should return 401 when token is expired', async () => {
      const token = await generateExpiredToken({ userId: 1 });
      mockCookieStore.set('token', { value: token });

      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const guarded = withGuards(handler);

      const request = createMockRequest('/api/test');
      const response = await guarded(request);

      expect(response.status).toBe(401);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should return 401 when user is not found in DB', async () => {
      const token = await generateTestToken({ userId: 999, companyId: 10 });
      mockCookieStore.set('token', { value: token });
      mockUserFindUnique.mockResolvedValue(null);

      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const guarded = withGuards(handler);

      const request = createMockRequest('/api/test');
      const response = await guarded(request);

      expect(response.status).toBe(401);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should pass authenticated request to handler when token is valid', async () => {
      const token = await generateTestToken({ userId: 1, companyId: 10 });
      mockCookieStore.set('token', { value: token });

      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const guarded = withGuards(handler);

      const request = createMockRequest('/api/test');
      const response = await guarded(request);

      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);

      // Verify context passed to handler
      const [req, ctx] = handler.mock.calls[0];
      expect(ctx.user.userId).toBe(1);
      expect(ctx.user.companyId).toBe(10);
      expect(ctx.user.role).toBe('USER');
      expect(ctx.user.email).toBe('test@example.com');
    });

    it('should support accessToken cookie', async () => {
      const token = await generateTestToken({ userId: 1, companyId: 10 });
      mockCookieStore.set('accessToken', { value: token });

      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const guarded = withGuards(handler);

      const request = createMockRequest('/api/test');
      const response = await guarded(request);

      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ── Permission Tests ──────────────────────────────────────────────────────

  describe('authorization (permissions)', () => {
    beforeEach(async () => {
      const token = await generateTestToken({ userId: 1, companyId: 10 });
      mockCookieStore.set('token', { value: token });
    });

    it('should allow access when no permissions are required', async () => {
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const guarded = withGuards(handler);

      const request = createMockRequest('/api/test');
      const response = await guarded(request);

      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);
      // getUserPermissions should NOT be called when no permissions required
      expect(mockGetUserPermissions).not.toHaveBeenCalled();
    });

    it('should return 403 when user lacks required permission', async () => {
      mockGetUserPermissions.mockResolvedValue(['machines.view', 'tasks.view']);

      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const guarded = withGuards(handler, {
        requiredPermissions: ['costs.edit'],
      });

      const request = createMockRequest('/api/test');
      const response = await guarded(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('permisos');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should allow access when user has the required permission', async () => {
      mockGetUserPermissions.mockResolvedValue(['costs.view', 'costs.edit']);

      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const guarded = withGuards(handler, {
        requiredPermissions: ['costs.view'],
      });

      const request = createMockRequest('/api/test');
      const response = await guarded(request);

      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should support "any" permission mode (OR logic) - pass with one match', async () => {
      mockGetUserPermissions.mockResolvedValue(['costs.view']);

      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const guarded = withGuards(handler, {
        requiredPermissions: ['costs.view', 'costs.admin'],
        permissionMode: 'any',
      });

      const request = createMockRequest('/api/test');
      const response = await guarded(request);

      expect(response.status).toBe(200);
    });

    it('should support "any" permission mode (OR logic) - fail with no match', async () => {
      mockGetUserPermissions.mockResolvedValue(['machines.view']);

      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const guarded = withGuards(handler, {
        requiredPermissions: ['costs.view', 'costs.admin'],
        permissionMode: 'any',
      });

      const request = createMockRequest('/api/test');
      const response = await guarded(request);

      expect(response.status).toBe(403);
    });

    it('should support "all" permission mode (AND logic) - pass with all', async () => {
      mockGetUserPermissions.mockResolvedValue(['costs.view', 'costs.edit', 'costs.admin']);

      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const guarded = withGuards(handler, {
        requiredPermissions: ['costs.view', 'costs.edit'],
        permissionMode: 'all',
      });

      const request = createMockRequest('/api/test');
      const response = await guarded(request);

      expect(response.status).toBe(200);
    });

    it('should support "all" permission mode (AND logic) - fail with partial', async () => {
      mockGetUserPermissions.mockResolvedValue(['costs.view']);

      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const guarded = withGuards(handler, {
        requiredPermissions: ['costs.view', 'costs.edit'],
        permissionMode: 'all',
      });

      const request = createMockRequest('/api/test');
      const response = await guarded(request);

      expect(response.status).toBe(403);
    });

    it('should pass permissions array in user context', async () => {
      mockGetUserPermissions.mockResolvedValue(['costs.view', 'costs.edit']);

      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const guarded = withGuards(handler, {
        requiredPermissions: ['costs.view'],
      });

      const request = createMockRequest('/api/test');
      await guarded(request);

      const [, ctx] = handler.mock.calls[0];
      expect(ctx.user.permissions).toEqual(['costs.view', 'costs.edit']);
    });
  });

  // ── Error Handling Tests ──────────────────────────────────────────────────

  describe('error handling', () => {
    it('should catch unhandled errors in handler and return 500', async () => {
      const token = await generateTestToken({ userId: 1, companyId: 10 });
      mockCookieStore.set('token', { value: token });

      const handler = vi.fn().mockRejectedValue(new Error('Unexpected DB error'));
      const guarded = withGuards(handler);

      const request = createMockRequest('/api/test');
      const response = await guarded(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('Error interno');
    });
  });
});
