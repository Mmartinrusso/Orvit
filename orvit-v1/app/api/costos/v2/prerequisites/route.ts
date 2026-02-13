import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/costos/v2/prerequisites
 *
 * Verifica qué módulos están listos para alimentar el Centro de Costos V2.
 * Retorna el estado de cada módulo y si el sistema está listo para V2.
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;

    // Verificar cada módulo en paralelo
    const [
      payrollCheck,
      purchasesCheck,
      salesCheck,
      productionCheck,
      indirectCheck,
      maintenanceCheck,
      config
    ] = await Promise.all([
      checkPayrollModule(companyId),
      checkPurchasesModule(companyId),
      checkSalesModule(companyId),
      checkProductionModule(companyId),
      checkIndirectModule(companyId),
      checkMaintenanceModule(companyId),
      getOrCreateConfig(companyId)
    ]);

    // Determinar si está listo para V2
    const allReady = payrollCheck.ready &&
                     purchasesCheck.ready &&
                     salesCheck.ready &&
                     productionCheck.ready &&
                     indirectCheck.ready;

    const readyCount = [payrollCheck, purchasesCheck, salesCheck, productionCheck, indirectCheck, maintenanceCheck]
      .filter(m => m.ready).length;

    return NextResponse.json({
      success: true,
      ready: allReady,
      readyCount,
      totalModules: 6,
      currentVersion: config.version,
      modules: {
        payroll: payrollCheck,
        purchases: purchasesCheck,
        sales: salesCheck,
        production: productionCheck,
        indirect: indirectCheck,
        maintenance: maintenanceCheck
      },
      config: {
        usePayrollData: config.usePayrollData,
        useComprasData: config.useComprasData,
        useVentasData: config.useVentasData,
        useProdData: config.useProdData,
        useIndirectData: config.useIndirectData,
        useMaintData: config.useMaintData,
        v2EnabledAt: config.v2EnabledAt
      }
    });

  } catch (error) {
    console.error('Error verificando prerrequisitos V2:', error);
    return NextResponse.json(
      { error: 'Error al verificar prerrequisitos' },
      { status: 500 }
    );
  }
}

// ============================================================================
// FUNCIONES DE VERIFICACIÓN POR MÓDULO
// ============================================================================

async function checkPayrollModule(companyId: number) {
  try {
    // Buscar nóminas cerradas (APPROVED o PAID)
    const payrollRuns = await prisma.payrollRun.findMany({
      where: {
        company_id: companyId,
        status: { in: ['APPROVED', 'PAID'] }
      },
      orderBy: { created_at: 'desc' },
      take: 1,
      include: {
        period: true
      }
    });

    const hasData = payrollRuns.length > 0;
    const lastPeriod = hasData && payrollRuns[0].period
      ? `${payrollRuns[0].period.year}-${String(payrollRuns[0].period.month).padStart(2, '0')}`
      : null;

    // Contar total de nóminas cerradas
    const totalCount = await prisma.payrollRun.count({
      where: {
        company_id: companyId,
        status: { in: ['APPROVED', 'PAID'] }
      }
    });

    return {
      ready: hasData,
      lastPeriod,
      totalCount,
      reason: hasData ? null : 'No hay nóminas cerradas (APPROVED/PAID)'
    };
  } catch (error) {
    console.error('Error verificando módulo Payroll:', error);
    return {
      ready: false,
      reason: 'Error al verificar módulo de nóminas'
    };
  }
}

async function checkPurchasesModule(companyId: number) {
  try {
    // Buscar recepciones confirmadas
    const receiptsCount = await prisma.goodsReceipt.count({
      where: {
        companyId,
        estado: 'CONFIRMADA'
      }
    });

    const hasData = receiptsCount > 0;

    // Obtener última recepción (sin incluir campos que puedan no existir)
    const lastReceipt = hasData ? await prisma.goodsReceipt.findFirst({
      where: {
        companyId,
        estado: 'CONFIRMADA'
      },
      orderBy: { fechaRecepcion: 'desc' },
      select: {
        id: true,
        fechaRecepcion: true
      }
    }) : null;

    return {
      ready: hasData,
      receiptsCount,
      lastReceiptDate: lastReceipt?.fechaRecepcion,
      reason: hasData ? null : 'No hay recepciones de compra confirmadas'
    };
  } catch (error: any) {
    // Si hay error de columna no existente (P2022), retornar como no disponible
    if (error?.code === 'P2022') {
      return {
        ready: false,
        receiptsCount: 0,
        reason: 'Módulo de compras requiere actualización de BD'
      };
    }
    console.error('Error verificando módulo Purchases:', error);
    return {
      ready: false,
      reason: 'Error al verificar módulo de compras'
    };
  }
}

