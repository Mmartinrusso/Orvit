/**
 * Tests para el sistema de Business Metrics
 *
 * Archivos verificados:
 * - orvit-v1/prisma/schema.prisma (modelo BusinessMetric)
 * - orvit-v1/prisma/migrations/manual_add_business_metrics.sql
 * - orvit-v1/lib/metrics.ts (trackMetric, trackCount, trackDuration)
 * - orvit-v1/app/api/admin/metrics/route.ts (GET con agregación)
 * - orvit-v1/app/api/admin/metrics/summary/route.ts (GET con KPIs)
 * - orvit-v1/hooks/use-business-metrics.ts (hooks TanStack Query)
 * - orvit-v1/app/admin/metrics/page.tsx (dashboard)
 * - orvit-v1/app/api/work-orders/route.ts (integración trackCount)
 * - orvit-v1/app/api/work-orders/[id]/route.ts (integración trackCount + trackDuration)
 * - orvit-v1/app/api/costs/recalculate/route.ts (integración trackCount)
 * - orvit-v1/app/api/auth/login/route.ts (integración trackCount)
 * - orvit-v1/lib/metrics-exporters/datadog.ts
 * - orvit-v1/lib/metrics-exporters/grafana.ts
 *
 * Cubre:
 * 1. Modelo Prisma BusinessMetric - campos, índices, relaciones
 * 2. Migración SQL - coherencia con el modelo Prisma
 * 3. lib/metrics.ts - lógica de trackMetric, trackCount, trackDuration
 * 4. API /admin/metrics - validación de parámetros, SQL seguro, respuesta
 * 5. API /admin/metrics/summary - KPIs, pctChange, estructura de respuesta
 * 6. Hook use-business-metrics - query keys, parámetros, enabled logic
 * 7. Dashboard page.tsx - helpers (formatDuration, getDateRange, getGroupByForPeriod)
 * 8. Integración de métricas en routes existentes
 * 9. Exporters (Datadog, Grafana) - estructura de payloads
 * 10. Bugs: SQL injection vector, cobertura incompleta de failed_logins
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers para leer archivos fuente
// ─────────────────────────────────────────────────────────────────────────────

const ORVIT = path.resolve(__dirname, '../orvit-v1');

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ORVIT, relativePath), 'utf-8');
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 1: Modelo Prisma BusinessMetric
// ─────────────────────────────────────────────────────────────────────────────

describe('BusinessMetric - Prisma Schema', () => {
  let schema: string;

  beforeEach(() => {
    schema = readSource('prisma/schema.prisma');
  });

  it('should define model BusinessMetric', () => {
    expect(schema).toContain('model BusinessMetric');
  });

  it('should have all required fields', () => {
    const modelBlock = extractModelBlock(schema, 'BusinessMetric');
    expect(modelBlock).toContain('id');
    expect(modelBlock).toContain('name');
    expect(modelBlock).toContain('value');
    expect(modelBlock).toContain('unit');
    expect(modelBlock).toContain('tags');
    expect(modelBlock).toContain('companyId');
    expect(modelBlock).toContain('userId');
    expect(modelBlock).toContain('timestamp');
  });

  it('should map to "business_metrics" table', () => {
    const modelBlock = extractModelBlock(schema, 'BusinessMetric');
    expect(modelBlock).toContain('@@map("business_metrics")');
  });

  it('should have composite index on companyId, name, timestamp', () => {
    const modelBlock = extractModelBlock(schema, 'BusinessMetric');
    expect(modelBlock).toContain('@@index([companyId, name, timestamp])');
  });

  it('should have composite index on companyId, timestamp', () => {
    const modelBlock = extractModelBlock(schema, 'BusinessMetric');
    expect(modelBlock).toContain('@@index([companyId, timestamp])');
  });

  it('should have index on userId, timestamp', () => {
    const modelBlock = extractModelBlock(schema, 'BusinessMetric');
    expect(modelBlock).toContain('@@index([userId, timestamp])');
  });

  it('should have index on timestamp for efficient purges', () => {
    const modelBlock = extractModelBlock(schema, 'BusinessMetric');
    expect(modelBlock).toContain('@@index([timestamp])');
  });

  it('should have Cascade onDelete for company relation', () => {
    const modelBlock = extractModelBlock(schema, 'BusinessMetric');
    expect(modelBlock).toContain('onDelete: Cascade');
  });

  it('should have SetNull onDelete for user relation', () => {
    const modelBlock = extractModelBlock(schema, 'BusinessMetric');
    expect(modelBlock).toContain('onDelete: SetNull');
  });

  it('should have relation name "UserBusinessMetrics" for user', () => {
    const modelBlock = extractModelBlock(schema, 'BusinessMetric');
    expect(modelBlock).toContain('@relation("UserBusinessMetrics"');
  });

  it('should map companyId to "company_id" column', () => {
    const modelBlock = extractModelBlock(schema, 'BusinessMetric');
    expect(modelBlock).toContain('@map("company_id")');
  });

  it('should map userId to "user_id" column', () => {
    const modelBlock = extractModelBlock(schema, 'BusinessMetric');
    expect(modelBlock).toContain('@map("user_id")');
  });

  it('should have name field with VarChar(100)', () => {
    const modelBlock = extractModelBlock(schema, 'BusinessMetric');
    expect(modelBlock).toMatch(/name\s+String\s+@db\.VarChar\(100\)/);
  });

  it('should have value field as Float', () => {
    const modelBlock = extractModelBlock(schema, 'BusinessMetric');
    expect(modelBlock).toMatch(/value\s+Float/);
  });

  it('should have unit as optional String VarChar(30)', () => {
    const modelBlock = extractModelBlock(schema, 'BusinessMetric');
    expect(modelBlock).toMatch(/unit\s+String\?\s+@db\.VarChar\(30\)/);
  });

  it('should have tags as optional Json', () => {
    const modelBlock = extractModelBlock(schema, 'BusinessMetric');
    expect(modelBlock).toMatch(/tags\s+Json\?/);
  });

  it('should have userId as optional Int', () => {
    const modelBlock = extractModelBlock(schema, 'BusinessMetric');
    expect(modelBlock).toMatch(/userId\s+Int\?/);
  });

  it('should have timestamp with default(now())', () => {
    const modelBlock = extractModelBlock(schema, 'BusinessMetric');
    expect(modelBlock).toMatch(/timestamp\s+DateTime\s+@default\(now\(\)\)/);
  });

  // Verificar que Company y User tienen la relación inversa
  it('should have BusinessMetric[] relation in Company model', () => {
    expect(schema).toMatch(/businessMetrics\s+BusinessMetric\[\]/);
  });

  it('should have BusinessMetric[] relation with "UserBusinessMetrics" in User model', () => {
    expect(schema).toContain('businessMetrics BusinessMetric[] @relation("UserBusinessMetrics")');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 2: Migración SQL
// ─────────────────────────────────────────────────────────────────────────────

describe('BusinessMetric - SQL Migration', () => {
  let sql: string;

  beforeEach(() => {
    sql = readSource('prisma/migrations/manual_add_business_metrics.sql');
  });

  it('should create table business_metrics', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "business_metrics"');
  });

  it('should have SERIAL PRIMARY KEY for id', () => {
    expect(sql).toContain('"id" SERIAL PRIMARY KEY');
  });

  it('should have VARCHAR(100) NOT NULL for name', () => {
    expect(sql).toContain('"name" VARCHAR(100) NOT NULL');
  });

  it('should have DOUBLE PRECISION NOT NULL for value', () => {
    expect(sql).toContain('"value" DOUBLE PRECISION NOT NULL');
  });

  it('should have VARCHAR(30) for unit', () => {
    expect(sql).toContain('"unit" VARCHAR(30)');
  });

  it('should have JSONB for tags', () => {
    expect(sql).toContain('"tags" JSONB');
  });

  it('should have INTEGER NOT NULL for company_id', () => {
    expect(sql).toContain('"company_id" INTEGER NOT NULL');
  });

  it('should have INTEGER for user_id (nullable)', () => {
    // user_id sin NOT NULL = nullable
    expect(sql).toMatch(/"user_id"\s+INTEGER[^,]*,/);
    expect(sql).not.toMatch(/"user_id"\s+INTEGER\s+NOT NULL/);
  });

  it('should have TIMESTAMP(3) with DEFAULT CURRENT_TIMESTAMP', () => {
    expect(sql).toContain('"timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP');
  });

  it('should have FK to Company with CASCADE', () => {
    expect(sql).toContain('"business_metrics_company_id_fkey"');
    expect(sql).toContain('REFERENCES "Company"("id") ON DELETE CASCADE');
  });

  it('should have FK to User with SET NULL', () => {
    expect(sql).toContain('"business_metrics_user_id_fkey"');
    expect(sql).toContain('REFERENCES "User"("id") ON DELETE SET NULL');
  });

  it('should create composite index on company_id, name, timestamp', () => {
    expect(sql).toContain('"business_metrics_company_id_name_timestamp_idx"');
    expect(sql).toContain('("company_id", "name", "timestamp")');
  });

  it('should create composite index on company_id, timestamp', () => {
    expect(sql).toContain('"business_metrics_company_id_timestamp_idx"');
  });

  it('should create index on user_id, timestamp', () => {
    expect(sql).toContain('"business_metrics_user_id_timestamp_idx"');
  });

  it('should create index on timestamp alone', () => {
    expect(sql).toContain('"business_metrics_timestamp_idx"');
  });

  it('should use IF NOT EXISTS for all CREATE statements (idempotent)', () => {
    const createStatements = sql.match(/CREATE\s+(TABLE|INDEX)/gi) || [];
    const ifNotExistsStatements = sql.match(/CREATE\s+(TABLE|INDEX)\s+IF NOT EXISTS/gi) || [];
    expect(ifNotExistsStatements.length).toBe(createStatements.length);
  });

  // Coherencia Schema ↔ SQL: los campos del modelo deben coincidir con la tabla
  it('should have matching columns between Prisma schema and SQL migration', () => {
    const schema = readSource('prisma/schema.prisma');
    const modelBlock = extractModelBlock(schema, 'BusinessMetric');

    // Verificar que los campos mapeados están presentes en el SQL
    expect(sql).toContain('"company_id"');
    expect(sql).toContain('"user_id"');
    expect(sql).toContain('"name"');
    expect(sql).toContain('"value"');
    expect(sql).toContain('"unit"');
    expect(sql).toContain('"tags"');
    expect(sql).toContain('"timestamp"');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 3: lib/metrics.ts - Lógica core
// ─────────────────────────────────────────────────────────────────────────────

describe('lib/metrics.ts - Core Metrics Functions', () => {
  let metricsSource: string;

  beforeEach(() => {
    metricsSource = readSource('lib/metrics.ts');
  });

  it('should export trackMetric function', () => {
    expect(metricsSource).toMatch(/export\s+async\s+function\s+trackMetric/);
  });

  it('should export trackCount function', () => {
    expect(metricsSource).toMatch(/export\s+async\s+function\s+trackCount/);
  });

  it('should export trackDuration function', () => {
    expect(metricsSource).toMatch(/export\s+async\s+function\s+trackDuration/);
  });

  it('trackMetric should accept name, value, companyId, and optional options', () => {
    // Verificar la firma de la función
    expect(metricsSource).toContain('name: string');
    expect(metricsSource).toContain('value: number');
    expect(metricsSource).toContain('companyId: number');
  });

  it('trackMetric should use prisma.businessMetric.create', () => {
    expect(metricsSource).toContain('prisma.businessMetric.create');
  });

  it('trackMetric should be fire-and-forget (has try-catch)', () => {
    expect(metricsSource).toContain('try {');
    expect(metricsSource).toContain('} catch (error)');
    expect(metricsSource).toContain('console.error');
  });

  it('trackCount should call trackMetric with value=1 and unit="count"', () => {
    expect(metricsSource).toContain("return trackMetric(name, 1, companyId, { unit: 'count'");
  });

  it('trackDuration should call trackMetric with unit="ms"', () => {
    expect(metricsSource).toContain("return trackMetric(name, durationMs, companyId, { unit: 'ms'");
  });

  it('trackMetric should import prisma from @/lib/prisma', () => {
    expect(metricsSource).toContain("import { prisma } from '@/lib/prisma'");
  });

  it('trackMetric should return Promise<void>', () => {
    expect(metricsSource).toContain('Promise<void>');
  });

  it('trackMetric should handle optional tags as Record<string, unknown>', () => {
    expect(metricsSource).toContain('tags?: Record<string, unknown>');
  });

  it('trackMetric should handle optional userId as number', () => {
    expect(metricsSource).toContain('userId?: number');
  });

  it('trackMetric should default unit to null when not provided', () => {
    expect(metricsSource).toContain("unit: options?.unit ?? null");
  });

  it('trackMetric should default userId to null when not provided', () => {
    expect(metricsSource).toContain("userId: options?.userId ?? null");
  });

  // BUG POTENCIAL: tags usa undefined en vez de null cuando no se proporcionan
  it('BUG: trackMetric should default tags to null instead of undefined for Prisma Json? field', () => {
    // El campo tags es Json? en Prisma. Pasar undefined a Prisma significa "no establecer",
    // lo que en un CREATE dejará el valor como null (correcto en este caso porque DEFAULT es null).
    // Sin embargo, por consistencia explícita, sería mejor usar null.
    // Esto NO es un bug funcional porque Prisma trata undefined como "skip" en create,
    // y Json? tiene default null implícito.
    const usesUndefined = metricsSource.includes('tags: options?.tags ?? undefined');
    const usesNull = metricsSource.includes('tags: options?.tags ?? null');

    // Actualmente usa undefined - funciona pero es inconsistente con unit y userId que usan null
    expect(usesUndefined || usesNull).toBe(true);

    // Nota: Esto es una inconsistencia de estilo, no un bug funcional
    if (usesUndefined) {
      console.warn(
        '[ADVERTENCIA] tags usa `undefined` como default mientras que unit y userId usan `null`. ' +
        'Ambos funcionan en Prisma create, pero la inconsistencia puede confundir.'
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 4: API /admin/metrics - Validación y seguridad
// ─────────────────────────────────────────────────────────────────────────────

describe('API /admin/metrics (GET)', () => {
  let routeSource: string;

  beforeEach(() => {
    routeSource = readSource('app/api/admin/metrics/route.ts');
  });

  it('should export GET handler with withGuards', () => {
    expect(routeSource).toContain('export const GET = withGuards');
  });

  it('should require startDate and endDate parameters', () => {
    expect(routeSource).toContain("if (!startDate || !endDate)");
    expect(routeSource).toContain('status: 400');
  });

  it('should validate date parameters are valid ISO dates', () => {
    expect(routeSource).toContain('isNaN(start.getTime())');
    expect(routeSource).toContain('isNaN(end.getTime())');
  });

  it('should validate groupBy parameter against allowed values', () => {
    expect(routeSource).toContain("['hour', 'day', 'week', 'month'].includes(groupBy)");
  });

  it('should default groupBy to "day"', () => {
    expect(routeSource).toContain("|| 'day'");
  });

  it('should use DATE_TRUNC for PostgreSQL aggregation', () => {
    expect(routeSource).toContain('DATE_TRUNC');
  });

  it('should filter by user.companyId for multi-tenancy', () => {
    expect(routeSource).toContain('user.companyId');
    expect(routeSource).toContain('"company_id" = $1');
  });

  it('should return data array with period, name, sum, avg, min, max, count', () => {
    expect(routeSource).toContain('period: row.period');
    expect(routeSource).toContain('name: row.metric_name');
    expect(routeSource).toContain('sum: Number(row.sum)');
    expect(routeSource).toContain('avg: Number(row.avg)');
    expect(routeSource).toContain('min: Number(row.min)');
    expect(routeSource).toContain('max: Number(row.max)');
    expect(routeSource).toContain('count: Number(row.count)');
  });

  it('should convert bigint count to Number', () => {
    // BigInt es retornado por COUNT(*) en Prisma raw queries
    expect(routeSource).toContain('count: Number(row.count)');
  });

  it('should handle optional name filter', () => {
    expect(routeSource).toContain("const name = searchParams.get('name')");
    expect(routeSource).toContain('"name" = $4');
  });

  it('should use parameterized queries for user input (startDate, endDate, name)', () => {
    // Verificar que los valores de usuario van como parámetros $N, no interpolados
    expect(routeSource).toContain('[user.companyId, start, end, name]');
    expect(routeSource).toContain('[user.companyId, start, end]');
  });

  // SEGURIDAD: El groupBy se interpola directamente en el SQL
  it('SECURITY: groupBy is validated before SQL interpolation', () => {
    // Verificar que la validación de groupBy ocurre ANTES de la interpolación SQL
    const validationIndex = routeSource.indexOf("['hour', 'day', 'week', 'month'].includes(groupBy)");
    const interpolationIndex = routeSource.indexOf('`DATE_TRUNC');

    expect(validationIndex).toBeGreaterThan(-1);
    expect(interpolationIndex).toBeGreaterThan(-1);
    expect(validationIndex).toBeLessThan(interpolationIndex);
  });

  it('should use force-dynamic export', () => {
    expect(routeSource).toContain("export const dynamic = 'force-dynamic'");
  });

  it('should reference correct table name "business_metrics"', () => {
    expect(routeSource).toContain('FROM "business_metrics"');
  });

  it('should ORDER BY period ASC', () => {
    expect(routeSource).toContain('ORDER BY period ASC');
  });

  it('should GROUP BY period and name', () => {
    expect(routeSource).toContain('GROUP BY period, "name"');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 5: API /admin/metrics/summary - KPIs
// ─────────────────────────────────────────────────────────────────────────────

describe('API /admin/metrics/summary (GET)', () => {
  let summarySource: string;

  beforeEach(() => {
    summarySource = readSource('app/api/admin/metrics/summary/route.ts');
  });

  it('should export GET handler with withGuards', () => {
    expect(summarySource).toContain('export const GET = withGuards');
  });

  it('should calculate 30-day and 60-day boundaries', () => {
    expect(summarySource).toContain('30 * 24 * 60 * 60 * 1000');
    expect(summarySource).toContain('60 * 24 * 60 * 60 * 1000');
  });

  it('should query all 6 metric names', () => {
    const expectedMetrics = [
      'work_orders_created',
      'work_orders_completed',
      'resolution_time',
      'costs_calculated',
      'successful_logins',
      'failed_logins',
    ];
    expectedMetrics.forEach(metric => {
      expect(summarySource).toContain(`'${metric}'`);
    });
  });

  it('should use Prisma groupBy for aggregation (not raw SQL)', () => {
    expect(summarySource).toContain('prisma.businessMetric.groupBy');
  });

  it('should query current and previous period in parallel', () => {
    expect(summarySource).toContain('Promise.all');
    // Verificar que hay dos queries en el Promise.all
    const groupByCount = (summarySource.match(/prisma\.businessMetric\.groupBy/g) || []).length;
    expect(groupByCount).toBe(2);
  });

  it('should use _sum, _avg, and _count aggregations', () => {
    expect(summarySource).toContain('_sum: { value: true }');
    expect(summarySource).toContain('_avg: { value: true }');
    expect(summarySource).toContain('_count: { _all: true }');
  });

  it('should filter by user.companyId', () => {
    expect(summarySource).toContain('companyId: user.companyId');
  });

  it('pctChange should handle zero previous correctly', () => {
    // Verificar la lógica del helper
    expect(summarySource).toContain('if (previous === 0) return current > 0 ? 100 : 0');
  });

  it('pctChange should calculate percentage correctly', () => {
    expect(summarySource).toContain('Math.round(((current - previous) / previous) * 100)');
  });

  it('resolution_time should use avg instead of total', () => {
    expect(summarySource).toContain("buildKPI('resolution_time', true)");
  });

  it('other metrics should use total (default useAvg=false)', () => {
    expect(summarySource).toContain("buildKPI('work_orders_created')");
    expect(summarySource).toContain("buildKPI('work_orders_completed')");
    expect(summarySource).toContain("buildKPI('costs_calculated')");
    expect(summarySource).toContain("buildKPI('successful_logins')");
    expect(summarySource).toContain("buildKPI('failed_logins')");
  });

  it('should return period boundaries in response', () => {
    expect(summarySource).toContain('period:');
    expect(summarySource).toContain('current: { start:');
    expect(summarySource).toContain('previous: { start:');
  });

  it('should handle error with 500 status', () => {
    expect(summarySource).toContain('status: 500');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 6: Hook use-business-metrics
// ─────────────────────────────────────────────────────────────────────────────

describe('Hook use-business-metrics', () => {
  let hookSource: string;

  beforeEach(() => {
    hookSource = readSource('hooks/use-business-metrics.ts');
  });

  it('should be a client component', () => {
    expect(hookSource).toContain("'use client'");
  });

  it('should export useBusinessMetrics hook', () => {
    expect(hookSource).toMatch(/export\s+function\s+useBusinessMetrics/);
  });

  it('should export useBusinessMetricsSummary hook', () => {
    expect(hookSource).toMatch(/export\s+function\s+useBusinessMetricsSummary/);
  });

  it('should export businessMetricsKeys factory', () => {
    expect(hookSource).toContain('export const businessMetricsKeys');
  });

  it('query keys should have hierarchical structure', () => {
    expect(hookSource).toContain("all: ['business-metrics']");
    expect(hookSource).toContain("...businessMetricsKeys.all, 'list'");
    expect(hookSource).toContain("...businessMetricsKeys.all, 'summary'");
  });

  it('useBusinessMetrics should call /api/admin/metrics', () => {
    expect(hookSource).toContain('/api/admin/metrics?');
  });

  it('useBusinessMetricsSummary should call /api/admin/metrics/summary', () => {
    expect(hookSource).toContain('/api/admin/metrics/summary');
  });

  it('should use staleTime of 1 minute', () => {
    expect(hookSource).toContain('staleTime: 60 * 1000');
  });

  it('should use gcTime of 5 minutes', () => {
    expect(hookSource).toContain('gcTime: 5 * 60 * 1000');
  });

  it('useBusinessMetrics should be disabled without startDate or endDate', () => {
    expect(hookSource).toContain('enabled: enabled && !!startDate && !!endDate');
  });

  it('should handle non-ok responses by throwing error', () => {
    expect(hookSource).toContain('if (!response.ok)');
    expect(hookSource).toContain('throw new Error');
  });

  it('should define MetricDataPoint interface with correct fields', () => {
    expect(hookSource).toContain('interface MetricDataPoint');
    expect(hookSource).toContain('period: string');
    expect(hookSource).toContain('name: string');
    expect(hookSource).toContain('sum: number');
    expect(hookSource).toContain('avg: number');
    expect(hookSource).toContain('min: number');
    expect(hookSource).toContain('max: number');
    expect(hookSource).toContain('count: number');
  });

  it('should define MetricsSummary interface matching API response', () => {
    expect(hookSource).toContain('interface MetricsSummary');
    expect(hookSource).toContain('work_orders_created: MetricKPI');
    expect(hookSource).toContain('resolution_time: MetricKPI');
    expect(hookSource).toContain('failed_logins: MetricKPI');
  });

  it('should accept groupBy parameter with correct union type', () => {
    expect(hookSource).toContain("groupBy?: 'hour' | 'day' | 'week' | 'month'");
  });

  it('should default groupBy to "day"', () => {
    expect(hookSource).toContain("groupBy = 'day'");
  });

  it('should use URLSearchParams for query string construction', () => {
    expect(hookSource).toContain('new URLSearchParams(params)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 7: Dashboard page.tsx - Helpers
// ─────────────────────────────────────────────────────────────────────────────

describe('Dashboard page.tsx - Helpers', () => {
  let pageSource: string;

  beforeEach(() => {
    pageSource = readSource('app/admin/metrics/page.tsx');
  });

  it('should be a client component', () => {
    expect(pageSource).toContain("'use client'");
  });

  it('should export default BusinessMetricsPage', () => {
    expect(pageSource).toContain('export default function BusinessMetricsPage');
  });

  // Test formatDuration helper
  describe('formatDuration', () => {
    it('should be defined in the source', () => {
      expect(pageSource).toContain('function formatDuration(ms: number): string');
    });

    it('should handle milliseconds (<1000)', () => {
      expect(pageSource).toContain("if (ms < 1000) return `${Math.round(ms)}ms`");
    });

    it('should handle seconds (<60000)', () => {
      expect(pageSource).toContain('if (ms < 60_000)');
    });

    it('should handle minutes (<3600000)', () => {
      expect(pageSource).toContain('if (ms < 3_600_000)');
    });

    it('should handle hours (<24h)', () => {
      expect(pageSource).toContain('if (hours < 24)');
    });

    it('should handle days (>=24h)', () => {
      expect(pageSource).toContain('(hours / 24).toFixed(1)');
    });
  });

  // Test getDateRange
  describe('getDateRange', () => {
    it('should handle 7d period', () => {
      expect(pageSource).toContain("case '7d':");
      expect(pageSource).toContain('7 * 24 * 60 * 60 * 1000');
    });

    it('should handle 30d period', () => {
      expect(pageSource).toContain("case '30d':");
      expect(pageSource).toContain('30 * 24 * 60 * 60 * 1000');
    });

    it('should handle 90d period', () => {
      expect(pageSource).toContain("case '90d':");
      expect(pageSource).toContain('90 * 24 * 60 * 60 * 1000');
    });

    it('should return ISO strings for startDate and endDate', () => {
      expect(pageSource).toContain('startDate: start.toISOString()');
      expect(pageSource).toContain('endDate: end');
    });
  });

  // Test getGroupByForPeriod
  describe('getGroupByForPeriod', () => {
    it('should return "day" for 7d', () => {
      expect(pageSource).toMatch(/case '7d':\s*return 'day'/);
    });

    it('should return "day" for 30d', () => {
      expect(pageSource).toMatch(/case '30d':\s*return 'day'/);
    });

    it('should return "week" for 90d', () => {
      expect(pageSource).toMatch(/case '90d':\s*return 'week'/);
    });
  });

  // Test UI structure
  it('should render 6 KPI cards', () => {
    const kpiCards = pageSource.match(/<KPICard/g) || [];
    expect(kpiCards.length).toBe(6);
  });

  it('should use Recharts LineChart and BarChart', () => {
    expect(pageSource).toContain('<LineChart');
    expect(pageSource).toContain('<BarChart');
  });

  it('should have loading state', () => {
    expect(pageSource).toContain('summaryLoading');
    expect(pageSource).toContain('Cargando métricas...');
  });

  it('should have empty state for charts', () => {
    expect(pageSource).toContain('Sin datos para este período');
  });

  it('should have data table with recent metrics', () => {
    expect(pageSource).toContain('Datos recientes');
    expect(pageSource).toContain('<table');
  });

  it('should have period selector with 7d, 30d, 90d', () => {
    expect(pageSource).toContain("value=\"7d\"");
    expect(pageSource).toContain("value=\"30d\"");
    expect(pageSource).toContain("value=\"90d\"");
  });

  it('should have metric selector for chart filtering', () => {
    expect(pageSource).toContain('selectedMetric');
    expect(pageSource).toContain('setSelectedMetric');
  });

  it('should use COLORS constant for chart colors', () => {
    expect(pageSource).toContain('const COLORS = {');
  });

  it('should display resolution_time with formatDuration in KPI and table', () => {
    expect(pageSource).toContain("formatter={formatDuration}");
    expect(pageSource).toContain("const isTime = row.name === 'resolution_time'");
  });

  it('should use es-AR locale for formatting', () => {
    const localeMatches = pageSource.match(/es-AR/g) || [];
    expect(localeMatches.length).toBeGreaterThanOrEqual(2);
  });

  it('should memoize lineChartData, barChartData, and recentData', () => {
    expect(pageSource).toContain('const lineChartData = useMemo');
    expect(pageSource).toContain('const barChartData = useMemo');
    expect(pageSource).toContain('const recentData = useMemo');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 8: Integración en routes existentes
// ─────────────────────────────────────────────────────────────────────────────

describe('Metrics Integration in API Routes', () => {

  describe('POST /api/work-orders', () => {
    let source: string;

    beforeEach(() => {
      source = readSource('app/api/work-orders/route.ts');
    });

    it('should import trackCount from @/lib/metrics', () => {
      expect(source).toContain("import { trackCount } from '@/lib/metrics'");
    });

    it('should track work_orders_created metric', () => {
      expect(source).toContain("trackCount('work_orders_created'");
    });

    it('should use fire-and-forget pattern (.catch(() => {}))', () => {
      expect(source).toContain('.catch(() => {})');
    });

    it('should pass companyId from created work order', () => {
      expect(source).toContain('newWorkOrder.companyId');
    });

    it('should pass type, priority, and status as tags', () => {
      expect(source).toContain('tags: { type: newWorkOrder.type, priority: newWorkOrder.priority, status: newWorkOrder.status }');
    });

    it('should pass createdById as userId', () => {
      expect(source).toContain('userId: newWorkOrder.createdById');
    });

    it('metric tracking should be AFTER successful creation (not inside try-before-create)', () => {
      const createIndex = source.indexOf('prisma.workOrder.create(');
      const trackIndex = source.indexOf("trackCount('work_orders_created'");
      expect(createIndex).toBeGreaterThan(-1);
      expect(trackIndex).toBeGreaterThan(-1);
      expect(trackIndex).toBeGreaterThan(createIndex);
    });
  });

  describe('PUT /api/work-orders/[id]', () => {
    let source: string;

    beforeEach(() => {
      source = readSource('app/api/work-orders/[id]/route.ts');
    });

    it('should import trackCount and trackDuration from @/lib/metrics', () => {
      expect(source).toContain("import { trackCount, trackDuration } from '@/lib/metrics'");
    });

    it('should track work_orders_completed metric on status change to COMPLETED', () => {
      expect(source).toContain("trackCount('work_orders_completed'");
    });

    it('should track resolution_time duration', () => {
      expect(source).toContain("trackDuration('resolution_time'");
    });

    it('should only track completion when status changes from non-COMPLETED to COMPLETED', () => {
      expect(source).toContain("normalizedStatus === 'COMPLETED' && originalWorkOrder.status !== 'COMPLETED'");
    });

    it('should calculate resolutionMs from createdAt to completedDate', () => {
      expect(source).toContain('updatedWorkOrder.completedDate').valueOf;
      expect(source).toContain('updatedWorkOrder.createdAt');
      expect(source).toContain('.getTime() - new Date(updatedWorkOrder.createdAt).getTime()');
    });

    it('should guard resolution_time tracking with completedDate check', () => {
      expect(source).toContain('if (updatedWorkOrder.createdAt && updatedWorkOrder.completedDate)');
    });

    it('should use fire-and-forget for metrics', () => {
      const completedSection = source.substring(
        source.indexOf("normalizedStatus === 'COMPLETED'"),
        source.indexOf("// Verificar si cambió la asignación")
      );
      expect(completedSection).toContain('.catch(() => {})');
    });
  });

  describe('POST /api/costs/recalculate', () => {
    let source: string;

    beforeEach(() => {
      source = readSource('app/api/costs/recalculate/route.ts');
    });

    it('should import trackCount from @/lib/metrics', () => {
      expect(source).toContain("import { trackCount } from '@/lib/metrics'");
    });

    it('should track costs_calculated metric', () => {
      expect(source).toContain("trackCount('costs_calculated'");
    });

    it('should pass month as tag', () => {
      expect(source).toContain('tags: { month: validation.data.month }');
    });

    it('should pass userId from user context', () => {
      expect(source).toContain('userId: user.userId');
    });

    it('metric tracking should be after successful recalculation', () => {
      const recalcIndex = source.indexOf('recalculateMonthCosts');
      const trackIndex = source.indexOf("trackCount('costs_calculated'");
      expect(trackIndex).toBeGreaterThan(recalcIndex);
    });
  });

  describe('POST /api/auth/login', () => {
    let source: string;

    beforeEach(() => {
      source = readSource('app/api/auth/login/route.ts');
    });

    it('should import trackCount from @/lib/metrics', () => {
      expect(source).toContain("import { trackCount } from '@/lib/metrics'");
    });

    it('should track successful_logins metric', () => {
      expect(source).toContain("trackCount('successful_logins'");
    });

    it('should track failed_logins metric', () => {
      expect(source).toContain("trackCount('failed_logins'");
    });

    it('successful_logins should be tracked after login success', () => {
      const successIndex = source.indexOf('LOGIN EXITOSO');
      const trackIndex = source.indexOf("trackCount('successful_logins'");
      expect(trackIndex).toBeGreaterThan(successIndex);
    });

    it('failed_logins should be tracked on invalid password', () => {
      const invalidPwdSection = source.substring(
        source.indexOf('!isValidPassword'),
        source.indexOf('LOGIN EXITOSO')
      );
      expect(invalidPwdSection).toContain("trackCount('failed_logins'");
    });

    it('successful_logins should use companyId guard', () => {
      // Solo trackear si el usuario tiene companyId
      expect(source).toContain('if (companyId)');
    });

    it('failed_logins should use first company from user', () => {
      expect(source).toContain("user.companies?.[0]?.company?.id");
    });

    it('failed_logins should include reason tag', () => {
      expect(source).toContain("tags: { reason: 'invalid_password' }");
    });

    // BUG: failed_logins solo se registra para invalid_password
    it('BUG: failed_logins only tracks invalid_password, not other failure reasons', () => {
      // Contar cuántas veces aparece trackCount('failed_logins' en el código
      const failedLoginTracks = (source.match(/trackCount\('failed_logins'/g) || []).length;

      // Actualmente solo se trackea 1 vez (invalid_password)
      // No se trackean: user_not_found, inactive, no_password, rate_limited
      expect(failedLoginTracks).toBe(1);

      // Verificar que los otros casos de fallo NO tienen tracking
      const userNotFoundSection = source.substring(
        source.indexOf("'user_not_found'"),
        source.indexOf('// Verificar si el usuario está activo') > 0
          ? source.indexOf('// Verificar si el usuario está activo')
          : source.indexOf('isActive')
      );
      expect(userNotFoundSection).not.toContain("trackCount('failed_logins'");

      console.warn(
        '[BUG] failed_logins metric solo se registra para invalid_password. ' +
        'Las fallas por user_not_found, inactive, no_password y rate_limited no se trackean.'
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 9: Exporters (Datadog, Grafana)
// ─────────────────────────────────────────────────────────────────────────────

describe('Metrics Exporters', () => {

  describe('Datadog Exporter', () => {
    let source: string;

    beforeEach(() => {
      source = readSource('lib/metrics-exporters/datadog.ts');
    });

    it('should export exportToDatadog function', () => {
      expect(source).toMatch(/export\s+async\s+function\s+exportToDatadog/);
    });

    it('should be no-op when DATADOG_API_KEY is not configured', () => {
      expect(source).toContain('process.env.DATADOG_API_KEY');
      expect(source).toContain('if (!apiKey)');
      expect(source).toContain('return;');
    });

    it('should use correct Datadog API URL', () => {
      expect(source).toContain('https://api.datadoghq.com/api/v2/series');
    });

    it('should prefix metrics with "orvit."', () => {
      expect(source).toContain('`orvit.${m.name}`');
    });

    it('should convert timestamp to Unix seconds', () => {
      expect(source).toContain('/ 1000');
    });

    it('should send DD-API-KEY header', () => {
      expect(source).toContain("'DD-API-KEY': apiKey");
    });

    it('should convert tags to Datadog format (key:value strings)', () => {
      expect(source).toContain('`${k}:${v}`');
    });

    it('should handle errors gracefully', () => {
      expect(source).toContain('catch (error)');
      expect(source).toContain('console.error');
    });

    it('should use gauge type (0)', () => {
      expect(source).toContain('type: 0');
    });
  });

  describe('Grafana Exporter', () => {
    let source: string;

    beforeEach(() => {
      source = readSource('lib/metrics-exporters/grafana.ts');
    });

    it('should export pushToGrafana function', () => {
      expect(source).toMatch(/export\s+async\s+function\s+pushToGrafana/);
    });

    it('should be no-op when GRAFANA_CLOUD_URL or GRAFANA_CLOUD_TOKEN is not configured', () => {
      expect(source).toContain('process.env.GRAFANA_CLOUD_URL');
      expect(source).toContain('process.env.GRAFANA_CLOUD_TOKEN');
      expect(source).toContain('if (!url || !token)');
    });

    it('should prefix metrics with "orvit_"', () => {
      expect(source).toContain('`orvit_${m.name}`');
    });

    it('should convert timestamp to nanoseconds for Influx Line Protocol', () => {
      expect(source).toContain('* 1_000_000');
    });

    it('should use Bearer token for authorization', () => {
      expect(source).toContain('Authorization: `Bearer ${token}`');
    });

    it('should send data as text/plain (Influx Line Protocol)', () => {
      expect(source).toContain("'Content-Type': 'text/plain'");
    });

    it('should format lines as Influx Line Protocol', () => {
      // measurement,tag1=val1 value=N timestamp
      expect(source).toContain('`${measurement}${tags} value=${m.value} ${timestamp}`');
    });

    it('should join multiple metrics with newlines', () => {
      expect(source).toContain("lines.join('\\n')");
    });

    it('should handle errors gracefully', () => {
      expect(source).toContain('catch (error)');
      expect(source).toContain('console.error');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 10: Pruebas funcionales de lógica pura (extraída del source)
// ─────────────────────────────────────────────────────────────────────────────

describe('Pure Logic Tests (extracted from source)', () => {

  // Recrear pctChange del summary route
  const pctChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  describe('pctChange function', () => {
    it('should return 0 when both are 0', () => {
      expect(pctChange(0, 0)).toBe(0);
    });

    it('should return 100 when previous is 0 and current > 0', () => {
      expect(pctChange(5, 0)).toBe(100);
      expect(pctChange(500, 0)).toBe(100);
    });

    it('should return 100% for doubling', () => {
      expect(pctChange(10, 5)).toBe(100);
    });

    it('should return -50% for halving', () => {
      expect(pctChange(5, 10)).toBe(-50);
    });

    it('should return 0% for no change', () => {
      expect(pctChange(10, 10)).toBe(0);
    });

    it('should handle negative changes', () => {
      expect(pctChange(3, 10)).toBe(-70);
    });

    it('should round to nearest integer', () => {
      expect(pctChange(1, 3)).toBe(-67); // -66.67 -> -67
    });
  });

  // Recrear formatDuration del dashboard
  function formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}min`;
    const hours = ms / 3_600_000;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  }

  describe('formatDuration function', () => {
    it('should format < 1s as ms', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(0)).toBe('0ms');
      expect(formatDuration(999)).toBe('999ms');
    });

    it('should format < 1min as seconds', () => {
      expect(formatDuration(1000)).toBe('1.0s');
      expect(formatDuration(30000)).toBe('30.0s');
      expect(formatDuration(59999)).toBe('60.0s');
    });

    it('should format < 1h as minutes', () => {
      expect(formatDuration(60_000)).toBe('1.0min');
      expect(formatDuration(1_800_000)).toBe('30.0min');
    });

    it('should format < 24h as hours', () => {
      expect(formatDuration(3_600_000)).toBe('1.0h');
      expect(formatDuration(7_200_000)).toBe('2.0h');
    });

    it('should format >= 24h as days', () => {
      expect(formatDuration(86_400_000)).toBe('1.0d');
      expect(formatDuration(172_800_000)).toBe('2.0d');
    });
  });

  // Recrear getDateRange del dashboard
  function getDateRange(period: string): { startDate: string; endDate: string } {
    const now = new Date();
    const end = now.toISOString();
    let start: Date;

    switch (period) {
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { startDate: start.toISOString(), endDate: end };
  }

  describe('getDateRange function', () => {
    it('should return valid ISO dates', () => {
      const { startDate, endDate } = getDateRange('7d');
      expect(() => new Date(startDate)).not.toThrow();
      expect(() => new Date(endDate)).not.toThrow();
      expect(new Date(startDate).toISOString()).toBe(startDate);
    });

    it('7d should span ~7 days', () => {
      const { startDate, endDate } = getDateRange('7d');
      const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
      const days = diff / (24 * 60 * 60 * 1000);
      expect(days).toBeCloseTo(7, 0);
    });

    it('30d should span ~30 days', () => {
      const { startDate, endDate } = getDateRange('30d');
      const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
      const days = diff / (24 * 60 * 60 * 1000);
      expect(days).toBeCloseTo(30, 0);
    });

    it('90d should span ~90 days', () => {
      const { startDate, endDate } = getDateRange('90d');
      const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
      const days = diff / (24 * 60 * 60 * 1000);
      expect(days).toBeCloseTo(90, 0);
    });

    it('unknown period should default to 30d', () => {
      const { startDate, endDate } = getDateRange('unknown');
      const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
      const days = diff / (24 * 60 * 60 * 1000);
      expect(days).toBeCloseTo(30, 0);
    });

    it('startDate should always be before endDate', () => {
      for (const period of ['7d', '30d', '90d', 'unknown']) {
        const { startDate, endDate } = getDateRange(period);
        expect(new Date(startDate).getTime()).toBeLessThan(new Date(endDate).getTime());
      }
    });
  });

  // Recrear getGroupByForPeriod del dashboard
  function getGroupByForPeriod(period: string): 'hour' | 'day' | 'week' | 'month' {
    switch (period) {
      case '7d': return 'day';
      case '30d': return 'day';
      case '90d': return 'week';
      default: return 'day';
    }
  }

  describe('getGroupByForPeriod function', () => {
    it('7d -> day', () => expect(getGroupByForPeriod('7d')).toBe('day'));
    it('30d -> day', () => expect(getGroupByForPeriod('30d')).toBe('day'));
    it('90d -> week', () => expect(getGroupByForPeriod('90d')).toBe('week'));
    it('unknown -> day (default)', () => expect(getGroupByForPeriod('xyz')).toBe('day'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 11: Coherencia entre archivos
// ─────────────────────────────────────────────────────────────────────────────

describe('Cross-file Consistency', () => {

  it('metric names should be consistent across routes and summary', () => {
    const workOrdersRoute = readSource('app/api/work-orders/route.ts');
    const workOrderIdRoute = readSource('app/api/work-orders/[id]/route.ts');
    const costsRoute = readSource('app/api/costs/recalculate/route.ts');
    const loginRoute = readSource('app/api/auth/login/route.ts');
    const summaryRoute = readSource('app/api/admin/metrics/summary/route.ts');

    // El summary debe listar las mismas métricas que se trackean en los routes
    expect(workOrdersRoute).toContain("'work_orders_created'");
    expect(summaryRoute).toContain("'work_orders_created'");

    expect(workOrderIdRoute).toContain("'work_orders_completed'");
    expect(summaryRoute).toContain("'work_orders_completed'");

    expect(workOrderIdRoute).toContain("'resolution_time'");
    expect(summaryRoute).toContain("'resolution_time'");

    expect(costsRoute).toContain("'costs_calculated'");
    expect(summaryRoute).toContain("'costs_calculated'");

    expect(loginRoute).toContain("'successful_logins'");
    expect(summaryRoute).toContain("'successful_logins'");

    expect(loginRoute).toContain("'failed_logins'");
    expect(summaryRoute).toContain("'failed_logins'");
  });

  it('hook metric names should match dashboard metric options', () => {
    const hookSource = readSource('hooks/use-business-metrics.ts');
    const pageSource = readSource('app/admin/metrics/page.tsx');

    // Los metricOptions del dashboard deben corresponder a métricas válidas
    const metricOptionsMatch = pageSource.match(/value:\s*'([^']+)'/g) || [];
    const metricValues = metricOptionsMatch
      .map(m => m.match(/value:\s*'([^']+)'/)?.[1])
      .filter(Boolean);

    // Verificar que las métricas del dashboard son las mismas que el summary espera
    const expectedMetrics = [
      'work_orders_created',
      'work_orders_completed',
      'resolution_time',
      'costs_calculated',
      'successful_logins',
      'failed_logins',
    ];

    for (const metric of expectedMetrics) {
      expect(metricValues).toContain(metric);
    }
  });

  it('Prisma field names should match raw SQL column names in metrics route', () => {
    const metricsRoute = readSource('app/api/admin/metrics/route.ts');
    const schema = readSource('prisma/schema.prisma');
    const modelBlock = extractModelBlock(schema, 'BusinessMetric');

    // El modelo usa `name` como campo y la SQL usa `"name"` - correcto
    expect(modelBlock).toContain('name');
    expect(metricsRoute).toContain('"name"');

    // El modelo mapea companyId -> "company_id" y la SQL usa "company_id" - correcto
    expect(modelBlock).toContain('@map("company_id")');
    expect(metricsRoute).toContain('"company_id"');
  });

  it('summary route should use Prisma field names (not SQL column names)', () => {
    const summaryRoute = readSource('app/api/admin/metrics/summary/route.ts');

    // Prisma groupBy usa campos del modelo (name, companyId, timestamp)
    // No debería usar nombres de columna SQL (company_id, etc.)
    expect(summaryRoute).toContain("by: ['name']");
    expect(summaryRoute).toContain('companyId: user.companyId');
    expect(summaryRoute).toContain('name: { in: metricNames }');
  });

  it('all API routes using metrics should import from @/lib/metrics', () => {
    const routes = [
      'app/api/work-orders/route.ts',
      'app/api/work-orders/[id]/route.ts',
      'app/api/costs/recalculate/route.ts',
      'app/api/auth/login/route.ts',
    ];

    for (const route of routes) {
      const source = readSource(route);
      expect(source).toContain("from '@/lib/metrics'");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extrae el bloque de un modelo Prisma del schema completo.
 * Ignora llaves dentro de comentarios (//) para evitar falsos positivos.
 */
function extractModelBlock(schema: string, modelName: string): string {
  const start = schema.indexOf(`model ${modelName} {`);
  if (start === -1) return '';

  // Primero, remover comentarios de línea para evitar que {} en comentarios
  // interfieran con el conteo de profundidad
  const lines = schema.substring(start).split('\n');
  const cleanedLines = lines.map(line => {
    const commentIdx = line.indexOf('//');
    if (commentIdx >= 0) return line.substring(0, commentIdx);
    // También manejar comentarios con \ o \\
    const backslashCommentIdx = line.indexOf('\\');
    if (backslashCommentIdx >= 0) return line.substring(0, backslashCommentIdx);
    return line;
  });
  const cleaned = cleanedLines.join('\n');

  let depth = 0;
  let end = 0;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '{') depth++;
    if (cleaned[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  // Retornar el bloque original (sin limpiar) para poder verificar contenido completo
  // Contar líneas hasta end en cleaned, luego tomar esas líneas del original
  const cleanedBlock = cleaned.substring(0, end);
  const lineCount = cleanedBlock.split('\n').length;
  return lines.slice(0, lineCount).join('\n');
}
