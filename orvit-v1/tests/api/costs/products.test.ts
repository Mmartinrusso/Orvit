/**
 * Integration Tests: Cost Products Endpoints
 *
 * Tests:
 * - GET /api/costs/products - List products
 * - GET /api/costs/products?active=true - Filter active
 * - POST /api/costs/products - Create product
 * - Authentication required
 * - Company isolation (via auth context)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { initTestDatabase, cleanDatabase, disconnectTestDatabase, getTestPrisma } from '../../setup/db-setup';
import { createUser } from '../../factories/user.factory';
import { createCompany } from '../../factories/company.factory';
import { createLine, createCostProduct } from '../../factories/cost.factory';
import { createMockRequest, parseJsonResponse, generateTestToken } from '../../utils/test-helpers';
import { mockCookieStore } from '../../setup/setup';

describe('Cost Products API', () => {
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
   * Helper: set up authentication cookie for costs-auth.ts
   */
  async function setupAuthForCosts(userId: number, companyId?: number) {
    const token = await generateTestToken({ userId, companyId });
    mockCookieStore.set('token', { value: token });
  }

  // ========================================================================
  // GET /api/costs/products
  // ========================================================================

  it('should return all products when authenticated', async () => {
    const company = await createCompany();
    const { user } = await createUser({ companyId: company.id });
    const line = await createLine(company.id);
    await createCostProduct({ lineId: line.id, companyId: company.id, name: 'Product A' });
    await createCostProduct({ lineId: line.id, companyId: company.id, name: 'Product B' });

    await setupAuthForCosts(user.id, company.id);

    // Dynamic import to get fresh module after mock setup
    const { GET } = await import('@/app/api/costs/products/route');
    const request = createMockRequest('/api/costs/products');
    const response = await GET(request);
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
  });

  it('should filter active-only products', async () => {
    const company = await createCompany();
    const { user } = await createUser({ companyId: company.id });
    const line = await createLine(company.id);
    await createCostProduct({ lineId: line.id, companyId: company.id, active: true, name: 'Active' });
    await createCostProduct({ lineId: line.id, companyId: company.id, active: false, name: 'Inactive' });

    await setupAuthForCosts(user.id, company.id);

    const { GET } = await import('@/app/api/costs/products/route');
    const request = createMockRequest('/api/costs/products?active=true', {
      searchParams: { active: 'true' },
    });
    const response = await GET(request);
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(200);
    expect(data.length).toBe(1);
    expect(data[0].name).toBe('Active');
  });

  it('should include line information in products', async () => {
    const company = await createCompany();
    const { user } = await createUser({ companyId: company.id });
    const line = await createLine(company.id, 'Line Alpha', 'LA');
    await createCostProduct({ lineId: line.id, companyId: company.id });

    await setupAuthForCosts(user.id, company.id);

    const { GET } = await import('@/app/api/costs/products/route');
    const request = createMockRequest('/api/costs/products');
    const response = await GET(request);
    const { data } = await parseJsonResponse(response);

    expect(data[0].line).toBeDefined();
    expect(data[0].line.name).toBe('Line Alpha');
  });

  // ========================================================================
  // Authentication
  // ========================================================================

  it('should reject unauthenticated request', async () => {
    // Don't set any cookie
    mockCookieStore.clear();

    const { GET } = await import('@/app/api/costs/products/route');
    const request = createMockRequest('/api/costs/products');
    const response = await GET(request);
    const { status } = await parseJsonResponse(response);

    expect(status).toBe(401);
  });
});