async function checkSalesModule(companyId: number) {
  try {
    // Buscar facturas confirmadas (campo es 'estado', no 'status')
    const invoicesCount = await prisma.salesInvoice.count({
      where: {
        companyId,
        estado: { in: ['CONFIRMADA', 'PAGADA', 'CONFIRMED', 'PAID'] }
      }
    });

    const hasData = invoicesCount > 0;

    // Obtener última factura
    const lastInvoice = await prisma.salesInvoice.findFirst({
      where: {
        companyId,
        estado: { in: ['CONFIRMADA', 'PAGADA', 'CONFIRMED', 'PAID'] }
      },
      orderBy: { fechaEmision: 'desc' }
    });

    return {
      ready: hasData,
      invoicesCount,
      lastInvoiceDate: lastInvoice?.fechaEmision,
      reason: hasData ? null : 'No hay facturas de venta confirmadas'
    };
  } catch (error) {
    console.error('Error verificando módulo Sales:', error);
    return {
      ready: false,
      reason: 'Error al verificar módulo de ventas'
    };
  }
}

async function checkProductionModule(companyId: number) {
  try {
    // Buscar producción mensual registrada
    const productionCount = await prisma.monthlyProduction.count({
      where: { companyId }
    });

    const hasData = productionCount > 0;

    // Obtener último mes de producción
    const lastProduction = await prisma.monthlyProduction.findFirst({
      where: { companyId },
      orderBy: { month: 'desc' }
    });

    // Verificar si hay recetas activas
    const recipesCount = await prisma.recipe.count({
      where: {
        companyId,
        isActive: true
      }
    });

    return {
      ready: hasData,
      productionCount,
      recipesCount,
      lastMonth: lastProduction?.month,
      reason: hasData ? null : 'No hay producción mensual registrada'
    };
  } catch (error) {
    console.error('Error verificando módulo Production:', error);
    return {
      ready: false,
      reason: 'Error al verificar módulo de producción'
    };
  }
}

async function checkIndirectModule(companyId: number) {
  try {
    // Buscar items de costos indirectos
    const itemsCount = await prisma.indirectItem.count({
      where: { companyId }
    });

    const hasData = itemsCount > 0;

    // Contar registros mensuales
    const monthlyCount = await prisma.monthlyIndirect.count({
      where: { companyId }
    });

    return {
      ready: hasData,
      itemsCount,
      monthlyRecordsCount: monthlyCount,
      reason: hasData ? null : 'No hay ítems de costos indirectos creados'
    };
  } catch (error) {
    console.error('Error verificando módulo Indirect:', error);
    return {
      ready: false,
      reason: 'Error al verificar módulo de indirectos'
    };
  }
}

async function checkMaintenanceModule(companyId: number) {
  try {
    // Verificar si la tabla existe intentando hacer count
    // Si la tabla no existe, Prisma lanzará error P2021
    const costsCount = await prisma.maintenanceCostBreakdown.count({
      where: { companyId }
    });

    const hasData = costsCount > 0;

    // Obtener último costo calculado
    const lastCost = hasData ? await prisma.maintenanceCostBreakdown.findFirst({
      where: { companyId },
      orderBy: { calculatedAt: 'desc' }
    }) : null;

    return {
      ready: hasData,
      costsCount,
      lastCalculatedAt: lastCost?.calculatedAt,
      reason: hasData ? null : 'No hay costos de mantenimiento calculados'
    };
  } catch (error: any) {
    // Si la tabla no existe (P2021), retornar como no disponible
    if (error?.code === 'P2021') {
      return {
        ready: false,
        costsCount: 0,
        reason: 'Módulo de costos de mantenimiento no configurado'
      };
    }
    console.error('Error verificando módulo Maintenance:', error);
    return {
      ready: false,
      reason: 'Error al verificar módulo de mantenimiento'
    };
  }
}

// ============================================================================
// HELPER: Obtener o crear configuración
// ============================================================================

async function getOrCreateConfig(companyId: number) {
  let config = await prisma.costSystemConfig.findUnique({
    where: { companyId }
  });

  if (!config) {
    config = await prisma.costSystemConfig.create({
      data: {
        companyId,
        version: 'V1',
        usePayrollData: false,
        useComprasData: false,
        useVentasData: false,
        useProdData: false,
        useIndirectData: false,
        useMaintData: false
      }
    });
  }

  return config;
}
