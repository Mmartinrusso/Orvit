/**
 * Payment Eligibility Helper
 *
 * Verifica si un pago puede realizarse basándose en reglas de negocio:
 * - Proveedor bloqueado
 * - Match status bloqueado
 * - Recepción confirmada (si config lo requiere)
 */

import { PrismaClient } from '@prisma/client';

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  code?: string;
  details?: Record<string, any>;
}

/**
 * Verifica si un proveedor está bloqueado
 */
export async function verificarProveedorBloqueado(
  proveedorId: number,
  prismaClient: PrismaClient
): Promise<EligibilityResult> {
  const proveedor = await prismaClient.suppliers.findUnique({
    where: { id: proveedorId },
    select: {
      id: true,
      name: true,
      isBlocked: true,
      blockedReason: true,
    },
  });

  if (!proveedor) {
    return {
      eligible: false,
      reason: 'Proveedor no encontrado',
      code: 'PROVEEDOR_NO_ENCONTRADO',
    };
  }

  if (proveedor.isBlocked) {
    return {
      eligible: false,
      reason: `Proveedor bloqueado: ${proveedor.blockedReason || 'Sin motivo especificado'}`,
      code: 'PROVEEDOR_BLOQUEADO',
      details: {
        proveedorId: proveedor.id,
        proveedorNombre: proveedor.name,
        blockedReason: proveedor.blockedReason,
      },
    };
  }

  return { eligible: true };
}

/**
 * Verifica elegibilidad de pago para una factura
 */
export async function verificarElegibilidadPago(
  facturaId: number,
  companyId: number,
  prismaClient: PrismaClient
): Promise<EligibilityResult> {
  const factura = await prismaClient.purchaseReceipt.findUnique({
    where: { id: facturaId },
    include: {
      proveedor: {
        select: {
          id: true,
          name: true,
          isBlocked: true,
          blockedReason: true,
        },
      },
      goodsReceipts: {
        where: { estado: 'CONFIRMADA' },
        select: { id: true },
      },
    },
  });

  if (!factura) {
    return {
      eligible: false,
      reason: 'Factura no encontrada',
      code: 'FACTURA_NO_ENCONTRADA',
    };
  }

  // 1. Verificar proveedor bloqueado
  if (factura.proveedor?.isBlocked) {
    return {
      eligible: false,
      reason: `Proveedor bloqueado: ${factura.proveedor.blockedReason || 'Sin motivo especificado'}`,
      code: 'PROVEEDOR_BLOQUEADO',
      details: {
        proveedorId: factura.proveedor.id,
        proveedorNombre: factura.proveedor.name,
        blockedReason: factura.proveedor.blockedReason,
      },
    };
  }

  // 2. Verificar match status
  if (factura.matchStatus === 'MATCH_BLOCKED') {
    return {
      eligible: false,
      reason: `Pago bloqueado por discrepancia de match: ${factura.matchBlockReason || 'Revisar excepciones'}`,
      code: 'MATCH_BLOQUEADO',
      details: {
        facturaId: factura.id,
        matchStatus: factura.matchStatus,
        matchBlockReason: factura.matchBlockReason,
      },
    };
  }

  // 3. Verificar configuración de pago sin recepción
  const config = await prismaClient.purchaseConfig.findUnique({
    where: { companyId },
    select: { permitirPagoSinRecepcion: true },
  });

  // Por defecto no permitir pago sin recepción
  const permitirSinRecepcion = config?.permitirPagoSinRecepcion ?? false;

  if (!permitirSinRecepcion && factura.goodsReceipts.length === 0) {
    return {
      eligible: false,
      reason: 'Factura sin recepción confirmada. Configure la empresa para permitir pagos sin recepción.',
      code: 'SIN_RECEPCION_CONFIRMADA',
      details: {
        facturaId: factura.id,
        recepcionesConfirmadas: 0,
      },
    };
  }

  // 4. Verificar payApprovalStatus si existe
  if (factura.payApprovalStatus === 'PAY_BLOCKED_BY_MATCH') {
    return {
      eligible: false,
      reason: 'Pago bloqueado por resultado de match. Resuelva las excepciones primero.',
      code: 'PAY_BLOCKED_BY_MATCH',
      details: {
        facturaId: factura.id,
        payApprovalStatus: factura.payApprovalStatus,
      },
    };
  }

  return { eligible: true };
}

/**
 * Verifica elegibilidad de múltiples facturas en batch (OPTIMIZADO)
 *
 * Esta versión usa una única query para obtener todas las facturas
 * y sus relaciones, eliminando el problema N+1.
 */
