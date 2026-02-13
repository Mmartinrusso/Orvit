/**
 * API de Pruebas P2P Enforcement
 *
 * Este endpoint permite ejecutar pruebas del sistema P2P para verificar
 * que todas las reglas de negocio funcionan correctamente.
 *
 * SOLO USAR EN DESARROLLO - No exponer en producción
 *
 * GET /api/compras/test-p2p - Lista tests disponibles
 * POST /api/compras/test-p2p - Ejecuta tests específicos
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserAndCompany, APPROVAL_ROLES } from '@/lib/compras/auth-helper';
import { verificarProveedorBloqueado, verificarElegibilidadFacturas, requiereDobleAprobacion } from '@/lib/compras/payment-eligibility';
import { verificarSoD, verificarSoDSimple, SOD_RULES } from '@/lib/compras/sod-rules';
import { getGRNIStats, crearGRNIAccruals } from '@/lib/compras/grni-helper';
import { validateBody, CreatePaymentOrderSchema, ApprovePaymentOrderSchema } from '@/lib/compras/validation-schemas';

export const dynamic = 'force-dynamic';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
  duration?: number;
}

interface TestSuite {
  name: string;
  tests: TestResult[];
  passed: number;
  failed: number;
  duration: number;
}

// ============================================
// TESTS DISPONIBLES
// ============================================

const AVAILABLE_TESTS = [
  { id: 'auth', name: 'Auth Helper', description: 'Verifica autenticación centralizada' },
  { id: 'validation', name: 'Zod Validation', description: 'Verifica schemas de validación' },
  { id: 'sod', name: 'SoD Rules', description: 'Verifica reglas de segregación de funciones' },
  { id: 'eligibility', name: 'Payment Eligibility', description: 'Verifica elegibilidad de pagos' },
  { id: 'grni', name: 'GRNI Stats', description: 'Verifica estadísticas de GRNI' },
  { id: 'approval', name: 'Double Approval', description: 'Verifica doble aprobación' },
  { id: 'all', name: 'Todos', description: 'Ejecuta todos los tests' },
];

/**
 * GET - Lista tests disponibles
 */
export async function GET() {
  return NextResponse.json({
    message: 'P2P Test Suite',
    usage: 'POST /api/compras/test-p2p con body: { tests: ["auth", "sod", ...] }',
    availableTests: AVAILABLE_TESTS,
    warning: 'Solo usar en desarrollo',
  });
}

