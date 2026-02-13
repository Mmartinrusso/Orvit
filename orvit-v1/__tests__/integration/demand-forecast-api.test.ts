/**
 * Demand Forecast API Integration Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';

describe('Demand Forecast API Integration', () => {
  let authToken: string;

  beforeAll(async () => {
    // TODO: Get auth token
    authToken = 'mock-token';
  });

  it('should generate forecast for single product', async () => {
    const response = await fetch('http://localhost:3000/api/ai/demand-forecast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `token=${authToken}`,
      },
      body: JSON.stringify({
        productId: 1,
        forecastDays: 30,
      }),
    });

    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.forecast).toBeDefined();
    expect(data.forecast.forecasts).toHaveLength(30);
  });

  it('should generate auto-reorder suggestions', async () => {
    const response = await fetch('http://localhost:3000/api/ai/demand-forecast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `token=${authToken}`,
      },
      body: JSON.stringify({
        autoReorder: true,
      }),
    });

    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.type).toBe('auto_reorder');
    expect(Array.isArray(data.suggestions)).toBe(true);
  });

  it('should handle invalid product ID', async () => {
    const response = await fetch('http://localhost:3000/api/ai/demand-forecast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `token=${authToken}`,
      },
      body: JSON.stringify({
        productId: 999999,
        forecastDays: 30,
      }),
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
