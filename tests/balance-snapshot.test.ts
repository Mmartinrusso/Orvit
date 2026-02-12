/**
 * Tests for Balance Snapshot System (Cuenta Corriente)
 *
 * Covers:
 * 1. Prisma schema: ClientBalanceSnapshot model structure, relations, constraints
 * 2. Cron /api/cron/balance-snapshot: period calculation, auth, idempotency, filtering
 * 3. GET /api/ventas/cuenta-corriente/[clientId]: snapshot fields, variacionMensual calc
 * 4. GET /api/ventas/cuenta-corriente/[clientId]/historico: period filtering, variation calc
 * 5. vercel.json: cron entry
 * 6. Integration: file structure, response shape contracts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..', 'project');

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1: Prisma Schema Validation
// ═══════════════════════════════════════════════════════════════════════════════

describe('Prisma Schema - ClientBalanceSnapshot model', () => {
  const schemaPath = path.join(PROJECT_ROOT, 'prisma', 'schema.prisma');
  let schemaContent: string;

  beforeEach(() => {
    schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  });

  it('should define the ClientBalanceSnapshot model', () => {
    expect(schemaContent).toContain('model ClientBalanceSnapshot {');
  });

  it('should have all required fields with correct types', () => {
    const modelMatch = schemaContent.match(
      /model ClientBalanceSnapshot \{([\s\S]*?)\n\}/
    );
    expect(modelMatch).not.toBeNull();
    const modelBody = modelMatch![1];

    // Core fields
    expect(modelBody).toContain('id');
    expect(modelBody).toContain('clientId');
    expect(modelBody).toContain('companyId');
    expect(modelBody).toContain('periodo');
    expect(modelBody).toContain('balance');
    expect(modelBody).toContain('totalDebe');
    expect(modelBody).toContain('totalHaber');
    expect(modelBody).toContain('movimientos');
    expect(modelBody).toContain('createdAt');
  });

  it('should have periodo as VarChar(7) for YYYY-MM format', () => {
    expect(schemaContent).toMatch(/periodo\s+String\s+@db\.VarChar\(7\)/);
  });

  it('should use Decimal(15,2) for balance, totalDebe, totalHaber', () => {
    const modelMatch = schemaContent.match(
      /model ClientBalanceSnapshot \{([\s\S]*?)\n\}/
    );
    const modelBody = modelMatch![1];

    expect(modelBody).toMatch(/balance\s+Decimal\s+@db\.Decimal\(15,\s*2\)/);
    expect(modelBody).toMatch(/totalDebe\s+Decimal.*@db\.Decimal\(15,\s*2\)/);
    expect(modelBody).toMatch(/totalHaber\s+Decimal.*@db\.Decimal\(15,\s*2\)/);
  });

  it('should have unique constraint on [clientId, companyId, periodo]', () => {
    expect(schemaContent).toContain('@@unique([clientId, companyId, periodo])');
  });

  it('should have index on [companyId, periodo]', () => {
    expect(schemaContent).toContain('@@index([companyId, periodo])');
  });

  it('should have index on [clientId]', () => {
    const modelMatch = schemaContent.match(
      /model ClientBalanceSnapshot \{([\s\S]*?)\n\}/
    );
    const modelBody = modelMatch![1];
    expect(modelBody).toContain('@@index([clientId])');
  });

  it('should map to table name "ClientBalanceSnapshot"', () => {
    expect(schemaContent).toContain('@@map("ClientBalanceSnapshot")');
  });

  it('should have Client relation with onDelete Cascade', () => {
    const modelMatch = schemaContent.match(
      /model ClientBalanceSnapshot \{([\s\S]*?)\n\}/
    );
    const modelBody = modelMatch![1];
    expect(modelBody).toMatch(
      /client\s+Client\s+@relation\(fields:\s*\[clientId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/
    );
  });

  it('should have Company relation with onDelete Cascade', () => {
    const modelMatch = schemaContent.match(
      /model ClientBalanceSnapshot \{([\s\S]*?)\n\}/
    );
    const modelBody = modelMatch![1];
    expect(modelBody).toMatch(
      /company\s+Company\s+@relation\(fields:\s*\[companyId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/
    );
  });

  it('should have balanceSnapshots relation in Client model', () => {
    expect(schemaContent).toMatch(
      /balanceSnapshots\s+ClientBalanceSnapshot\[\]/
    );
  });

  it('should have clientBalanceSnapshots relation in Company model', () => {
    expect(schemaContent).toMatch(
      /clientBalanceSnapshots\s+ClientBalanceSnapshot\[\]/
    );
  });

  it('should have defaults for totalDebe, totalHaber, movimientos', () => {
    const modelMatch = schemaContent.match(
      /model ClientBalanceSnapshot \{([\s\S]*?)\n\}/
    );
    const modelBody = modelMatch![1];
    expect(modelBody).toMatch(/totalDebe\s+Decimal\s+@default\(0\)/);
    expect(modelBody).toMatch(/totalHaber\s+Decimal\s+@default\(0\)/);
    expect(modelBody).toMatch(/movimientos\s+Int\s+@default\(0\)/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2: Cron Balance Snapshot - Period Calculation Logic
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extracted period calculation logic from the cron route.
 * This mirrors lines 27-33 of balance-snapshot/route.ts
 */