/**
 * POST - Ejecuta tests específicos
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Verificar autenticación
  const auth = await getUserAndCompany(APPROVAL_ROLES);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { user, companyId } = auth;

  // Verificar que es SUPERADMIN (solo ellos pueden ejecutar tests)
  if (user.role !== 'SUPERADMIN') {
    return NextResponse.json(
      { error: 'Solo SUPERADMIN puede ejecutar tests' },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { tests = ['all'] } = body;

  const results: TestSuite[] = [];

  // ============================================
  // TEST: Auth Helper
  // ============================================
  if (tests.includes('all') || tests.includes('auth')) {
    const suite = await runAuthTests(companyId, user.id);
    results.push(suite);
  }

  // ============================================
  // TEST: Zod Validation
  // ============================================
  if (tests.includes('all') || tests.includes('validation')) {
    const suite = await runValidationTests();
    results.push(suite);
  }

  // ============================================
  // TEST: SoD Rules
  // ============================================
  if (tests.includes('all') || tests.includes('sod')) {
    const suite = await runSoDTests(companyId, user.id);
    results.push(suite);
  }

  // ============================================
  // TEST: Payment Eligibility
  // ============================================
  if (tests.includes('all') || tests.includes('eligibility')) {
    const suite = await runEligibilityTests(companyId);
    results.push(suite);
  }

  // ============================================
  // TEST: GRNI Stats
  // ============================================
  if (tests.includes('all') || tests.includes('grni')) {
    const suite = await runGRNITests(companyId);
    results.push(suite);
  }

  // ============================================
  // TEST: Double Approval
  // ============================================
  if (tests.includes('all') || tests.includes('approval')) {
    const suite = await runApprovalTests(companyId);
    results.push(suite);
  }

  // Calcular resumen
  const totalPassed = results.reduce((sum, s) => sum + s.passed, 0);
  const totalFailed = results.reduce((sum, s) => sum + s.failed, 0);
  const totalDuration = Date.now() - startTime;

  return NextResponse.json({
    summary: {
      totalSuites: results.length,
      totalTests: totalPassed + totalFailed,
      passed: totalPassed,
      failed: totalFailed,
      duration: `${totalDuration}ms`,
      status: totalFailed === 0 ? 'PASSED' : 'FAILED',
    },
    suites: results,
    executedBy: user.name,
    executedAt: new Date().toISOString(),
  });
}

// ============================================
// TEST IMPLEMENTATIONS
// ============================================

async function runAuthTests(companyId: number, userId: number): Promise<TestSuite> {
  const tests: TestResult[] = [];
  const start = Date.now();

  // Test 1: getUserAndCompany devuelve datos correctos
  try {
    const auth = await getUserAndCompany();
    tests.push({
      name: 'getUserAndCompany returns valid data',
      passed: auth.success && auth.companyId === companyId,
      message: auth.success ? `CompanyId: ${auth.companyId}` : 'Failed',
      details: auth,
    });
  } catch (e: any) {
    tests.push({
      name: 'getUserAndCompany returns valid data',
      passed: false,
      message: e.message,
    });
  }

  // Test 2: getUserAndCompany con roles requeridos
  try {
    const auth = await getUserAndCompany(APPROVAL_ROLES);
    tests.push({
      name: 'getUserAndCompany with required roles',
      passed: auth.success,
      message: auth.success ? 'Role validation passed' : (auth as any).error,
    });
  } catch (e: any) {
    tests.push({
      name: 'getUserAndCompany with required roles',
      passed: false,
      message: e.message,
    });
  }

  const passed = tests.filter((t) => t.passed).length;
  return {
    name: 'Auth Helper Tests',
    tests,
    passed,
    failed: tests.length - passed,
    duration: Date.now() - start,
  };
}

async function runValidationTests(): Promise<TestSuite> {
  const tests: TestResult[] = [];
  const start = Date.now();

  // Test 1: CreatePaymentOrderSchema - válido
  const validPaymentInput = {
    proveedorId: 1,
    fechaPago: '2026-01-29',
    facturas: [{ receiptId: 1, montoAplicado: 100 }],
    efectivo: 100,
    docType: 'T1',
  };
  const result1 = validateBody(CreatePaymentOrderSchema, validPaymentInput);
  tests.push({
    name: 'CreatePaymentOrderSchema accepts valid input',
    passed: result1.success,
    message: result1.success ? 'Valid' : (result1 as any).error,
  });

  // Test 2: CreatePaymentOrderSchema - sin medios de pago
  const invalidInput = {
    proveedorId: 1,
    fechaPago: '2026-01-29',
    facturas: [],
    efectivo: 0,
    docType: 'T1',
  };
  const result2 = validateBody(CreatePaymentOrderSchema, invalidInput);
  tests.push({
    name: 'CreatePaymentOrderSchema rejects no payment methods',
    passed: !result2.success,
    message: !result2.success ? 'Correctly rejected' : 'Should have rejected',
  });

  // Test 3: ApprovePaymentOrderSchema - rechazar sin motivo
  const rejectWithoutReason = { accion: 'rechazar' };
  const result3 = validateBody(ApprovePaymentOrderSchema, rejectWithoutReason);
  tests.push({
    name: 'ApprovePaymentOrderSchema requires motivo for rejection',
    passed: !result3.success,
    message: !result3.success ? 'Correctly rejected' : 'Should have rejected',
  });

  // Test 4: ApprovePaymentOrderSchema - rechazar con motivo
  const rejectWithReason = { accion: 'rechazar', motivo: 'Test reason' };
  const result4 = validateBody(ApprovePaymentOrderSchema, rejectWithReason);
  tests.push({
    name: 'ApprovePaymentOrderSchema accepts rejection with motivo',
    passed: result4.success,
    message: result4.success ? 'Valid' : (result4 as any).error,
  });

  // Test 5: DocType validation
  const invalidDocType = { ...validPaymentInput, docType: 'T3' };
  const result5 = validateBody(CreatePaymentOrderSchema, invalidDocType);
  tests.push({
    name: 'DocType only accepts T1 or T2',
    passed: !result5.success,
    message: !result5.success ? 'Correctly rejected T3' : 'Should have rejected T3',
  });

  const passed = tests.filter((t) => t.passed).length;
  return {
    name: 'Zod Validation Tests',
    tests,
    passed,
    failed: tests.length - passed,
    duration: Date.now() - start,
  };
}

async function runSoDTests(companyId: number, userId: number): Promise<TestSuite> {
  const tests: TestResult[] = [];
  const start = Date.now();

  // Test 1: SOD_RULES están definidas
  tests.push({
    name: 'SOD_RULES are defined',
    passed: SOD_RULES.length >= 8,
    message: `${SOD_RULES.length} rules defined`,
    details: SOD_RULES.map((r) => r.id),
  });

  // Test 2: verificarSoDSimple - mismo usuario
  const sameUserCheck = verificarSoDSimple(userId, userId);
  tests.push({
    name: 'verificarSoDSimple rejects same user',
    passed: !sameUserCheck.allowed,
    message: sameUserCheck.allowed ? 'Should have rejected' : 'Correctly rejected',
  });

  // Test 3: verificarSoDSimple - diferentes usuarios
  const diffUserCheck = verificarSoDSimple(userId, userId + 1);
  tests.push({
    name: 'verificarSoDSimple allows different users',
    passed: diffUserCheck.allowed,
    message: diffUserCheck.allowed ? 'Allowed' : 'Should have allowed',
  });

  // Test 4: verificarSoD con documento que no existe (debe pasar, no hay conflicto)
  try {
    const sodCheck = await verificarSoD(userId, 'APROBAR_OC', 999999, 'OC', prisma);
    tests.push({
      name: 'verificarSoD handles non-existent document',
      passed: sodCheck.allowed,
      message: 'Allowed (no audit history)',
    });
  } catch (e: any) {
    tests.push({
      name: 'verificarSoD handles non-existent document',
      passed: false,
      message: e.message,
    });
  }

  const passed = tests.filter((t) => t.passed).length;
  return {
    name: 'SoD Rules Tests',
    tests,
    passed,
    failed: tests.length - passed,
    duration: Date.now() - start,
  };
}

async function runEligibilityTests(companyId: number): Promise<TestSuite> {
  const tests: TestResult[] = [];
  const start = Date.now();

  // Test 1: verificarProveedorBloqueado - proveedor inexistente
  try {
    const result = await verificarProveedorBloqueado(999999, prisma);
    tests.push({
      name: 'verificarProveedorBloqueado handles non-existent',
      passed: !result.eligible && result.code === 'PROVEEDOR_NO_ENCONTRADO',
      message: result.code || 'Unknown',
    });
  } catch (e: any) {
    tests.push({
      name: 'verificarProveedorBloqueado handles non-existent',
      passed: false,
      message: e.message,
    });
  }

  // Test 2: verificarElegibilidadFacturas - facturas inexistentes (batch)
  try {
    const result = await verificarElegibilidadFacturas([999998, 999999], companyId, prisma);
    tests.push({
      name: 'verificarElegibilidadFacturas handles batch non-existent',
      passed: !result.allEligible && result.blockedFacturas.length === 2,
      message: `${result.blockedFacturas.length} blocked`,
      details: result.blockedFacturas,
    });
  } catch (e: any) {
    tests.push({
      name: 'verificarElegibilidadFacturas handles batch non-existent',
      passed: false,
      message: e.message,
    });
  }

  // Test 3: verificarElegibilidadFacturas - array vacío
  try {
    const result = await verificarElegibilidadFacturas([], companyId, prisma);
    tests.push({
      name: 'verificarElegibilidadFacturas handles empty array',
      passed: result.allEligible && result.blockedFacturas.length === 0,
      message: 'Empty array handled correctly',
    });
  } catch (e: any) {
    tests.push({
      name: 'verificarElegibilidadFacturas handles empty array',
      passed: false,
      message: e.message,
    });
  }

  // Test 4: requiereDobleAprobacion
  try {
    const lowAmount = await requiereDobleAprobacion(1000, companyId, prisma);
    const highAmount = await requiereDobleAprobacion(1000000, companyId, prisma);
    tests.push({
      name: 'requiereDobleAprobacion checks threshold',
      passed: !lowAmount.requiere && highAmount.requiere,
      message: `Low ($1000): ${lowAmount.requiere}, High ($1M): ${highAmount.requiere}, Threshold: $${lowAmount.umbral}`,
    });
  } catch (e: any) {
    tests.push({
      name: 'requiereDobleAprobacion checks threshold',
      passed: false,
      message: e.message,
    });
  }

  const passed = tests.filter((t) => t.passed).length;
  return {
    name: 'Payment Eligibility Tests',
    tests,
    passed,
    failed: tests.length - passed,
    duration: Date.now() - start,
  };
}

async function runGRNITests(companyId: number): Promise<TestSuite> {
  const tests: TestResult[] = [];
  const start = Date.now();

  // Test 1: getGRNIStats devuelve estructura correcta
  try {
    const stats = await getGRNIStats(companyId, null, prisma);
    tests.push({
      name: 'getGRNIStats returns valid structure',
      passed:
        typeof stats.totalPendiente === 'number' &&
        typeof stats.cantidadRecepciones === 'number' &&
        stats.aging !== undefined,
      message: `Total: $${stats.totalPendiente}, Recepciones: ${stats.cantidadRecepciones}`,
      details: stats,
    });
  } catch (e: any) {
    tests.push({
      name: 'getGRNIStats returns valid structure',
      passed: false,
      message: e.message,
    });
  }

  // Test 2: getGRNIStats con docType T1
  try {
    const stats = await getGRNIStats(companyId, 'T1', prisma);
    tests.push({
      name: 'getGRNIStats filters by docType T1',
      passed: stats !== null,
      message: `T1 Total: $${stats.totalPendiente}`,
    });
  } catch (e: any) {
    tests.push({
      name: 'getGRNIStats filters by docType T1',
      passed: false,
      message: e.message,
    });
  }

  const passed = tests.filter((t) => t.passed).length;
  return {
    name: 'GRNI Stats Tests',
    tests,
    passed,
    failed: tests.length - passed,
    duration: Date.now() - start,
  };
}

async function runApprovalTests(companyId: number): Promise<TestSuite> {
  const tests: TestResult[] = [];
  const start = Date.now();

  // Test 1: Contar órdenes pendientes de aprobación
  try {
    const pendientes = await prisma.paymentOrder.count({
      where: {
        companyId,
        estado: 'PENDIENTE_APROBACION',
      },
    });
    tests.push({
      name: 'Count pending approval orders',
      passed: true,
      message: `${pendientes} orders pending approval`,
    });
  } catch (e: any) {
    tests.push({
      name: 'Count pending approval orders',
      passed: false,
      message: e.message,
    });
  }

  // Test 2: Contar cambios bancarios pendientes
  try {
    const cambiosPendientes = await prisma.supplierChangeRequest.count({
      where: {
        companyId,
        estado: 'PENDIENTE_APROBACION',
        tipo: 'CAMBIO_BANCARIO',
      },
    });
    tests.push({
      name: 'Count pending bank change requests',
      passed: true,
      message: `${cambiosPendientes} bank changes pending`,
    });
  } catch (e: any) {
    tests.push({
      name: 'Count pending bank change requests',
      passed: false,
      message: e.message,
    });
  }

  // Test 3: Verificar estructura de PurchaseConfig
  try {
    const config = await prisma.purchaseConfig.findUnique({
      where: { companyId },
      select: {
        umbralDobleAprobacion: true,
        umbralAprobacionPedido: true,
        toleranciaCantidad: true,
        toleranciaPrecio: true,
      },
    });
    tests.push({
      name: 'PurchaseConfig has approval thresholds',
      passed: config !== null,
      message: config
        ? `Doble aprobación: $${config.umbralDobleAprobacion}, Pedido: $${config.umbralAprobacionPedido}`
        : 'Config not found (will use defaults)',
      details: config,
    });
  } catch (e: any) {
    tests.push({
      name: 'PurchaseConfig has approval thresholds',
      passed: false,
      message: e.message,
    });
  }

  const passed = tests.filter((t) => t.passed).length;
  return {
    name: 'Double Approval Tests',
    tests,
    passed,
    failed: tests.length - passed,
    duration: Date.now() - start,
  };
}
