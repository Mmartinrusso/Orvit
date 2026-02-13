/**
 * Integration Tests: Cost Recalculation Endpoint
 *
 * Tests:
 * - POST /api/costs/recalculate - Trigger recalculation
 * - Month parameter validation
 * - Company filter
 * - Missing month parameter
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { initTestDatabase, cleanDatabase, disconnectTestDatabase } from '../../setup/db-setup';
import { createUser } from '../../factories/user.factory';
import { createCompany } from '../../factories/company.factory';
import { createMockRequest, parseJsonResponse, generateTestToken } from '../../utils/test-helpers';
import { mockCookieStore } from '../../setup/setup';

// Mock the calculator to avoid full recalculation in tests
vi.mock('@/lib/costs/calculator', () => ({
  recalculateMonthCosts: vi.fn().mockResolvedValue(undefined),
  calculateRecipeCost: vi.fn().mockResolvedValue({ total: 0 }),
}));

describe('Cost Recalculate API', () => {
  beforeAll(async () => {
    await initTestDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
    mockCookieStore.clear();
    vi.clearAllMocks();
  });

  async function setupAuth(userId: number, companyId?: number) {
    const token = await generateTestToken({ userId, companyId });
    mockCookieStore.set('token', { value: token });
  }

  // ========================================================================
  // Successful Recalculation
  // ========================================================================

  it('should trigger recalculation with valid month', async () => {
    const company = await createCompany();
    const { user } = await createUser({ companyId: company.id });
    await setupAuth(user.id, company.id);

    const { POST } = await import('@/app/api/costs/recalculate/route');
    const request = createMockRequest('/api/costs/recalculate?month=2024-01', {
      method: 'POST',
      searchParams: { month: '2024-01' },
    });

    const response = await POST(request);
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(200);
    expect(data.message).toContain('completado');
    expect(data.month).toBe('2024-01');
    expect(data.timestamp).toBeDefined();
  });

  it('should pass companyId to recalculation when provided', async () => {
    const company = await createCompany();
    const { user } = await createUser({ companyId: company.id });
    await setupAuth(user.id, company.id);

    const { recalculateMonthCosts } = await import('@/lib/costs/calculator');
    const { POST } = await import('@/app/api/costs/recalculate/route');

    const request = createMockRequest('/api/costs/recalculate?month=2024-06&companyId=5', {
      method: 'POST',
      searchParams: { month: '2024-06', companyId: '5' },
    });

    const response = await POST(request);
    const { status } = await parseJsonResponse(response);

    expect(status).toBe(200);
    expect(recalculateMonthCosts).toHaveBeenCalledWith('2024-06', 5);
  });

  // ========================================================================
  // Validation
  // ========================================================================

  it('should reject request without month parameter', async () => {
    const company = await createCompany();
    const { user } = await createUser({ companyId: company.id });
    await setupAuth(user.id, company.id);

    const { POST } = await import('@/app/api/costs/recalculate/route');
    const request = createMockRequest('/api/costs/recalculate', {
      method: 'POST',
    });

    const response = await POST(request);
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it('should reject request with invalid month format', async () => {
    const company = await createCompany();
    const { user } = await createUser({ companyId: company.id });
    await setupAuth(user.id, company.id);

    const { POST } = await import('@/app/api/costs/recalculate/route');
    const request = createMockRequest('/api/costs/recalculate?month=invalid', {
      method: 'POST',
      searchParams: { month: 'invalid' },
    });

    const response = await POST(request);
    const { status } = await parseJsonResponse(response);

    expect(status).toBe(400);
  });

  // ========================================================================
  // Error Handling
  // ========================================================================

  it('should handle recalculation errors gracefully', async () => {
    const company = await createCompany();
    const { user } = await createUser({ companyId: company.id });
    await setupAuth(user.id, company.id);

    const { recalculateMonthCosts } = await import('@/lib/costs/calculator');
    (recalculateMonthCosts as any).mockRejectedValueOnce(new Error('DB connection failed'));

    const { POST } = await import('@/app/api/costs/recalculate/route');
    const request = createMockRequest('/api/costs/recalculate?month=2024-01', {
      method: 'POST',
      searchParams: { month: '2024-01' },
    });

    const response = await POST(request);
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(500);
    expect(data.error).toBeDefined();
  });
});