export async function verificarElegibilidadFacturas(
  facturaIds: number[],
  companyId: number,
  prismaClient: PrismaClient
): Promise<{
  allEligible: boolean;
  results: Map<number, EligibilityResult>;
  blockedFacturas: Array<{ id: number; reason: string; code: string }>;
}> {
  if (facturaIds.length === 0) {
    return { allEligible: true, results: new Map(), blockedFacturas: [] };
  }

  // ============================================
  // BATCH QUERY: Una sola query para todas las facturas
  // ============================================
  const [facturas, config] = await Promise.all([
    prismaClient.purchaseReceipt.findMany({
      where: {
        id: { in: facturaIds },
        companyId,
      },
      include: {
        proveedor: {
          select: {
            id: true,
            name: true,
            isBlocked: true,
            blockedReason: true,
          },
        },
        goodsReceipts: {
          where: { estado: 'CONFIRMADA' },
          select: { id: true },
        },
      },
    }),
    prismaClient.purchaseConfig.findUnique({
      where: { companyId },
      select: { permitirPagoSinRecepcion: true },
    }),
  ]);

  const permitirSinRecepcion = config?.permitirPagoSinRecepcion ?? false;
  const results = new Map<number, EligibilityResult>();
  const blockedFacturas: Array<{ id: number; reason: string; code: string }> = [];

  // Crear mapa de facturas encontradas para detectar las no encontradas
  const facturasMap = new Map(facturas.map((f) => [f.id, f]));

  for (const facturaId of facturaIds) {
    const factura = facturasMap.get(facturaId);

    // Factura no encontrada
    if (!factura) {
      const result: EligibilityResult = {
        eligible: false,
        reason: 'Factura no encontrada',
        code: 'FACTURA_NO_ENCONTRADA',
      };
      results.set(facturaId, result);
      blockedFacturas.push({ id: facturaId, reason: result.reason!, code: result.code! });
      continue;
    }

    // 1. Verificar proveedor bloqueado
    if (factura.proveedor?.isBlocked) {
      const result: EligibilityResult = {
        eligible: false,
        reason: `Proveedor bloqueado: ${factura.proveedor.blockedReason || 'Sin motivo especificado'}`,
        code: 'PROVEEDOR_BLOQUEADO',
        details: {
          proveedorId: factura.proveedor.id,
          proveedorNombre: factura.proveedor.name,
          blockedReason: factura.proveedor.blockedReason,
        },
      };
      results.set(facturaId, result);
      blockedFacturas.push({ id: facturaId, reason: result.reason!, code: result.code! });
      continue;
    }

    // 2. Verificar match status
    if (factura.matchStatus === 'MATCH_BLOCKED') {
      const result: EligibilityResult = {
        eligible: false,
        reason: `Pago bloqueado por discrepancia de match: ${factura.matchBlockReason || 'Revisar excepciones'}`,
        code: 'MATCH_BLOQUEADO',
        details: {
          facturaId: factura.id,
          matchStatus: factura.matchStatus,
          matchBlockReason: factura.matchBlockReason,
        },
      };
      results.set(facturaId, result);
      blockedFacturas.push({ id: facturaId, reason: result.reason!, code: result.code! });
      continue;
    }

    // 3. Verificar recepción confirmada
    if (!permitirSinRecepcion && factura.goodsReceipts.length === 0) {
      const result: EligibilityResult = {
        eligible: false,
        reason: 'Factura sin recepción confirmada. Configure la empresa para permitir pagos sin recepción.',
        code: 'SIN_RECEPCION_CONFIRMADA',
        details: {
          facturaId: factura.id,
          recepcionesConfirmadas: 0,
        },
      };
      results.set(facturaId, result);
      blockedFacturas.push({ id: facturaId, reason: result.reason!, code: result.code! });
      continue;
    }

    // 4. Verificar payApprovalStatus
    if (factura.payApprovalStatus === 'PAY_BLOCKED_BY_MATCH') {
      const result: EligibilityResult = {
        eligible: false,
        reason: 'Pago bloqueado por resultado de match. Resuelva las excepciones primero.',
        code: 'PAY_BLOCKED_BY_MATCH',
        details: {
          facturaId: factura.id,
          payApprovalStatus: factura.payApprovalStatus,
        },
      };
      results.set(facturaId, result);
      blockedFacturas.push({ id: facturaId, reason: result.reason!, code: result.code! });
      continue;
    }

    // Factura elegible
    results.set(facturaId, { eligible: true });
  }

  return {
    allEligible: blockedFacturas.length === 0,
    results,
    blockedFacturas,
  };
}

/**
 * Verifica si un pago requiere doble aprobación por monto
 */
export async function requiereDobleAprobacion(
  monto: number,
  companyId: number,
  prismaClient: PrismaClient
): Promise<{ requiere: boolean; umbral: number }> {
  const config = await prismaClient.purchaseConfig.findUnique({
    where: { companyId },
    select: { umbralDobleAprobacion: true },
  });

  // Umbral configurable, default 500,000
  const umbral = Number(config?.umbralDobleAprobacion) || 500000;

  return {
    requiere: monto >= umbral,
    umbral,
  };
}
