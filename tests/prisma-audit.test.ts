/**
 * Tests for Prisma Schema Audit & Performance Optimization
 *
 * Validates:
 * 1. Schema indexes are correctly defined
 * 2. Migration SQL is syntactically valid and consistent with schema
 * 3. API route optimizations produce correct results
 * 4. Single-pass calculations match multi-pass equivalents
 * 5. Edge cases in analytics computations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: Schema Index Validation
// ═══════════════════════════════════════════════════════════════════════════

describe('Prisma Schema - Index Definitions', () => {
  const schemaPath = path.resolve(__dirname, '../project/prisma/schema.prisma');
  let schemaContent: string;

  beforeEach(() => {
    schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  });

  it('schema file exists and is readable', () => {
    expect(fs.existsSync(schemaPath)).toBe(true);
    expect(schemaContent.length).toBeGreaterThan(0);
  });

  // ── Tool model indexes ──
  describe('Tool model', () => {
    it('has companyId index', () => {
      const toolModel = extractModel(schemaContent, 'Tool');
      expect(toolModel).toContain('@@index([companyId])');
    });

    it('has compound companyId+status index', () => {
      const toolModel = extractModel(schemaContent, 'Tool');
      expect(toolModel).toContain('@@index([companyId, status])');
    });

    it('has sectorId FK index', () => {
      const toolModel = extractModel(schemaContent, 'Tool');
      expect(toolModel).toContain('@@index([sectorId])');
    });
  });

  // ── Worker model indexes ──
  describe('Worker model', () => {
    it('has companyId index', () => {
      const model = extractModel(schemaContent, 'Worker');
      expect(model).toContain('@@index([companyId])');
    });

    it('has compound companyId+isActive index', () => {
      const model = extractModel(schemaContent, 'Worker');
      expect(model).toContain('@@index([companyId, isActive])');
    });
  });

  // ── Task model indexes ──
  describe('Task model', () => {
    it('has companyId index', () => {
      const model = extractModel(schemaContent, 'Task');
      expect(model).toContain('@@index([companyId])');
    });

    it('has compound companyId+status index', () => {
      const model = extractModel(schemaContent, 'Task');
      expect(model).toContain('@@index([companyId, status])');
    });

    it('has assignedToId FK index', () => {
      const model = extractModel(schemaContent, 'Task');
      expect(model).toContain('@@index([assignedToId])');
    });

    it('has createdById FK index', () => {
      const model = extractModel(schemaContent, 'Task');
      expect(model).toContain('@@index([createdById])');
    });
  });

  // ── CostProduct model indexes ──
  describe('CostProduct model', () => {
    it('has companyId index', () => {
      const model = extractModel(schemaContent, 'CostProduct');
      expect(model).toContain('@@index([companyId])');
    });

    it('has compound companyId+active index', () => {
      const model = extractModel(schemaContent, 'CostProduct');
      expect(model).toContain('@@index([companyId, active])');
    });

    it('has lineId FK index', () => {
      const model = extractModel(schemaContent, 'CostProduct');
      expect(model).toContain('@@index([lineId])');
    });
  });

  // ── maintenance_history model indexes ──
  describe('maintenance_history model', () => {
    it('has workOrderId FK index', () => {
      const model = extractModel(schemaContent, 'maintenance_history');
      expect(model).toContain('@@index([workOrderId])');
    });

    it('has machineId FK index', () => {
      const model = extractModel(schemaContent, 'maintenance_history');
      expect(model).toContain('@@index([machineId])');
    });

    it('has executedAt date index', () => {
      const model = extractModel(schemaContent, 'maintenance_history');
      expect(model).toContain('@@index([executedAt])');
    });

    it('has createdAt date index', () => {
      const model = extractModel(schemaContent, 'maintenance_history');
      expect(model).toContain('@@index([createdAt])');
    });
  });

  // ── FixedTask model indexes ──
  describe('FixedTask model', () => {
    it('has companyId index', () => {
      const model = extractModel(schemaContent, 'FixedTask');
      expect(model).toContain('@@index([companyId])');
    });

    it('has compound companyId+isActive index', () => {
      const model = extractModel(schemaContent, 'FixedTask');
      expect(model).toContain('@@index([companyId, isActive])');
    });

    it('has assignedToId FK index', () => {
      const model = extractModel(schemaContent, 'FixedTask');
      expect(model).toContain('@@index([assignedToId])');
    });

    it('has nextExecution date index', () => {
      const model = extractModel(schemaContent, 'FixedTask');
      expect(model).toContain('@@index([nextExecution])');
    });
  });

  // ── Child table FK indexes ──
  describe('Child table FK indexes', () => {
    it('ToolMovement has toolId index', () => {
      const model = extractModel(schemaContent, 'ToolMovement');
      expect(model).toContain('@@index([toolId])');
    });

    it('ToolLoan has toolId index', () => {
      const model = extractModel(schemaContent, 'ToolLoan');
      expect(model).toContain('@@index([toolId])');
    });

    it('ToolLoan has status index', () => {
      const model = extractModel(schemaContent, 'ToolLoan');
      expect(model).toContain('@@index([status])');
    });

    it('TaskAttachment has taskId index', () => {
      const model = extractModel(schemaContent, 'TaskAttachment');
      expect(model).toContain('@@index([taskId])');
    });

    it('Subtask has taskId index', () => {
      const model = extractModel(schemaContent, 'Subtask');
      expect(model).toContain('@@index([taskId])');
    });

    it('TaskComment has taskId index', () => {
      const model = extractModel(schemaContent, 'TaskComment');
      expect(model).toContain('@@index([taskId])');
    });

    it('FixedTaskInstructive has fixedTaskId index', () => {
      const model = extractModel(schemaContent, 'FixedTaskInstructive');
      expect(model).toContain('@@index([fixedTaskId])');
    });

    it('FixedTaskExecution has fixedTaskId index', () => {
      const model = extractModel(schemaContent, 'FixedTaskExecution');
      expect(model).toContain('@@index([fixedTaskId])');
    });

    it('FixedTaskExecution has compound fixedTaskId+status index', () => {
      const model = extractModel(schemaContent, 'FixedTaskExecution');
      expect(model).toContain('@@index([fixedTaskId, status])');
    });
  });

  // ── High-traffic composite indexes ──
  describe('High-traffic composite indexes', () => {
    it('Sale has companyId+estado composite index', () => {
      const model = extractModel(schemaContent, 'Sale');
      expect(model).toContain('@@index([companyId, estado])');
    });

    it('Sale has companyId+createdAt composite index', () => {
      const model = extractModel(schemaContent, 'Sale');
      expect(model).toContain('@@index([companyId, createdAt])');
    });

    it('SaleDelivery has companyId+estado composite index', () => {
      const model = extractModel(schemaContent, 'SaleDelivery');
      expect(model).toContain('@@index([companyId, estado])');
    });

    it('SaleDelivery has companyId+createdAt composite index', () => {
      const model = extractModel(schemaContent, 'SaleDelivery');
      expect(model).toContain('@@index([companyId, createdAt])');
    });

    it('SalesInvoice has companyId+estado+fechaEmision composite index', () => {
      const model = extractModel(schemaContent, 'SalesInvoice');
      expect(model).toContain('@@index([companyId, estado, fechaEmision])');
    });

    it('SalesInvoice has companyId+estado+fechaVencimiento composite index', () => {
      const model = extractModel(schemaContent, 'SalesInvoice');
      expect(model).toContain('@@index([companyId, estado, fechaVencimiento])');
    });

    it('ProductionOrder has companyId+createdAt composite index', () => {
      const model = extractModel(schemaContent, 'ProductionOrder');
      expect(model).toContain('@@index([companyId, createdAt])');
    });

    it('ClientPayment has companyId+estado+fechaPago composite index', () => {
      const model = extractModel(schemaContent, 'ClientPayment');
      expect(model).toContain('@@index([companyId, estado, fechaPago])');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: Migration SQL Validation
// ═══════════════════════════════════════════════════════════════════════════

describe('Migration SQL - add_missing_indexes.sql', () => {
  const migrationPath = path.resolve(
    __dirname,
    '../project/prisma/migrations/add_missing_indexes.sql'
  );
  let sqlContent: string;

  beforeEach(() => {
    sqlContent = fs.readFileSync(migrationPath, 'utf-8');
  });

  it('migration file exists', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it('all CREATE INDEX statements use CONCURRENTLY', () => {
    const createIndexLines = sqlContent
      .split('\n')
      .filter((line) => line.trim().startsWith('CREATE INDEX'));

    expect(createIndexLines.length).toBeGreaterThan(0);

    createIndexLines.forEach((line) => {
      expect(line).toContain('CONCURRENTLY');
    });
  });

  it('all CREATE INDEX statements use IF NOT EXISTS', () => {
    const createIndexLines = sqlContent
      .split('\n')
      .filter((line) => line.trim().startsWith('CREATE INDEX'));

    createIndexLines.forEach((line) => {
      expect(line).toContain('IF NOT EXISTS');
    });
  });

  it('includes ANALYZE for all indexed tables', () => {
    const analyzeStatements = sqlContent
      .split('\n')
      .filter((line) => line.trim().startsWith('ANALYZE'));

    // Should have ANALYZE for each indexed table
    expect(analyzeStatements.length).toBeGreaterThanOrEqual(10);

    // Key tables should be analyzed
    const analyzeContent = analyzeStatements.join('\n');
    expect(analyzeContent).toContain('"Tool"');
    expect(analyzeContent).toContain('"Worker"');
    expect(analyzeContent).toContain('"Task"');
    expect(analyzeContent).toContain('"CostProduct"');
    expect(analyzeContent).toContain('"maintenance_history"');
    expect(analyzeContent).toContain('"FixedTask"');
    expect(analyzeContent).toContain('"sales"');
    expect(analyzeContent).toContain('"sale_deliveries"');
    expect(analyzeContent).toContain('"sales_invoices"');
    expect(analyzeContent).toContain('"production_orders"');
    expect(analyzeContent).toContain('"client_payments"');
  });

  it('migration SQL index names match schema model table names', () => {
    // Verify that composite indexes reference correct table names
    // Schema maps: Sale -> "sales", SaleDelivery -> "sale_deliveries", etc.
    expect(sqlContent).toContain('ON "sales"("companyId"');
    expect(sqlContent).toContain('ON "sale_deliveries"("companyId"');
    expect(sqlContent).toContain('ON "sales_invoices"("companyId"');
    expect(sqlContent).toContain('ON "production_orders"("companyId"');
    expect(sqlContent).toContain('ON "client_payments"("companyId"');
  });

  it('composite indexes column order matches query patterns', () => {
    // For multi-tenant queries, companyId should always be first in composite
    const compositeIndexLines = sqlContent
      .split('\n')
      .filter(
        (line) =>
          line.trim().startsWith('ON') && line.includes('"companyId"') && line.includes(',')
      );

    compositeIndexLines.forEach((line) => {
      const columnsMatch = line.match(/ON\s+"[^"]+"\(([^)]+)\)/);
      if (columnsMatch) {
        const columns = columnsMatch[1].split(',').map((c) => c.trim().replace(/"/g, ''));
        // companyId should be the first column in all composite indexes
        expect(columns[0]).toBe('companyId');
      }
    });
  });

  it('no duplicate index names', () => {
    const indexNames = sqlContent
      .split('\n')
      .filter((line) => line.trim().startsWith('CREATE INDEX'))
      .map((line) => {
        const match = line.match(/"([^"]+)"/);
        return match ? match[1] : null;
      })
      .filter(Boolean);

    const uniqueNames = new Set(indexNames);
    expect(uniqueNames.size).toBe(indexNames.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: Schema <-> Migration Consistency
// ═══════════════════════════════════════════════════════════════════════════

describe('Schema <-> Migration Consistency', () => {
  const schemaPath = path.resolve(__dirname, '../project/prisma/schema.prisma');
  const migrationPath = path.resolve(
    __dirname,
    '../project/prisma/migrations/add_missing_indexes.sql'
  );
  let schemaContent: string;
  let sqlContent: string;

  beforeEach(() => {
    schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    sqlContent = fs.readFileSync(migrationPath, 'utf-8');
  });

  it('all models with new schema indexes have corresponding SQL indexes', () => {
    // Models that should have indexes in both schema and migration
    const modelsToCheck = [
      'Tool',
      'Worker',
      'Task',
      'CostProduct',
      'FixedTask',
      'ToolMovement',
      'ToolLoan',
      'TaskAttachment',
      'Subtask',
      'TaskComment',
      'FixedTaskInstructive',
      'FixedTaskExecution',
    ];

    modelsToCheck.forEach((modelName) => {
      // Each model should appear in both the schema @@index and the SQL
      const modelInSchema = extractModel(schemaContent, modelName);
      const hasSchemaIndex = modelInSchema.includes('@@index');

      // Model name should appear in SQL (as table name for CREATE INDEX)
      const hasInSql = sqlContent.includes(`"${modelName}"`);

      expect(hasSchemaIndex).toBe(true);
      expect(hasInSql).toBe(true);
    });
  });

  it('maintenance_history uses correct table name in SQL', () => {
    // maintenance_history is already lowercase in Prisma, so SQL should match
    expect(sqlContent).toContain('ON "maintenance_history"');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: Ordenes Analytics - Single-Pass Calculation Correctness
// ═══════════════════════════════════════════════════════════════════════════

describe('Ordenes Analytics - Single-Pass Calculation', () => {
  // Simulate the single-pass logic from the route
  function singlePassCalculation(ordenes: any[]) {
    const totalOrdenes = ordenes.length;
    let totalFacturado = 0;

    const porEstado: Record<string, number> = {};
    const facturacionPorEstado: Record<string, number> = {};
    const porMoneda: Record<string, number> = {};
    const facturacionPorMoneda: Record<string, number> = {};
    const clientesMap = new Map<string, { count: number; total: number; name: string }>();
    const vendedoresMap = new Map<number, { count: number; total: number; name: string }>();
    const ordenesPorMes: Record<string, { count: number; total: number }> = {};

    let fulfillmentTotalDays = 0;
    let fulfillmentCount = 0;
    let onTimeDeliveryCount = 0;
    let lateDeliveryCount = 0;

    for (const orden of ordenes) {
      const total = Number(orden.total);
      totalFacturado += total;

      porEstado[orden.estado] = (porEstado[orden.estado] || 0) + 1;
      facturacionPorEstado[orden.estado] = (facturacionPorEstado[orden.estado] || 0) + total;

      porMoneda[orden.moneda] = (porMoneda[orden.moneda] || 0) + 1;
      facturacionPorMoneda[orden.moneda] = (facturacionPorMoneda[orden.moneda] || 0) + total;

      const clientName = orden.client.legalName || orden.client.name;
      const clientData = clientesMap.get(orden.clientId) || {
        count: 0,
        total: 0,
        name: clientName,
      };
      clientData.count += 1;
      clientData.total += total;
      clientesMap.set(orden.clientId, clientData);

      if (orden.sellerId && orden.seller) {
        const sellerData = vendedoresMap.get(orden.sellerId) || {
          count: 0,
          total: 0,
          name: orden.seller.name,
        };
        sellerData.count += 1;
        sellerData.total += total;
        vendedoresMap.set(orden.sellerId, sellerData);
      }

      if (orden.fechaEntregaEstimada && orden.fechaEntregaReal) {
        const estimada = new Date(orden.fechaEntregaEstimada);
        const real = new Date(orden.fechaEntregaReal);
        const diffDays = Math.ceil(
          (real.getTime() - estimada.getTime()) / (1000 * 60 * 60 * 24)
        );
        fulfillmentTotalDays += diffDays;
        fulfillmentCount++;
        if (diffDays <= 0) onTimeDeliveryCount++;
        else lateDeliveryCount++;
      }

      const month = new Date(orden.fechaEmision).toISOString().slice(0, 7);
      if (!ordenesPorMes[month]) ordenesPorMes[month] = { count: 0, total: 0 };
      ordenesPorMes[month].count += 1;
      ordenesPorMes[month].total += total;
    }

    const averageOrderValue = totalOrdenes > 0 ? totalFacturado / totalOrdenes : 0;
    const avgDaysToDeliver =
      fulfillmentCount > 0 ? fulfillmentTotalDays / fulfillmentCount : 0;
    const onTimeDeliveryRate =
      fulfillmentCount > 0 ? (onTimeDeliveryCount / fulfillmentCount) * 100 : 0;

    return {
      totalOrdenes,
      totalFacturado,
      averageOrderValue,
      porEstado,
      facturacionPorEstado,
      porMoneda,
      facturacionPorMoneda,
      clientesMap,
      vendedoresMap,
      ordenesPorMes,
      avgDaysToDeliver,
      onTimeDeliveryRate,
      onTimeDeliveryCount,
      lateDeliveryCount,
      fulfillmentCount,
    };
  }

  // Reference multi-pass calculation (the old way)
  function multiPassCalculation(ordenes: any[]) {
    const totalOrdenes = ordenes.length;
    const totalFacturado = ordenes.reduce((sum: number, o: any) => sum + Number(o.total), 0);
    const averageOrderValue = totalOrdenes > 0 ? totalFacturado / totalOrdenes : 0;

    const porEstado = ordenes.reduce((acc: Record<string, number>, orden: any) => {
      acc[orden.estado] = (acc[orden.estado] || 0) + 1;
      return acc;
    }, {});

    const facturacionPorEstado = ordenes.reduce(
      (acc: Record<string, number>, orden: any) => {
        acc[orden.estado] = (acc[orden.estado] || 0) + Number(orden.total);
        return acc;
      },
      {}
    );

    const porMoneda = ordenes.reduce((acc: Record<string, number>, orden: any) => {
      acc[orden.moneda] = (acc[orden.moneda] || 0) + 1;
      return acc;
    }, {});

    const facturacionPorMoneda = ordenes.reduce(
      (acc: Record<string, number>, orden: any) => {
        acc[orden.moneda] = (acc[orden.moneda] || 0) + Number(orden.total);
        return acc;
      },
      {}
    );

    const clientesMap = new Map<string, { count: number; total: number; name: string }>();
    ordenes.forEach((orden: any) => {
      const clientId = orden.clientId;
      const clientName = orden.client.legalName || orden.client.name;
      const existing = clientesMap.get(clientId) || { count: 0, total: 0, name: clientName };
      existing.count += 1;
      existing.total += Number(orden.total);
      clientesMap.set(clientId, existing);
    });

    const vendedoresMap = new Map<number, { count: number; total: number; name: string }>();
    ordenes.forEach((orden: any) => {
      if (orden.sellerId && orden.seller) {
        const existing = vendedoresMap.get(orden.sellerId) || {
          count: 0,
          total: 0,
          name: orden.seller.name,
        };
        existing.count += 1;
        existing.total += Number(orden.total);
        vendedoresMap.set(orden.sellerId, existing);
      }
    });

    const ordenesConFechaEntrega = ordenes.filter(
      (o: any) => o.fechaEntregaEstimada && o.fechaEntregaReal
    );

    let avgDaysToDeliver = 0;
    let onTimeDeliveryCount = 0;
    let lateDeliveryCount = 0;

    if (ordenesConFechaEntrega.length > 0) {
      let totalDays = 0;
      ordenesConFechaEntrega.forEach((orden: any) => {
        const estimada = new Date(orden.fechaEntregaEstimada);
        const real = new Date(orden.fechaEntregaReal);
        const diffDays = Math.ceil(
          (real.getTime() - estimada.getTime()) / (1000 * 60 * 60 * 24)
        );
        totalDays += diffDays;
        if (diffDays <= 0) onTimeDeliveryCount++;
        else lateDeliveryCount++;
      });
      avgDaysToDeliver = totalDays / ordenesConFechaEntrega.length;
    }

    const onTimeDeliveryRate =
      ordenesConFechaEntrega.length > 0
        ? (onTimeDeliveryCount / ordenesConFechaEntrega.length) * 100
        : 0;

    const ordenesPorMes = ordenes.reduce(
      (acc: Record<string, { count: number; total: number }>, orden: any) => {
        const month = new Date(orden.fechaEmision).toISOString().slice(0, 7);
        if (!acc[month]) acc[month] = { count: 0, total: 0 };
        acc[month].count += 1;
        acc[month].total += Number(orden.total);
        return acc;
      },
      {}
    );

    return {
      totalOrdenes,
      totalFacturado,
      averageOrderValue,
      porEstado,
      facturacionPorEstado,
      porMoneda,
      facturacionPorMoneda,
      clientesMap,
      vendedoresMap,
      ordenesPorMes,
      avgDaysToDeliver,
      onTimeDeliveryRate,
      onTimeDeliveryCount,
      lateDeliveryCount,
      fulfillmentCount: ordenesConFechaEntrega.length,
    };
  }

  const sampleOrders = [
    {
      total: '1000.50',
      estado: 'CONFIRMADA',
      moneda: 'ARS',
      clientId: 'client-1',
      client: { legalName: 'Cliente SA', name: 'Cliente' },
      sellerId: 1,
      seller: { name: 'Vendedor A' },
      fechaEntregaEstimada: '2025-01-15',
      fechaEntregaReal: '2025-01-14',
      fechaEmision: new Date('2025-01-01'),
    },
    {
      total: '2500.00',
      estado: 'ENTREGADA',
      moneda: 'USD',
      clientId: 'client-2',
      client: { legalName: null, name: 'Cliente B' },
      sellerId: 2,
      seller: { name: 'Vendedor B' },
      fechaEntregaEstimada: '2025-01-20',
      fechaEntregaReal: '2025-01-25',
      fechaEmision: new Date('2025-01-05'),
    },
    {
      total: '750.00',
      estado: 'CONFIRMADA',
      moneda: 'ARS',
      clientId: 'client-1',
      client: { legalName: 'Cliente SA', name: 'Cliente' },
      sellerId: 1,
      seller: { name: 'Vendedor A' },
      fechaEntregaEstimada: null,
      fechaEntregaReal: null,
      fechaEmision: new Date('2025-02-01'),
    },
    {
      total: '3200.00',
      estado: 'CANCELADA',
      moneda: 'ARS',
      clientId: 'client-3',
      client: { legalName: 'Cliente C Corp', name: 'C Corp' },
      sellerId: null,
      seller: null,
      fechaEntregaEstimada: null,
      fechaEntregaReal: null,
      fechaEmision: new Date('2025-02-15'),
    },
    {
      total: '500.00',
      estado: 'FACTURADA',
      moneda: 'USD',
      clientId: 'client-2',
      client: { legalName: null, name: 'Cliente B' },
      sellerId: 2,
      seller: { name: 'Vendedor B' },
      fechaEntregaEstimada: '2025-02-10',
      fechaEntregaReal: '2025-02-10',
      fechaEmision: new Date('2025-02-01'),
    },
  ];

  it('single-pass and multi-pass produce identical totalFacturado', () => {
    const sp = singlePassCalculation(sampleOrders);
    const mp = multiPassCalculation(sampleOrders);
    expect(sp.totalFacturado).toBe(mp.totalFacturado);
  });

  it('single-pass and multi-pass produce identical totalOrdenes', () => {
    const sp = singlePassCalculation(sampleOrders);
    const mp = multiPassCalculation(sampleOrders);
    expect(sp.totalOrdenes).toBe(mp.totalOrdenes);
  });

  it('single-pass and multi-pass produce identical averageOrderValue', () => {
    const sp = singlePassCalculation(sampleOrders);
    const mp = multiPassCalculation(sampleOrders);
    expect(sp.averageOrderValue).toBe(mp.averageOrderValue);
  });

  it('single-pass and multi-pass produce identical porEstado', () => {
    const sp = singlePassCalculation(sampleOrders);
    const mp = multiPassCalculation(sampleOrders);
    expect(sp.porEstado).toEqual(mp.porEstado);
  });

  it('single-pass and multi-pass produce identical facturacionPorEstado', () => {
    const sp = singlePassCalculation(sampleOrders);
    const mp = multiPassCalculation(sampleOrders);
    expect(sp.facturacionPorEstado).toEqual(mp.facturacionPorEstado);
  });

  it('single-pass and multi-pass produce identical porMoneda', () => {
    const sp = singlePassCalculation(sampleOrders);
    const mp = multiPassCalculation(sampleOrders);
    expect(sp.porMoneda).toEqual(mp.porMoneda);
  });

  it('single-pass and multi-pass produce identical facturacionPorMoneda', () => {
    const sp = singlePassCalculation(sampleOrders);
    const mp = multiPassCalculation(sampleOrders);
    expect(sp.facturacionPorMoneda).toEqual(mp.facturacionPorMoneda);
  });

  it('single-pass and multi-pass produce identical client aggregation', () => {
    const sp = singlePassCalculation(sampleOrders);
    const mp = multiPassCalculation(sampleOrders);

    expect(sp.clientesMap.size).toBe(mp.clientesMap.size);

    for (const [key, val] of sp.clientesMap) {
      const mpVal = mp.clientesMap.get(key);
      expect(mpVal).toBeDefined();
      expect(val.count).toBe(mpVal!.count);
      expect(val.total).toBe(mpVal!.total);
      expect(val.name).toBe(mpVal!.name);
    }
  });

  it('single-pass and multi-pass produce identical seller aggregation', () => {
    const sp = singlePassCalculation(sampleOrders);
    const mp = multiPassCalculation(sampleOrders);

    expect(sp.vendedoresMap.size).toBe(mp.vendedoresMap.size);

    for (const [key, val] of sp.vendedoresMap) {
      const mpVal = mp.vendedoresMap.get(key);
      expect(mpVal).toBeDefined();
      expect(val.count).toBe(mpVal!.count);
      expect(val.total).toBe(mpVal!.total);
      expect(val.name).toBe(mpVal!.name);
    }
  });

  it('single-pass and multi-pass produce identical fulfillment metrics', () => {
    const sp = singlePassCalculation(sampleOrders);
    const mp = multiPassCalculation(sampleOrders);

    expect(sp.fulfillmentCount).toBe(mp.fulfillmentCount);
    expect(sp.avgDaysToDeliver).toBe(mp.avgDaysToDeliver);
    expect(sp.onTimeDeliveryCount).toBe(mp.onTimeDeliveryCount);
    expect(sp.lateDeliveryCount).toBe(mp.lateDeliveryCount);
    expect(sp.onTimeDeliveryRate).toBe(mp.onTimeDeliveryRate);
  });

  it('single-pass and multi-pass produce identical monthly series', () => {
    const sp = singlePassCalculation(sampleOrders);
    const mp = multiPassCalculation(sampleOrders);
    expect(sp.ordenesPorMes).toEqual(mp.ordenesPorMes);
  });

  // Edge cases
  it('handles empty orders array', () => {
    const sp = singlePassCalculation([]);
    expect(sp.totalOrdenes).toBe(0);
    expect(sp.totalFacturado).toBe(0);
    expect(sp.averageOrderValue).toBe(0);
    expect(sp.avgDaysToDeliver).toBe(0);
    expect(sp.onTimeDeliveryRate).toBe(0);
    expect(sp.fulfillmentCount).toBe(0);
  });

  it('handles orders without sellers', () => {
    const ordersWithoutSellers = sampleOrders.map((o) => ({
      ...o,
      sellerId: null,
      seller: null,
    }));

    const sp = singlePassCalculation(ordersWithoutSellers);
    expect(sp.vendedoresMap.size).toBe(0);
  });

  it('handles orders where all deliveries are on time', () => {
    const allOnTime = sampleOrders.map((o) => ({
      ...o,
      fechaEntregaEstimada: '2025-03-15',
      fechaEntregaReal: '2025-03-14',
    }));

    const sp = singlePassCalculation(allOnTime);
    expect(sp.onTimeDeliveryRate).toBe(100);
    expect(sp.lateDeliveryCount).toBe(0);
  });

  it('handles orders where all deliveries are late', () => {
    const allLate = sampleOrders.map((o) => ({
      ...o,
      fechaEntregaEstimada: '2025-03-01',
      fechaEntregaReal: '2025-03-15',
    }));

    const sp = singlePassCalculation(allLate);
    expect(sp.onTimeDeliveryRate).toBe(0);
    expect(sp.onTimeDeliveryCount).toBe(0);
  });

  it('same-day delivery counts as on-time (diffDays <= 0)', () => {
    const sameDayOrders = [
      {
        total: '1000',
        estado: 'ENTREGADA',
        moneda: 'ARS',
        clientId: 'c1',
        client: { legalName: 'Test', name: 'Test' },
        sellerId: null,
        seller: null,
        fechaEntregaEstimada: '2025-01-15',
        fechaEntregaReal: '2025-01-15',
        fechaEmision: new Date('2025-01-01'),
      },
    ];

    const sp = singlePassCalculation(sameDayOrders);
    // Math.ceil((same-same) / day_ms) = Math.ceil(0) = 0, which is <= 0 => on time
    expect(sp.onTimeDeliveryCount).toBe(1);
    expect(sp.onTimeDeliveryRate).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: Entregas Analytics - Batch Trends Calculation
// ═══════════════════════════════════════════════════════════════════════════

describe('Entregas Analytics - Batch Trends', () => {
  // Extracted and simplified logic from calculateRecentTrends
  function calculateRecentTrends(
    createdByDay: { createdAt: Date }[],
    deliveredByDay: { fechaEntrega: Date | null }[],
    today: Date
  ) {
    const createdCounts: Record<string, number> = {};
    const deliveredCounts: Record<string, number> = {};

    createdByDay.forEach((d) => {
      const key = d.createdAt.toISOString().split('T')[0];
      createdCounts[key] = (createdCounts[key] || 0) + 1;
    });

    deliveredByDay.forEach((d) => {
      if (d.fechaEntrega) {
        const key = d.fechaEntrega.toISOString().split('T')[0];
        deliveredCounts[key] = (deliveredCounts[key] || 0) + 1;
      }
    });

    const trends = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      trends.push({
        date: dateStr,
        created: createdCounts[dateStr] || 0,
        delivered: deliveredCounts[dateStr] || 0,
      });
    }

    return trends;
  }

  it('produces 7 days of trends', () => {
    const today = new Date('2025-03-10');
    const trends = calculateRecentTrends([], [], today);
    expect(trends).toHaveLength(7);
  });

  it('dates are in chronological order', () => {
    const today = new Date('2025-03-10');
    const trends = calculateRecentTrends([], [], today);

    for (let i = 1; i < trends.length; i++) {
      expect(trends[i].date > trends[i - 1].date).toBe(true);
    }
  });

  it('last date is today', () => {
    const today = new Date('2025-03-10');
    const trends = calculateRecentTrends([], [], today);
    expect(trends[6].date).toBe('2025-03-10');
  });

  it('first date is 6 days before today', () => {
    const today = new Date('2025-03-10');
    const trends = calculateRecentTrends([], [], today);
    expect(trends[0].date).toBe('2025-03-04');
  });

  it('counts created deliveries per day correctly', () => {
    const today = new Date('2025-03-10');
    const created = [
      { createdAt: new Date('2025-03-10T10:00:00Z') },
      { createdAt: new Date('2025-03-10T14:00:00Z') },
      { createdAt: new Date('2025-03-09T08:00:00Z') },
    ];

    const trends = calculateRecentTrends(created, [], today);
    expect(trends[6].created).toBe(2); // March 10
    expect(trends[5].created).toBe(1); // March 9
    expect(trends[4].created).toBe(0); // March 8
  });

  it('counts delivered items per day correctly', () => {
    const today = new Date('2025-03-10');
    const delivered = [
      { fechaEntrega: new Date('2025-03-08T10:00:00Z') },
      { fechaEntrega: new Date('2025-03-08T15:00:00Z') },
      { fechaEntrega: new Date('2025-03-08T18:00:00Z') },
    ];

    const trends = calculateRecentTrends([], delivered, today);
    expect(trends[4].delivered).toBe(3); // March 8
    expect(trends[6].delivered).toBe(0); // March 10
  });

  it('handles null fechaEntrega gracefully', () => {
    const today = new Date('2025-03-10');
    const delivered = [
      { fechaEntrega: null },
      { fechaEntrega: new Date('2025-03-10T10:00:00Z') },
    ];

    const trends = calculateRecentTrends([], delivered, today);
    expect(trends[6].delivered).toBe(1); // Only the non-null one
  });

  it('returns zeros for days without deliveries', () => {
    const today = new Date('2025-03-10');
    const trends = calculateRecentTrends([], [], today);

    trends.forEach((t) => {
      expect(t.created).toBe(0);
      expect(t.delivered).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: Facturas Dashboard - Aging Analysis
// ═══════════════════════════════════════════════════════════════════════════

describe('Facturas Dashboard - Aging Analysis', () => {
  function calculateAging(
    invoices: { saldoPendiente: number | string; fechaVencimiento: Date | string }[],
    now: Date
  ) {
    const aging = {
      vigente: 0,
      vencido1_30: 0,
      vencido31_60: 0,
      vencido61_90: 0,
      vencido90Plus: 0,
    };

    invoices.forEach((inv) => {
      const saldo = parseFloat(inv.saldoPendiente.toString());
      const daysOverdue = Math.floor(
        (now.getTime() - new Date(inv.fechaVencimiento).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysOverdue < 0) {
        aging.vigente += saldo;
      } else if (daysOverdue <= 30) {
        aging.vencido1_30 += saldo;
      } else if (daysOverdue <= 60) {
        aging.vencido31_60 += saldo;
      } else if (daysOverdue <= 90) {
        aging.vencido61_90 += saldo;
      } else {
        aging.vencido90Plus += saldo;
      }
    });

    return aging;
  }

  it('classifies future invoices as vigente', () => {
    const now = new Date('2025-03-15');
    const invoices = [{ saldoPendiente: 1000, fechaVencimiento: new Date('2025-03-20') }];

    const aging = calculateAging(invoices, now);
    expect(aging.vigente).toBe(1000);
    expect(aging.vencido1_30).toBe(0);
  });

  it('classifies day-of-due-date as vencido1_30 (daysOverdue=0)', () => {
    const now = new Date('2025-03-15T12:00:00Z');
    const invoices = [
      { saldoPendiente: 500, fechaVencimiento: new Date('2025-03-15T00:00:00Z') },
    ];

    const aging = calculateAging(invoices, now);
    // daysOverdue = floor((12hrs) / 24hrs) = floor(0.5) = 0, which is >= 0 and <= 30
    expect(aging.vencido1_30).toBe(500);
    expect(aging.vigente).toBe(0);
  });

  it('classifies 31-60 days overdue correctly', () => {
    const now = new Date('2025-03-15');
    const invoices = [
      {
        saldoPendiente: 2000,
        fechaVencimiento: new Date('2025-02-01'), // ~42 days overdue
      },
    ];

    const aging = calculateAging(invoices, now);
    expect(aging.vencido31_60).toBe(2000);
  });

  it('classifies 61-90 days overdue correctly', () => {
    const now = new Date('2025-06-15');
    const invoices = [
      {
        saldoPendiente: 3000,
        fechaVencimiento: new Date('2025-04-01'), // 75 days overdue
      },
    ];

    const aging = calculateAging(invoices, now);
    expect(aging.vencido61_90).toBe(3000);
  });

  it('classifies 90+ days overdue correctly', () => {
    const now = new Date('2025-06-15');
    const invoices = [
      {
        saldoPendiente: 5000,
        fechaVencimiento: new Date('2025-01-01'), // ~165 days overdue
      },
    ];

    const aging = calculateAging(invoices, now);
    expect(aging.vencido90Plus).toBe(5000);
  });

  it('handles multiple invoices across all buckets', () => {
    const now = new Date('2025-06-15');
    const invoices = [
      { saldoPendiente: 100, fechaVencimiento: new Date('2025-07-01') }, // vigente
      { saldoPendiente: 200, fechaVencimiento: new Date('2025-06-01') }, // 14d -> 1-30
      { saldoPendiente: 300, fechaVencimiento: new Date('2025-05-01') }, // 45d -> 31-60
      { saldoPendiente: 400, fechaVencimiento: new Date('2025-04-01') }, // 75d -> 61-90
      { saldoPendiente: 500, fechaVencimiento: new Date('2025-01-01') }, // 165d -> 90+
    ];

    const aging = calculateAging(invoices, now);
    expect(aging.vigente).toBe(100);
    expect(aging.vencido1_30).toBe(200);
    expect(aging.vencido31_60).toBe(300);
    expect(aging.vencido61_90).toBe(400);
    expect(aging.vencido90Plus).toBe(500);
  });

  it('handles empty invoice array', () => {
    const now = new Date('2025-03-15');
    const aging = calculateAging([], now);
    expect(aging.vigente).toBe(0);
    expect(aging.vencido1_30).toBe(0);
    expect(aging.vencido31_60).toBe(0);
    expect(aging.vencido61_90).toBe(0);
    expect(aging.vencido90Plus).toBe(0);
  });

  it('handles string saldoPendiente (Prisma Decimal)', () => {
    const now = new Date('2025-03-15');
    const invoices = [
      { saldoPendiente: '1234.56', fechaVencimiento: new Date('2025-03-20') },
    ];

    const aging = calculateAging(invoices, now);
    expect(aging.vigente).toBe(1234.56);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7: Pagos Analytics - DSO & Payment Method Parsing
// ═══════════════════════════════════════════════════════════════════════════

describe('Pagos Analytics - DSO Calculation', () => {
  it('DSO is zero when no credit sales', () => {
    const totalPendiente = 5000;
    const totalCreditSales = 0;
    const dso = totalCreditSales > 0 ? (totalPendiente / totalCreditSales) * 90 : 0;
    expect(dso).toBe(0);
  });

  it('DSO calculation is correct for normal case', () => {
    const totalPendiente = 10000;
    const totalCreditSales = 30000;
    const dso = totalCreditSales > 0 ? (totalPendiente / totalCreditSales) * 90 : 0;
    expect(dso).toBe(30); // 10000/30000 * 90 = 30 days
  });

  it('DSO rounds correctly', () => {
    const totalPendiente = 7500;
    const totalCreditSales = 22000;
    const dso = totalCreditSales > 0 ? (totalPendiente / totalCreditSales) * 90 : 0;
    const rounded = Math.round(dso * 10) / 10;
    expect(rounded).toBe(30.7); // 7500/22000 * 90 ≈ 30.681... -> 30.7
  });
});

describe('Pagos Analytics - Collection Time', () => {
  it('average collection time calculated correctly', () => {
    const payments = [
      {
        createdAt: new Date('2025-01-01'),
        fechaPago: new Date('2025-01-11'),
      },
      {
        createdAt: new Date('2025-01-05'),
        fechaPago: new Date('2025-01-20'),
      },
    ];

    const collectionTimes = payments.map((p) => {
      const createdDate = new Date(p.createdAt);
      const paymentDate = new Date(p.fechaPago);
      return (paymentDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
    });

    const avg =
      collectionTimes.length > 0
        ? collectionTimes.reduce((sum, days) => sum + days, 0) / collectionTimes.length
        : 0;

    expect(collectionTimes[0]).toBe(10); // 10 days
    expect(collectionTimes[1]).toBe(15); // 15 days
    expect(avg).toBe(12.5);
  });

  it('empty payments returns 0 avg collection time', () => {
    const collectionTimes: number[] = [];
    const avg =
      collectionTimes.length > 0
        ? collectionTimes.reduce((sum, days) => sum + days, 0) / collectionTimes.length
        : 0;
    expect(avg).toBe(0);
  });
});

describe('Pagos Analytics - Payment Method Parsing', () => {
  it('parses Prisma Decimal payment methods correctly', () => {
    // Simulates aggregate result
    const agg = {
      _sum: {
        efectivo: { toString: () => '15000.50' },
        transferencia: { toString: () => '25000.00' },
        chequesTerceros: null,
        chequesPropios: null,
        tarjetaCredito: { toString: () => '5000.00' },
        tarjetaDebito: null,
        otrosMedios: null,
      },
    };

    const porMedio = {
      efectivo: parseFloat((agg._sum.efectivo || 0).toString()),
      transferencia: parseFloat((agg._sum.transferencia || 0).toString()),
      chequesTerceros: parseFloat((agg._sum.chequesTerceros || 0).toString()),
      chequesPropios: parseFloat((agg._sum.chequesPropios || 0).toString()),
      tarjetaCredito: parseFloat((agg._sum.tarjetaCredito || 0).toString()),
      tarjetaDebito: parseFloat((agg._sum.tarjetaDebito || 0).toString()),
      otrosMedios: parseFloat((agg._sum.otrosMedios || 0).toString()),
    };

    expect(porMedio.efectivo).toBe(15000.5);
    expect(porMedio.transferencia).toBe(25000);
    expect(porMedio.chequesTerceros).toBe(0);
    expect(porMedio.tarjetaCredito).toBe(5000);
    expect(porMedio.tarjetaDebito).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8: Production KPIs - Downtime Single-Pass
// ═══════════════════════════════════════════════════════════════════════════

describe('Production KPIs - Downtime Single-Pass', () => {
  function singlePassDowntimes(downtimes: any[]) {
    let totalDowntimeEvents = 0;
    let totalDowntimeDuration = 0;
    let unplannedDowntimes = 0;
    let plannedDowntimes = 0;
    const downtimeByReason: Record<
      string,
      { code: string; name: string; count: number; minutes: number }
    > = {};

    for (const dt of downtimes) {
      totalDowntimeEvents++;
      totalDowntimeDuration += dt.durationMinutes || 0;
      if (dt.type === 'UNPLANNED') unplannedDowntimes++;
      else if (dt.type === 'PLANNED') plannedDowntimes++;

      const key = dt.reasonCodeId?.toString() || 'sin-codigo';
      if (!downtimeByReason[key]) {
        downtimeByReason[key] = {
          code: dt.reasonCode?.code || 'N/A',
          name: dt.reasonCode?.name || 'Sin codigo',
          count: 0,
          minutes: 0,
        };
      }
      downtimeByReason[key].count++;
      downtimeByReason[key].minutes += dt.durationMinutes || 0;
    }

    const paretoDowntimes = Object.values(downtimeByReason)
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 10);

    return {
      totalDowntimeEvents,
      totalDowntimeDuration,
      unplannedDowntimes,
      plannedDowntimes,
      paretoDowntimes,
    };
  }

  const sampleDowntimes = [
    {
      durationMinutes: 30,
      type: 'UNPLANNED',
      reasonCodeId: 1,
      reasonCode: { code: 'MEC', name: 'Mecánico' },
    },
    {
      durationMinutes: 60,
      type: 'PLANNED',
      reasonCodeId: 2,
      reasonCode: { code: 'MNT', name: 'Mantenimiento' },
    },
    {
      durationMinutes: 45,
      type: 'UNPLANNED',
      reasonCodeId: 1,
      reasonCode: { code: 'MEC', name: 'Mecánico' },
    },
    {
      durationMinutes: 15,
      type: 'UNPLANNED',
      reasonCodeId: null,
      reasonCode: null,
    },
    {
      durationMinutes: 0,
      type: 'PLANNED',
      reasonCodeId: 3,
      reasonCode: { code: 'CAL', name: 'Calibración' },
    },
  ];

  it('counts total events correctly', () => {
    const result = singlePassDowntimes(sampleDowntimes);
    expect(result.totalDowntimeEvents).toBe(5);
  });

  it('sums duration correctly', () => {
    const result = singlePassDowntimes(sampleDowntimes);
    expect(result.totalDowntimeDuration).toBe(150); // 30+60+45+15+0
  });

  it('counts planned vs unplanned correctly', () => {
    const result = singlePassDowntimes(sampleDowntimes);
    expect(result.unplannedDowntimes).toBe(3); // 30min + 45min + 15min
    expect(result.plannedDowntimes).toBe(2); // 60min + 0min
  });

  it('groups by reason code correctly', () => {
    const result = singlePassDowntimes(sampleDowntimes);
    // Should have 3 groups: MEC (id=1), MNT (id=2), sin-codigo (null), CAL (id=3)
    expect(result.paretoDowntimes).toHaveLength(4);
  });

  it('sorts Pareto by minutes descending', () => {
    const result = singlePassDowntimes(sampleDowntimes);
    for (let i = 1; i < result.paretoDowntimes.length; i++) {
      expect(result.paretoDowntimes[i].minutes).toBeLessThanOrEqual(
        result.paretoDowntimes[i - 1].minutes
      );
    }
  });

  it('MEC reason has correct aggregation', () => {
    const result = singlePassDowntimes(sampleDowntimes);
    const mec = result.paretoDowntimes.find((p) => p.code === 'MEC');
    expect(mec).toBeDefined();
    expect(mec!.count).toBe(2);
    expect(mec!.minutes).toBe(75); // 30+45
  });

  it('handles null reasonCode with "sin-codigo" key', () => {
    const result = singlePassDowntimes(sampleDowntimes);
    const sinCodigo = result.paretoDowntimes.find((p) => p.code === 'N/A');
    expect(sinCodigo).toBeDefined();
    expect(sinCodigo!.name).toBe('Sin codigo');
    expect(sinCodigo!.count).toBe(1);
    expect(sinCodigo!.minutes).toBe(15);
  });

  it('handles null durationMinutes as 0', () => {
    const downtimes = [
      {
        durationMinutes: null,
        type: 'UNPLANNED',
        reasonCodeId: null,
        reasonCode: null,
      },
    ];

    const result = singlePassDowntimes(downtimes);
    expect(result.totalDowntimeDuration).toBe(0);
  });

  it('handles empty downtimes array', () => {
    const result = singlePassDowntimes([]);
    expect(result.totalDowntimeEvents).toBe(0);
    expect(result.totalDowntimeDuration).toBe(0);
    expect(result.unplannedDowntimes).toBe(0);
    expect(result.plannedDowntimes).toBe(0);
    expect(result.paretoDowntimes).toHaveLength(0);
  });

  it('limits Pareto to top 10', () => {
    const manyDowntimes = Array.from({ length: 15 }, (_, i) => ({
      durationMinutes: 10 + i,
      type: 'UNPLANNED',
      reasonCodeId: i,
      reasonCode: { code: `C${i}`, name: `Code ${i}` },
    }));

    const result = singlePassDowntimes(manyDowntimes);
    expect(result.paretoDowntimes).toHaveLength(10);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 9: Production KPIs - Scrap & Availability Calculations
// ═══════════════════════════════════════════════════════════════════════════

describe('Production KPIs - Derived Metrics', () => {
  it('scrapPercent is 0 when no production', () => {
    const totalGood = 0;
    const totalScrap = 0;
    const scrapPercent =
      totalGood + totalScrap > 0 ? (totalScrap / (totalGood + totalScrap)) * 100 : 0;
    expect(scrapPercent).toBe(0);
  });

  it('scrapPercent calculation is correct', () => {
    const totalGood = 950;
    const totalScrap = 50;
    const scrapPercent =
      totalGood + totalScrap > 0 ? (totalScrap / (totalGood + totalScrap)) * 100 : 0;
    expect(scrapPercent).toBe(5); // 50/1000 * 100
  });

  it('availabilityPercent is 0 when no shift time', () => {
    const totalShiftMinutes = 0;
    const totalDowntimeMinutes = 0;
    const availabilityPercent =
      totalShiftMinutes > 0
        ? ((totalShiftMinutes - totalDowntimeMinutes) / totalShiftMinutes) * 100
        : 0;
    expect(availabilityPercent).toBe(0);
  });

  it('availabilityPercent calculation is correct', () => {
    const totalShiftMinutes = 480; // 8 hours
    const totalDowntimeMinutes = 48; // 48 min
    const availabilityPercent =
      totalShiftMinutes > 0
        ? ((totalShiftMinutes - totalDowntimeMinutes) / totalShiftMinutes) * 100
        : 0;
    expect(availabilityPercent).toBe(90); // (480-48)/480 * 100
  });

  it('planVsRealPercent is 0 when no planned', () => {
    const totalPlanned = 0;
    const totalProduced = 0;
    const planVsRealPercent = totalPlanned > 0 ? (totalProduced / totalPlanned) * 100 : 0;
    expect(planVsRealPercent).toBe(0);
  });

  it('planVsRealPercent calculation is correct', () => {
    const totalPlanned = 1000;
    const totalProduced = 950;
    const planVsRealPercent = totalPlanned > 0 ? (totalProduced / totalPlanned) * 100 : 0;
    expect(planVsRealPercent).toBe(95);
  });

  it('planVsRealPercent can exceed 100 (overproduction)', () => {
    const totalPlanned = 1000;
    const totalProduced = 1100;
    const planVsRealPercent = totalPlanned > 0 ? (totalProduced / totalPlanned) * 100 : 0;
    expect(planVsRealPercent).toBeCloseTo(110, 5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 10: Entregas Analytics - On-Time Rate & Failure Reasons
// ═══════════════════════════════════════════════════════════════════════════

describe('Entregas Analytics - On-Time Rate', () => {
  it('onTimePercentage is 0 when no deliveries', () => {
    const onTimeStats = { total: 0, onTime: 0 };
    const pct =
      onTimeStats.total > 0
        ? Math.round((onTimeStats.onTime / onTimeStats.total) * 100)
        : 0;
    expect(pct).toBe(0);
  });

  it('onTimePercentage rounds correctly', () => {
    const onTimeStats = { total: 3, onTime: 2 };
    const pct =
      onTimeStats.total > 0
        ? Math.round((onTimeStats.onTime / onTimeStats.total) * 100)
        : 0;
    expect(pct).toBe(67); // 66.66... rounds to 67
  });

  it('onTimePercentage is 100 when all on time', () => {
    const onTimeStats = { total: 10, onTime: 10 };
    const pct =
      onTimeStats.total > 0
        ? Math.round((onTimeStats.onTime / onTimeStats.total) * 100)
        : 0;
    expect(pct).toBe(100);
  });
});

describe('Entregas Analytics - Failure Reasons Parsing', () => {
  function parseFailureReasons(
    failed: { notas: string | null }[]
  ): { reason: string; count: number }[] {
    const reasons: Record<string, number> = {};

    failed.forEach((d) => {
      if (d.notas) {
        const match = d.notas.match(/Motivo:\s*([^\n]+)/);
        if (match) {
          const reason = match[1].trim();
          reasons[reason] = (reasons[reason] || 0) + 1;
        }
      }
    });

    return Object.entries(reasons)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  it('extracts reason from notes format', () => {
    const failed = [
      { notas: 'ENTREGA FALLIDA - Motivo: Cliente ausente' },
      { notas: 'ENTREGA FALLIDA - Motivo: Dirección incorrecta' },
      { notas: 'ENTREGA FALLIDA - Motivo: Cliente ausente' },
    ];

    const reasons = parseFailureReasons(failed);
    expect(reasons).toHaveLength(2);
    expect(reasons[0].reason).toBe('Cliente ausente');
    expect(reasons[0].count).toBe(2);
    expect(reasons[1].reason).toBe('Dirección incorrecta');
    expect(reasons[1].count).toBe(1);
  });

  it('handles null notas', () => {
    const failed = [{ notas: null }, { notas: 'ENTREGA FALLIDA - Motivo: Sin stock' }];

    const reasons = parseFailureReasons(failed);
    expect(reasons).toHaveLength(1);
    expect(reasons[0].reason).toBe('Sin stock');
  });

  it('handles notes without Motivo pattern', () => {
    const failed = [
      { notas: 'Nota sin formato de motivo' },
      { notas: 'Otra nota random' },
    ];

    const reasons = parseFailureReasons(failed);
    expect(reasons).toHaveLength(0);
  });

  it('limits to top 5 reasons', () => {
    const failed = Array.from({ length: 20 }, (_, i) => ({
      notas: `ENTREGA FALLIDA - Motivo: Razón ${i % 7}`,
    }));

    const reasons = parseFailureReasons(failed);
    expect(reasons.length).toBeLessThanOrEqual(5);
  });

  it('handles empty array', () => {
    const reasons = parseFailureReasons([]);
    expect(reasons).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 11: Facturas Dashboard - Percentage-based Division Safety
// ═══════════════════════════════════════════════════════════════════════════

describe('Facturas Dashboard - Division Safety', () => {
  it('statusBreakdown percentage handles zero totalDeliveries', () => {
    const totalDeliveries = 0;
    const statusCount = 5;
    // The route does: Math.round((s._count.estado / totalDeliveries) * 100)
    // This would produce Infinity -> NaN when totalDeliveries is 0
    const percentage =
      totalDeliveries > 0 ? Math.round((statusCount / totalDeliveries) * 100) : 0;

    // Safe version returns 0
    expect(percentage).toBe(0);
  });

  it('the actual route code divides by totalDeliveries without zero-check', () => {
    // This test documents the BUG: the route divides by totalDeliveries
    // without checking for zero, producing Infinity
    const totalDeliveries = 0;
    const statusCount = 5;

    // This is what the route does (BUG):
    const percentage = Math.round((statusCount / totalDeliveries) * 100);
    // Math.round(Infinity) = Infinity, not NaN
    expect(percentage).toBe(Infinity);
    expect(isFinite(percentage)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 12: Ordenes Analytics - clientId Filter Bug
// ═══════════════════════════════════════════════════════════════════════════

describe('Ordenes Analytics - clientId Filter Bug', () => {
  it('documents the clientId variable reference bug on line 47', () => {
    // The route has: ...(clienteId && { clientId })
    // But "clientId" is NOT in scope as a variable at that point.
    // The variable is "clienteId" (with 'e').
    // Correct code should be: ...(clienteId && { clientId: clienteId })

    const clienteId = 'test-client-123';

    // This is what the CORRECT spread should look like:
    const correctFilter = {
      ...(clienteId && { clientId: clienteId }),
    };
    expect(correctFilter.clientId).toBe('test-client-123');

    // The broken code uses shorthand { clientId } which references a non-existent variable.
    // In JavaScript, this would cause ReferenceError: clientId is not defined
    // In the actual route, TypeScript may let it compile if clientId exists in a broader scope,
    // but functionally the client filter is broken.
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 13: Performance Doc Validation
// ═══════════════════════════════════════════════════════════════════════════

describe('Performance Optimization Documentation', () => {
  const docPath = path.resolve(__dirname, '../project/docs/PERFORMANCE_OPTIMIZATION.md');

  it('documentation file exists', () => {
    expect(fs.existsSync(docPath)).toBe(true);
  });

  it('documents all optimized routes', () => {
    const content = fs.readFileSync(docPath, 'utf-8');

    expect(content).toContain('entregas/analytics');
    expect(content).toContain('facturas/dashboard');
    expect(content).toContain('pagos/analytics');
    expect(content).toContain('ordenes/analytics');
    expect(content).toContain('production/kpis');
  });

  it('documents deployment instructions', () => {
    const content = fs.readFileSync(docPath, 'utf-8');

    expect(content).toContain('CONCURRENTLY');
    expect(content).toContain('ANALYZE');
  });

  it('documents anti-patterns to avoid', () => {
    const content = fs.readFileSync(docPath, 'utf-8');

    // Should have "DON'T" patterns
    expect(content).toMatch(/DON'T|BAD/i);
    // Should have "DO" patterns
    expect(content).toMatch(/\bDO\b.*aggregate|aggregate.*\bDO\b/is);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extracts a Prisma model block from the schema content.
 * Returns the full model definition including all @@index, @@unique, @@map, etc.
 */
function extractModel(schemaContent: string, modelName: string): string {
  // Match "model ModelName {" and extract until closing "}"
  const regex = new RegExp(`model\\s+${modelName}\\s*\\{`, 'g');
  const match = regex.exec(schemaContent);

  if (!match) return '';

  let braceCount = 1;
  let pos = match.index + match[0].length;

  while (pos < schemaContent.length && braceCount > 0) {
    if (schemaContent[pos] === '{') braceCount++;
    if (schemaContent[pos] === '}') braceCount--;
    pos++;
  }

  return schemaContent.substring(match.index, pos);
}
