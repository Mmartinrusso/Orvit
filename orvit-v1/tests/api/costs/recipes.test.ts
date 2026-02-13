/**
 * Integration Tests: Cost Recipes Endpoints
 *
 * Tests:
 * - GET /api/costs/recipes - List recipes with items
 * - POST /api/costs/recipes - Create recipe with ingredients
 * - Company-scoped queries
 * - Authentication required
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initTestDatabase, cleanDatabase, disconnectTestDatabase, getTestPrisma } from '../../setup/db-setup';
import { createUser } from '../../factories/user.factory';
import { createCompany } from '../../factories/company.factory';
import { createInputItem, createRecipe, createFullCostSetup } from '../../factories/cost.factory';
import { createMockRequest, parseJsonResponse, generateTestToken } from '../../utils/test-helpers';
import { mockCookieStore } from '../../setup/setup';

describe('Cost Recipes API', () => {
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
  // GET /api/costs/recipes
  // ========================================================================

  it('should return recipes for the authenticated company', async () => {
    const company = await createCompany();
    const { user } = await createUser({ companyId: company.id });
    const { recipe } = await createFullCostSetup(company.id);

    await setupAuth(user.id, company.id);

    const { GET } = await import('@/app/api/costs/recipes/route');
    const request = createMockRequest('/api/costs/recipes');
    const response = await GET(request);
    const { status, data } = await parseJsonResponse(response);

    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
  });

  it('should include recipe items with input details', async () => {
    const company = await createCompany();
    const { user } = await createUser({ companyId: company.id });

    const input1 = await createInputItem({ companyId: company.id, name: 'Flour' });
    const input2 = await createInputItem({ companyId: company.id, name: 'Water' });

    await createRecipe({
      name: 'Bread',
      companyId: company.id,
      inputItems: [
        { inputItemId: input1.id, quantity: 1 },
        { inputItemId: input2.id, quantity: 0.5 },
      ],
    });

    await setupAuth(user.id, company.id);

    const { GET } = await import('@/app/api/costs/recipes/route');
    const request = createMockRequest('/api/costs/recipes');
    const response = await GET(request);
    const { data } = await parseJsonResponse(response);

    const recipe = data[0];
    expect(recipe.items).toBeDefined();
    expect(recipe.items.length).toBe(2);
    expect(recipe.items[0].input).toBeDefined();
    expect(recipe.items[0].input.name).toBeDefined();
  });

  it('should only return recipes for the users company', async () => {
    const company1 = await createCompany({ name: 'Company 1' });
    const company2 = await createCompany({ name: 'Company 2' });
    const { user: user1 } = await createUser({ companyId: company1.id });

    await createRecipe({ name: 'Recipe C1', companyId: company1.id });
    await createRecipe({ name: 'Recipe C2', companyId: company2.id });

    await setupAuth(user1.id, company1.id);

    const { GET } = await import('@/app/api/costs/recipes/route');
    const request = createMockRequest('/api/costs/recipes');
    const response = await GET(request);
    const { data } = await parseJsonResponse(response);

    // Should only include recipes from company1
    expect(data.length).toBe(1);
    expect(data[0].name).toBe('Recipe C1');
  });

  // ========================================================================
  // Authentication
  // ========================================================================

  it('should reject unauthenticated request', async () => {
    mockCookieStore.clear();

    const { GET } = await import('@/app/api/costs/recipes/route');
    const request = createMockRequest('/api/costs/recipes');
    const response = await GET(request);
    const { status } = await parseJsonResponse(response);

    expect(status).toBe(401);
  });
});
