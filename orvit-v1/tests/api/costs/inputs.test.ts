/**
 * Integration Tests: Cost Input Items Endpoints
 *
 * Tests:
 * - GET /api/costs/inputs - List input items
 * - POST /api/costs/inputs - Create input item
 * - Authentication required
 * - Validation of input data
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initTestDatabase, cleanDatabase, disconnectTestDatabase, getTestPrisma } from '../../setup/db-setup';
import { createUser } from '../../factories/user.factory';
import { createCompany } from '../../factories/company.factory';
import { createInputItem } from '../../factories/cost.factory';
import { createMockRequest, parseJsonResponse, generateTestToken } from '../../utils/test-helpers';
import { mockCookieStore } from '../../setup/setup';

describe('Cost Inputs API', () => {
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

  async function setupAuth(userId: number, companyId?: number) {
    const token = await generateTestToken({ userId, companyId });
    mockCookieStore.set('token', { value: token });
  }

  // ========================================================================
  // GET /api/costs/inputs
  // ========================================================================

  it('should return all input items when authenticated', async () => {
    const company = await createCompany();
    const { user } = await createUser({ companyId: company.id });
    await createInputItem({ companyId: company.id, name: 'Harina' });
    await createInputItem({ companyId: company.id, name: 'Azúcar' });

    await setupAuth(user.id, company.id);

    const { GET } = await import('@/app/api/costs/inputs/route');
    const request = createMockRequest('/api/costs/inputs');
    const response = await GET(request);
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
  });

  it('should return input items sorted by name', async () => {
    const company = await createCompany();
    const { user } = await createUser({ companyId: company.id });
    await createInputItem({ companyId: company.id, name: 'Zeolite' });
    await createInputItem({ companyId: company.id, name: 'Aluminium' });

    await setupAuth(user.id, company.id);

    const { GET } = await import('@/app/api/costs/inputs/route');
    const request = createMockRequest('/api/costs/inputs');
    const response = await GET(request);
    const { data } = await parseJsonResponse(response);

    expect(data[0].name).toBe('Aluminium');
    expect(data[1].name).toBe('Zeolite');
  });

  // ========================================================================
  // POST /api/costs/inputs
  // ========================================================================

  it('should create a new input item', async () => {
    const company = await createCompany();
    const { user } = await createUser({ companyId: company.id });

    await setupAuth(user.id, company.id);

    const { POST } = await import('@/app/api/costs/inputs/route');
    const request = createMockRequest('/api/costs/inputs', {
      method: 'POST',
      body: {
        name: 'New Input',
        unitLabel: 'kg',
        currentPrice: 250.50,
        supplier: 'Test Supplier',
        companyId: company.id,
      },
    });

    const response = await POST(request);
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(201);
    expect(data.name).toBe('New Input');
    expect(data.unitLabel).toBe('kg');

    // Verify in database
    const dbItem = await prisma.inputItem.findUnique({ where: { id: data.id } });
    expect(dbItem).not.toBeNull();
    expect(dbItem?.name).toBe('New Input');
  });

  // ========================================================================
  // Authentication
  // ========================================================================

  it('should reject unauthenticated GET request', async () => {
    mockCookieStore.clear();

    const { GET } = await import('@/app/api/costs/inputs/route');
    const request = createMockRequest('/api/costs/inputs');
    const response = await GET(request);
    const { status } = await parseJsonResponse(response);

    expect(status).toBe(401);
  });

  it('should reject unauthenticated POST request', async () => {
    mockCookieStore.clear();

    const { POST } = await import('@/app/api/costs/inputs/route');
    const request = createMockRequest('/api/costs/inputs', {
      method: 'POST',
      body: { name: 'Test', unitLabel: 'kg', currentPrice: 100 },
    });

    const response = await POST(request);
    const { status } = await parseJsonResponse(response);

    expect(status).toBe(401);
  });
});