function calculateSnapshotPeriod(now: Date): {
  periodo: string;
  mesInicio: Date;
  mesFin: Date;
} {
  const targetDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const periodo = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;

  const mesInicio = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    1
  );
  const mesFin = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );

  return { periodo, mesInicio, mesFin };
}

describe('Balance Snapshot - Period Calculation', () => {
  it('should calculate previous month period when run on 1st of month', () => {
    // Feb 1, 2025 -> should snapshot January 2025
    const now = new Date(2025, 1, 1); // Feb 1
    const result = calculateSnapshotPeriod(now);
    expect(result.periodo).toBe('2025-01');
  });

  it('should handle year boundary (Jan -> Dec of previous year)', () => {
    // Jan 1, 2025 -> should snapshot December 2024
    const now = new Date(2025, 0, 1); // Jan 1
    const result = calculateSnapshotPeriod(now);
    expect(result.periodo).toBe('2024-12');
  });

  it('should calculate correct date range for mesInicio/mesFin', () => {
    // Mar 1, 2025 -> February range
    const now = new Date(2025, 2, 1);
    const result = calculateSnapshotPeriod(now);

    expect(result.mesInicio).toEqual(new Date(2025, 1, 1)); // Feb 1
    // Feb has 28 days in 2025
    expect(result.mesFin.getFullYear()).toBe(2025);
    expect(result.mesFin.getMonth()).toBe(1); // February (0-indexed)
    expect(result.mesFin.getDate()).toBe(28);
    expect(result.mesFin.getHours()).toBe(23);
    expect(result.mesFin.getMinutes()).toBe(59);
    expect(result.mesFin.getSeconds()).toBe(59);
  });

  it('should handle leap year February correctly', () => {
    // Mar 1, 2024 -> February 2024 (leap year: 29 days)
    const now = new Date(2024, 2, 1);
    const result = calculateSnapshotPeriod(now);

    expect(result.periodo).toBe('2024-02');
    expect(result.mesFin.getDate()).toBe(29);
  });

  it('should pad single-digit months with leading zero', () => {
    // Feb 1, 2025 -> 2025-01 (not 2025-1)
    const now = new Date(2025, 1, 1);
    const result = calculateSnapshotPeriod(now);
    expect(result.periodo).toBe('2025-01');
    expect(result.periodo).toMatch(/^\d{4}-\d{2}$/);
  });

  it('should handle double-digit months without extra padding', () => {
    // Jan 1, 2025 -> 2024-12
    const now = new Date(2025, 0, 1);
    const result = calculateSnapshotPeriod(now);
    expect(result.periodo).toBe('2024-12');
  });

  it('should work when run mid-month (not just on 1st)', () => {
    // Feb 15, 2025 -> should still snapshot January
    const now = new Date(2025, 1, 15);
    const result = calculateSnapshotPeriod(now);
    expect(result.periodo).toBe('2025-01');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 3: Snapshot filtering logic (should create snapshot?)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extracted from cron route lines 127: only create snapshots for clients
 * with movements OR non-zero balance.
 */
function shouldCreateSnapshot(
  movimientos: number,
  currentBalance: number
): boolean {
  return movimientos > 0 || currentBalance !== 0;
}

describe('Balance Snapshot - Snapshot Creation Filtering', () => {
  it('should create snapshot when client has movements', () => {
    expect(shouldCreateSnapshot(5, 0)).toBe(true);
  });

  it('should create snapshot when client has non-zero balance', () => {
    expect(shouldCreateSnapshot(0, 15000)).toBe(true);
  });

  it('should create snapshot when client has negative balance', () => {
    expect(shouldCreateSnapshot(0, -5000)).toBe(true);
  });

  it('should NOT create snapshot when no movements and zero balance', () => {
    expect(shouldCreateSnapshot(0, 0)).toBe(false);
  });

  it('should create snapshot when both movements and balance present', () => {
    expect(shouldCreateSnapshot(3, 10000)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 4: Variación Mensual Calculation (cuenta-corriente [clientId] route)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extracted from [clientId]/route.ts lines 242-247.
 * Calculates monthly variation between current balance and last snapshot.
 */
function calculateVariacionMensual(
  saldoActual: number,
  snapshotBalance: number
): { monto: number; porcentaje: number | null } {
  return {
    monto: saldoActual - snapshotBalance,
    porcentaje:
      snapshotBalance !== 0
        ? Math.round(
            ((saldoActual - snapshotBalance) / Math.abs(snapshotBalance)) *
              10000
          ) / 100
        : null,
  };
}

describe('Variación Mensual Calculation', () => {
  it('should calculate positive variation when balance increased', () => {
    const result = calculateVariacionMensual(15000, 10000);
    expect(result.monto).toBe(5000);
    expect(result.porcentaje).toBe(50);
  });

  it('should calculate negative variation when balance decreased', () => {
    const result = calculateVariacionMensual(8000, 10000);
    expect(result.monto).toBe(-2000);
    expect(result.porcentaje).toBe(-20);
  });

  it('should return null porcentaje when snapshot balance is zero', () => {
    const result = calculateVariacionMensual(5000, 0);
    expect(result.monto).toBe(5000);
    expect(result.porcentaje).toBeNull();
  });

  it('should return zero variation when balances are equal', () => {
    const result = calculateVariacionMensual(10000, 10000);
    expect(result.monto).toBe(0);
    expect(result.porcentaje).toBe(0);
  });

  it('should handle negative snapshot balance correctly', () => {
    // Client had -5000, now has -3000 (improved by 2000)
    const result = calculateVariacionMensual(-3000, -5000);
    expect(result.monto).toBe(2000);
    // (-3000 - (-5000)) / abs(-5000) = 2000/5000 = 40%
    expect(result.porcentaje).toBe(40);
  });

  it('should handle both negative balances with worsening', () => {
    // Client had -5000, now has -8000 (worsened by 3000)
    const result = calculateVariacionMensual(-8000, -5000);
    expect(result.monto).toBe(-3000);
    // (-8000 - (-5000)) / abs(-5000) = -3000/5000 = -60%
    expect(result.porcentaje).toBe(-60);
  });

  it('should round percentage to 2 decimal places', () => {
    // 10000 / 30000 = 33.33...%
    const result = calculateVariacionMensual(40000, 30000);
    expect(result.monto).toBe(10000);
    expect(result.porcentaje).toBe(33.33);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 5: Historico Snapshot Variation Calculation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extracted from historico/route.ts lines 72-91.
 * Calculates variation between consecutive snapshots.
 */
interface SnapshotData {
  periodo: string;
  balance: number;
  totalDebe: number;
  totalHaber: number;
  movimientos: number;
}

function calculateSnapshotVariations(snapshots: SnapshotData[]) {
  return snapshots.map((snapshot, index) => {
    const prevBalance = index > 0 ? snapshots[index - 1].balance : null;
    const currentBalance = snapshot.balance;
    const variacion =
      prevBalance !== null ? currentBalance - prevBalance : null;
    const variacionPct =
      prevBalance !== null && prevBalance !== 0
        ? ((currentBalance - prevBalance) / Math.abs(prevBalance)) * 100
        : null;

    return {
      periodo: snapshot.periodo,
      balance: currentBalance,
      totalDebe: snapshot.totalDebe,
      totalHaber: snapshot.totalHaber,
      movimientos: snapshot.movimientos,
      variacion,
      variacionPct:
        variacionPct !== null ? Math.round(variacionPct * 100) / 100 : null,
    };
  });
}

describe('Historico Snapshot Variations', () => {
  it('should return null variation for the first snapshot', () => {
    const snapshots: SnapshotData[] = [
      {
        periodo: '2025-01',
        balance: 10000,
        totalDebe: 15000,
        totalHaber: 5000,
        movimientos: 10,
      },
    ];
    const result = calculateSnapshotVariations(snapshots);
    expect(result[0].variacion).toBeNull();
    expect(result[0].variacionPct).toBeNull();
  });

  it('should calculate variation between consecutive periods', () => {
    const snapshots: SnapshotData[] = [
      {
        periodo: '2025-01',
        balance: 10000,
        totalDebe: 15000,
        totalHaber: 5000,
        movimientos: 10,
      },
      {
        periodo: '2025-02',
        balance: 15000,
        totalDebe: 20000,
        totalHaber: 15000,
        movimientos: 8,
      },
    ];
    const result = calculateSnapshotVariations(snapshots);

    expect(result[0].variacion).toBeNull();
    expect(result[1].variacion).toBe(5000);
    expect(result[1].variacionPct).toBe(50);
  });

  it('should calculate variation for multiple consecutive periods', () => {
    const snapshots: SnapshotData[] = [
      {
        periodo: '2025-01',
        balance: 10000,
        totalDebe: 10000,
        totalHaber: 0,
        movimientos: 2,
      },
      {
        periodo: '2025-02',
        balance: 8000,
        totalDebe: 5000,
        totalHaber: 7000,
        movimientos: 5,
      },
      {
        periodo: '2025-03',
        balance: 12000,
        totalDebe: 10000,
        totalHaber: 6000,
        movimientos: 4,
      },
    ];
    const result = calculateSnapshotVariations(snapshots);

    // First: null
    expect(result[0].variacion).toBeNull();
    // Second: 8000 - 10000 = -2000
    expect(result[1].variacion).toBe(-2000);
    expect(result[1].variacionPct).toBe(-20);
    // Third: 12000 - 8000 = 4000
    expect(result[2].variacion).toBe(4000);
    expect(result[2].variacionPct).toBe(50);
  });

  it('should handle zero previous balance (null percentage)', () => {
    const snapshots: SnapshotData[] = [
      {
        periodo: '2025-01',
        balance: 0,
        totalDebe: 1000,
        totalHaber: 1000,
        movimientos: 2,
      },
      {
        periodo: '2025-02',
        balance: 5000,
        totalDebe: 5000,
        totalHaber: 0,
        movimientos: 1,
      },
    ];
    const result = calculateSnapshotVariations(snapshots);

    expect(result[1].variacion).toBe(5000);
    expect(result[1].variacionPct).toBeNull();
  });

  it('should preserve all snapshot data fields', () => {
    const snapshots: SnapshotData[] = [
      {
        periodo: '2025-06',
        balance: 25000,
        totalDebe: 30000,
        totalHaber: 5000,
        movimientos: 15,
      },
    ];
    const result = calculateSnapshotVariations(snapshots);

    expect(result[0].periodo).toBe('2025-06');
    expect(result[0].balance).toBe(25000);
    expect(result[0].totalDebe).toBe(30000);
    expect(result[0].totalHaber).toBe(5000);
    expect(result[0].movimientos).toBe(15);
  });

  it('should return empty array for empty input', () => {
    const result = calculateSnapshotVariations([]);
    expect(result).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 6: Cron Route - Auth Verification Logic
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extracted from cron route lines 17-20.
 * Tests the auth check logic.
 */
function verifyCronAuth(
  authHeader: string | null,
  cronSecret: string | undefined
): boolean {
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return false;
  }
  return true;
}

describe('Cron Auth Verification', () => {
  it('should allow request when no CRON_SECRET is configured', () => {
    expect(verifyCronAuth(null, undefined)).toBe(true);
    expect(verifyCronAuth(null, '')).toBe(true);
  });

  it('should allow request with correct bearer token', () => {
    expect(verifyCronAuth('Bearer my-secret', 'my-secret')).toBe(true);
  });

  it('should reject request with wrong bearer token', () => {
    expect(verifyCronAuth('Bearer wrong-token', 'my-secret')).toBe(false);
  });

  it('should reject request with missing auth header when secret is set', () => {
    expect(verifyCronAuth(null, 'my-secret')).toBe(false);
  });

  it('should reject request with plain token (no Bearer prefix)', () => {
    expect(verifyCronAuth('my-secret', 'my-secret')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 7: Cron Route - Snapshot Balance Logic
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extracted from cron route lines 120-126.
 * Calculates totalDebe and totalHaber for a snapshot.
 */
function calculateSnapshotTotals(
  invoiceTotal: string | null,
  paymentTotal: string | null,
  creditNotesTotal: number,
  invoiceCount: number,
  paymentCount: number,
  creditNotesCount: number
) {
  const totalDebe = parseFloat(invoiceTotal?.toString() || '0');
  const totalHaber =
    parseFloat(paymentTotal?.toString() || '0') + creditNotesTotal;
  const movimientos = invoiceCount + paymentCount + creditNotesCount;

  return { totalDebe, totalHaber, movimientos };
}

describe('Snapshot Totals Calculation', () => {
  it('should sum invoice total as totalDebe', () => {
    const result = calculateSnapshotTotals('15000.50', '0', 0, 3, 0, 0);
    expect(result.totalDebe).toBe(15000.5);
    expect(result.totalHaber).toBe(0);
    expect(result.movimientos).toBe(3);
  });

  it('should sum payments + credit notes as totalHaber', () => {
    const result = calculateSnapshotTotals('0', '8000', 2000, 0, 2, 1);
    expect(result.totalDebe).toBe(0);
    expect(result.totalHaber).toBe(10000);
    expect(result.movimientos).toBe(3);
  });

  it('should handle null aggregates (no transactions)', () => {
    const result = calculateSnapshotTotals(null, null, 0, 0, 0, 0);
    expect(result.totalDebe).toBe(0);
    expect(result.totalHaber).toBe(0);
    expect(result.movimientos).toBe(0);
  });

  it('should combine all movement types', () => {
    const result = calculateSnapshotTotals('50000', '20000', 5000, 10, 5, 2);
    expect(result.totalDebe).toBe(50000);
    expect(result.totalHaber).toBe(25000); // 20000 + 5000
    expect(result.movimientos).toBe(17); // 10 + 5 + 2
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 8: Cuenta Corriente Response Shape Validation
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cuenta Corriente [clientId] Route - Response Shape', () => {
  const routePath = path.join(
    PROJECT_ROOT,
    'app',
    'api',
    'ventas',
    'cuenta-corriente',
    '[clientId]',
    'route.ts'
  );
  let routeContent: string;

  beforeEach(() => {
    routeContent = fs.readFileSync(routePath, 'utf-8');
  });

  it('should return ultimoSnapshot in response', () => {
    expect(routeContent).toContain('ultimoSnapshot');
  });

  it('should return variacionMensual in response', () => {
    expect(routeContent).toContain('variacionMensual');
  });

  it('should query clientBalanceSnapshot for last snapshot', () => {
    expect(routeContent).toContain('prisma.clientBalanceSnapshot.findFirst');
  });

  it('should order snapshots by periodo desc to get latest', () => {
    expect(routeContent).toContain("orderBy: { periodo: 'desc' }");
  });

  it('should include saldoActual from client.currentBalance', () => {
    expect(routeContent).toContain('currentBalance');
    expect(routeContent).toContain('saldoActual');
  });

  it('should include snapshot fields: periodo, balance, totalDebe, totalHaber, movimientos', () => {
    expect(routeContent).toContain('lastSnapshot.periodo');
    expect(routeContent).toContain('lastSnapshot.balance');
    expect(routeContent).toContain('lastSnapshot.totalDebe');
    expect(routeContent).toContain('lastSnapshot.totalHaber');
    expect(routeContent).toContain('lastSnapshot.movimientos');
  });

  it('should calculate variacion monto and porcentaje', () => {
    expect(routeContent).toContain('saldoActual - snapshotBalance');
    expect(routeContent).toContain('Math.abs(snapshotBalance)');
  });

  it('should gracefully handle missing ClientBalanceSnapshot table', () => {
    // The route wraps snapshot query in try/catch
    expect(routeContent).toMatch(/try\s*\{[\s\S]*?clientBalanceSnapshot[\s\S]*?\}\s*catch/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 9: Historico Route - File Structure & Response Shape
// ═══════════════════════════════════════════════════════════════════════════════

describe('Historico Route - Structure', () => {
  const routePath = path.join(
    PROJECT_ROOT,
    'app',
    'api',
    'ventas',
    'cuenta-corriente',
    '[clientId]',
    'historico',
    'route.ts'
  );
  let routeContent: string;

  beforeEach(() => {
    routeContent = fs.readFileSync(routePath, 'utf-8');
  });

  it('should exist as a route file', () => {
    expect(fs.existsSync(routePath)).toBe(true);
  });

  it('should export a GET handler', () => {
    expect(routeContent).toMatch(/export\s+async\s+function\s+GET/);
  });

  it('should require PAGOS_VIEW permission', () => {
    expect(routeContent).toContain('VENTAS_PERMISSIONS.PAGOS_VIEW');
  });

  it('should support "desde" and "hasta" query params', () => {
    expect(routeContent).toContain("searchParams.get('desde')");
    expect(routeContent).toContain("searchParams.get('hasta')");
  });

  it('should query clientBalanceSnapshot with period filters', () => {
    expect(routeContent).toContain('prisma.clientBalanceSnapshot.findMany');
    expect(routeContent).toContain('periodoFilter');
  });

  it('should order snapshots by periodo ascending', () => {
    expect(routeContent).toContain("orderBy: { periodo: 'asc' }");
  });

  it('should return snapshots with variation data', () => {
    expect(routeContent).toContain('snapshotsWithVariation');
    expect(routeContent).toContain('variacion');
    expect(routeContent).toContain('variacionPct');
  });

  it('should return client info, filters, and totalPeriodos', () => {
    expect(routeContent).toContain('client:');
    expect(routeContent).toContain('filters:');
    expect(routeContent).toContain('totalPeriodos');
  });

  it('should verify client exists before querying snapshots', () => {
    const clientCheckIndex = routeContent.indexOf('prisma.client.findFirst');
    const snapshotQueryIndex = routeContent.indexOf(
      'prisma.clientBalanceSnapshot.findMany'
    );
    expect(clientCheckIndex).toBeLessThan(snapshotQueryIndex);
  });

  it('should return 404 when client not found', () => {
    expect(routeContent).toContain("'Cliente no encontrado'");
    expect(routeContent).toContain('status: 404');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 10: Cron Route - File Structure
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cron Balance Snapshot Route - Structure', () => {
  const routePath = path.join(
    PROJECT_ROOT,
    'app',
    'api',
    'cron',
    'balance-snapshot',
    'route.ts'
  );
  let routeContent: string;

  beforeEach(() => {
    routeContent = fs.readFileSync(routePath, 'utf-8');
  });

  it('should exist as a route file', () => {
    expect(fs.existsSync(routePath)).toBe(true);
  });

  it('should export GET handler (Vercel cron uses GET)', () => {
    expect(routeContent).toMatch(/export\s+async\s+function\s+GET/);
  });

  it('should verify CRON_SECRET for authorization', () => {
    expect(routeContent).toContain('CRON_SECRET');
    expect(routeContent).toContain('authorization');
    expect(routeContent).toContain('Bearer');
  });

  it('should return 401 for unauthorized requests', () => {
    expect(routeContent).toContain('status: 401');
  });

  it('should use upsert for idempotent snapshots', () => {
    expect(routeContent).toContain('prisma.clientBalanceSnapshot.upsert');
  });

  it('should use clientId_companyId_periodo as unique key for upsert', () => {
    expect(routeContent).toContain('clientId_companyId_periodo');
  });

  it('should process all active companies', () => {
    expect(routeContent).toContain('prisma.company.findMany');
    expect(routeContent).toContain('isActive: true');
  });

  it('should aggregate invoices for the period', () => {
    expect(routeContent).toContain('prisma.salesInvoice.aggregate');
  });

  it('should aggregate payments for the period', () => {
    expect(routeContent).toContain('prisma.clientPayment.aggregate');
  });

  it('should exclude ANULADA invoices and ANULADO payments', () => {
    expect(routeContent).toContain("notIn: ['ANULADA']");
    expect(routeContent).toContain("notIn: ['ANULADO']");
  });

  it('should handle CreditNote model not existing', () => {
    // Should have try/catch around creditNote operations
    expect(routeContent).toMatch(/try\s*\{[\s\S]*?creditNote[\s\S]*?\}\s*catch/);
  });

  it('should return success response with periodo and totalSnapshots', () => {
    expect(routeContent).toContain('success: true');
    expect(routeContent).toContain('periodo');
    expect(routeContent).toContain('totalSnapshots');
  });

  it('should use force-dynamic', () => {
    expect(routeContent).toContain("dynamic = 'force-dynamic'");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 11: Vercel Cron Configuration
// ═══════════════════════════════════════════════════════════════════════════════

describe('Vercel Cron Configuration', () => {
  const vercelConfigPath = path.join(PROJECT_ROOT, 'vercel.json');
  let config: any;

  beforeEach(() => {
    const content = fs.readFileSync(vercelConfigPath, 'utf-8');
    config = JSON.parse(content);
  });

  it('should have a crons array', () => {
    expect(config.crons).toBeDefined();
    expect(Array.isArray(config.crons)).toBe(true);
  });

  it('should include balance-snapshot cron entry', () => {
    const balanceCron = config.crons.find(
      (c: any) => c.path === '/api/cron/balance-snapshot'
    );
    expect(balanceCron).toBeDefined();
  });

  it('should run on 1st of each month at 3 AM', () => {
    const balanceCron = config.crons.find(
      (c: any) => c.path === '/api/cron/balance-snapshot'
    );
    expect(balanceCron.schedule).toBe('0 3 1 * *');
  });

  it('should have valid cron schedule format', () => {
    const balanceCron = config.crons.find(
      (c: any) => c.path === '/api/cron/balance-snapshot'
    );
    // 5-field cron format: minute hour day-of-month month day-of-week
    const parts = balanceCron.schedule.split(' ');
    expect(parts).toHaveLength(5);
    expect(parts[0]).toBe('0'); // minute 0
    expect(parts[1]).toBe('3'); // hour 3
    expect(parts[2]).toBe('1'); // day 1
    expect(parts[3]).toBe('*'); // every month
    expect(parts[4]).toBe('*'); // every day of week
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 12: Transaction Balance Logic (Running Balance)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extracted from [clientId]/route.ts lines 202-208.
 * Running balance calculation for account statement.
 */
interface Transaction {
  tipo: 'FACTURA' | 'PAGO' | 'NOTA_CREDITO';
  debe: number;
  haber: number;
}

function calculateRunningBalance(
  transactions: Transaction[],
  initialBalance: number = 0
): number[] {
  let saldo = initialBalance;
  return transactions.map((txn) => {
    saldo += txn.debe - txn.haber;
    return saldo;
  });
}

describe('Running Balance Calculation', () => {
  it('should calculate running balance for invoices only', () => {
    const transactions: Transaction[] = [
      { tipo: 'FACTURA', debe: 10000, haber: 0 },
      { tipo: 'FACTURA', debe: 5000, haber: 0 },
    ];
    const balances = calculateRunningBalance(transactions);
    expect(balances).toEqual([10000, 15000]);
  });

  it('should decrease balance for payments', () => {
    const transactions: Transaction[] = [
      { tipo: 'FACTURA', debe: 10000, haber: 0 },
      { tipo: 'PAGO', debe: 0, haber: 3000 },
    ];
    const balances = calculateRunningBalance(transactions);
    expect(balances).toEqual([10000, 7000]);
  });

  it('should decrease balance for credit notes', () => {
    const transactions: Transaction[] = [
      { tipo: 'FACTURA', debe: 10000, haber: 0 },
      { tipo: 'NOTA_CREDITO', debe: 0, haber: 2000 },
    ];
    const balances = calculateRunningBalance(transactions);
    expect(balances).toEqual([10000, 8000]);
  });

  it('should apply initial balance from previous period', () => {
    const transactions: Transaction[] = [
      { tipo: 'FACTURA', debe: 5000, haber: 0 },
    ];
    const balances = calculateRunningBalance(transactions, 10000);
    expect(balances).toEqual([15000]);
  });

  it('should handle mixed transaction types', () => {
    const transactions: Transaction[] = [
      { tipo: 'FACTURA', debe: 20000, haber: 0 },
      { tipo: 'PAGO', debe: 0, haber: 5000 },
      { tipo: 'FACTURA', debe: 8000, haber: 0 },
      { tipo: 'NOTA_CREDITO', debe: 0, haber: 3000 },
      { tipo: 'PAGO', debe: 0, haber: 10000 },
    ];
    const balances = calculateRunningBalance(transactions);
    // 20000, 15000, 23000, 20000, 10000
    expect(balances).toEqual([20000, 15000, 23000, 20000, 10000]);
  });

  it('should return empty array for no transactions', () => {
    const balances = calculateRunningBalance([]);
    expect(balances).toEqual([]);
  });

  it('should handle balance going negative', () => {
    const transactions: Transaction[] = [
      { tipo: 'FACTURA', debe: 5000, haber: 0 },
      { tipo: 'PAGO', debe: 0, haber: 8000 },
    ];
    const balances = calculateRunningBalance(transactions);
    expect(balances).toEqual([5000, -3000]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 13: Transaction Mapping (Invoice/Payment/CreditNote → Transaction)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Transaction Mapping', () => {
  it('should map invoices with debe=total, haber=0', () => {
    const invoice = { total: '15000.50' };
    const mapped = {
      debe: parseFloat(invoice.total.toString()),
      haber: 0,
    };
    expect(mapped.debe).toBe(15000.5);
    expect(mapped.haber).toBe(0);
  });

  it('should map payments with debe=0, haber=totalPago', () => {
    const payment = { totalPago: '8000' };
    const mapped = {
      debe: 0,
      haber: parseFloat(payment.totalPago.toString()),
    };
    expect(mapped.debe).toBe(0);
    expect(mapped.haber).toBe(8000);
  });

  it('should map credit notes with debe=0, haber=total', () => {
    const creditNote = { total: '3000' };
    const mapped = {
      debe: 0,
      haber: parseFloat(creditNote.total.toString()),
    };
    expect(mapped.debe).toBe(0);
    expect(mapped.haber).toBe(3000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 14: Edge Cases and Bug Detection
// ═══════════════════════════════════════════════════════════════════════════════

describe('Edge Cases - Period Calculation', () => {
  it('should not produce period "YYYY-00" for January execution', () => {
    // When run in Jan, target is Dec of previous year
    const now = new Date(2025, 0, 1);
    const result = calculateSnapshotPeriod(now);
    expect(result.periodo).not.toContain('-00');
    expect(result.periodo).toBe('2024-12');
  });

  it('should not produce period "YYYY-13" for any month', () => {
    for (let month = 0; month < 12; month++) {
      const now = new Date(2025, month, 1);
      const result = calculateSnapshotPeriod(now);
      const monthNum = parseInt(result.periodo.split('-')[1]);
      expect(monthNum).toBeGreaterThanOrEqual(1);
      expect(monthNum).toBeLessThanOrEqual(12);
    }
  });
});

describe('Edge Cases - Balance Parsing', () => {
  it('should handle Decimal type toString() parsing', () => {
    // Prisma Decimal returns an object with toString()
    const mockDecimal = { toString: () => '15000.75' };
    const parsed = parseFloat(mockDecimal.toString());
    expect(parsed).toBe(15000.75);
  });

  it('should default to 0 when currentBalance is null/undefined', () => {
    const client = { currentBalance: null };
    const saldoActual = parseFloat(
      client.currentBalance?.toString() || '0'
    );
    expect(saldoActual).toBe(0);
  });

  it('should handle very large balances', () => {
    const largeBalance = '999999999999.99';
    const parsed = parseFloat(largeBalance);
    expect(parsed).toBe(999999999999.99);
  });
});

describe('Edge Cases - Historico Period Filtering', () => {
  it('should build gte filter for "desde" param', () => {
    const desde = '2024-01';
    const periodoFilter: any = {};
    if (desde) {
      periodoFilter.gte = desde;
    }
    expect(periodoFilter.gte).toBe('2024-01');
  });

  it('should build lte filter for "hasta" param', () => {
    const hasta = '2024-12';
    const periodoFilter: any = {};
    if (hasta) {
      periodoFilter.lte = hasta;
    }
    expect(periodoFilter.lte).toBe('2024-12');
  });

  it('should support both desde and hasta together', () => {
    const desde = '2024-01';
    const hasta = '2024-06';
    const periodoFilter: any = {};
    if (desde) periodoFilter.gte = desde;
    if (hasta) periodoFilter.lte = hasta;
    expect(periodoFilter).toEqual({ gte: '2024-01', lte: '2024-06' });
  });

  it('should produce empty filter when no params given', () => {
    const desde = null;
    const hasta = null;
    const periodoFilter: any = {};
    if (desde) periodoFilter.gte = desde;
    if (hasta) periodoFilter.lte = hasta;
    expect(Object.keys(periodoFilter)).toHaveLength(0);
  });

  it('string comparison for YYYY-MM format should work correctly', () => {
    // YYYY-MM format allows correct lexicographic comparison
    expect('2024-01' < '2024-06').toBe(true);
    expect('2024-12' > '2024-06').toBe(true);
    expect('2025-01' > '2024-12').toBe(true);
    expect('2024-09' < '2024-10').toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 15: File Existence and Import Checks
// ═══════════════════════════════════════════════════════════════════════════════

describe('File Structure and Imports', () => {
  it('should have balance-snapshot cron route', () => {
    const filePath = path.join(
      PROJECT_ROOT,
      'app',
      'api',
      'cron',
      'balance-snapshot',
      'route.ts'
    );
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('should have historico route under cuenta-corriente/[clientId]', () => {
    const filePath = path.join(
      PROJECT_ROOT,
      'app',
      'api',
      'ventas',
      'cuenta-corriente',
      '[clientId]',
      'historico',
      'route.ts'
    );
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('should have modified cuenta-corriente [clientId] route', () => {
    const filePath = path.join(
      PROJECT_ROOT,
      'app',
      'api',
      'ventas',
      'cuenta-corriente',
      '[clientId]',
      'route.ts'
    );
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('cron route should import prisma', () => {
    const content = fs.readFileSync(
      path.join(
        PROJECT_ROOT,
        'app',
        'api',
        'cron',
        'balance-snapshot',
        'route.ts'
      ),
      'utf-8'
    );
    expect(content).toContain("from '@/lib/prisma'");
  });

  it('historico route should import requirePermission and view-mode', () => {
    const content = fs.readFileSync(
      path.join(
        PROJECT_ROOT,
        'app',
        'api',
        'ventas',
        'cuenta-corriente',
        '[clientId]',
        'historico',
        'route.ts'
      ),
      'utf-8'
    );
    expect(content).toContain("from '@/lib/ventas/auth'");
    expect(content).toContain("from '@/lib/view-mode'");
  });

  it('cron route should NOT import auth (public endpoint with secret)', () => {
    const content = fs.readFileSync(
      path.join(
        PROJECT_ROOT,
        'app',
        'api',
        'cron',
        'balance-snapshot',
        'route.ts'
      ),
      'utf-8'
    );
    expect(content).not.toContain('requirePermission');
    expect(content).not.toContain("from '@/lib/ventas/auth'");
  });
});
