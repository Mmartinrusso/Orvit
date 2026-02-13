import { prisma } from '@/lib/prisma';
import { subDays } from 'date-fns';

interface QuickPurchaseValidation {
  permitido: boolean;
  errores: string[];
  advertencias: string[];
  requiereAprobacion: boolean;
  aprobadorRequerido?: string;
}

interface QuickPurchaseData {
  proveedorId: number;
  items: Array<{
    supplierItemId: number;
    cantidadRecibida: number;
    precioUnitario?: number;
  }>;
  quickPurchaseReason?: string;
  quickPurchaseJustification?: string;
  esEmergencia?: boolean;
}

/**
 * Valida si una compra rápida puede ser creada según la política de la empresa
 */
export async function validarCompraRapida(
  data: QuickPurchaseData,
  userId: number,
  companyId: number
): Promise<QuickPurchaseValidation> {
  const errores: string[] = [];
  const advertencias: string[] = [];
  let requiereAprobacion = false;

  // Obtener config de la empresa
  const config = await prisma.purchaseConfig.findUnique({
    where: { companyId }
  });

  if (!config) {
    return {
      permitido: true,
      errores: [],
      advertencias: ['No hay configuración de compras. Se aplican valores por defecto.'],
      requiereAprobacion: false
    };
  }

  // 1. Verificar si compras rápidas están habilitadas
  if (!config.quickPurchaseEnabled) {
    errores.push('Las compras rápidas están deshabilitadas para esta empresa');
    return { permitido: false, errores, advertencias, requiereAprobacion: false };
  }

  // 2. Verificar rol del usuario (si hay restricción de roles)
  if (config.quickPurchaseAllowedRoles && config.quickPurchaseAllowedRoles.length > 0) {
    const userWithRole = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        companies: {
          where: { companyId },
          include: {
            role: true
          }
        }
      }
    });

    const userRole = userWithRole?.companies?.[0]?.role?.name;
    if (!userRole || !config.quickPurchaseAllowedRoles.includes(userRole)) {
      errores.push(`Su rol (${userRole || 'sin rol'}) no está autorizado para crear compras rápidas. Roles permitidos: ${config.quickPurchaseAllowedRoles.join(', ')}`);
      return { permitido: false, errores, advertencias, requiereAprobacion: false };
    }
  }

  // 3. Calcular monto total de la compra
  let montoTotal = 0;
  for (const item of data.items) {
    const precioUnitario = item.precioUnitario || 0;
    montoTotal += item.cantidadRecibida * precioUnitario;
  }

  // 4. Verificar monto máximo (si hay límite)
  if (config.quickPurchaseMaxAmount && montoTotal > Number(config.quickPurchaseMaxAmount)) {
    if (config.quickPurchaseRequiresApproval) {
      requiereAprobacion = true;
      advertencias.push(`Monto $${montoTotal.toFixed(2)} excede el límite de compra rápida sin aprobación ($${Number(config.quickPurchaseMaxAmount).toFixed(2)}). Requiere aprobación.`);
    } else {
      errores.push(`Monto $${montoTotal.toFixed(2)} excede el límite de compra rápida ($${Number(config.quickPurchaseMaxAmount).toFixed(2)})`);
      return { permitido: false, errores, advertencias, requiereAprobacion };
    }
  }

  // 5. Verificar motivo obligatorio
  if (config.quickPurchaseRequireJustification) {
    if (!data.quickPurchaseReason) {
      errores.push('Debe seleccionar un motivo para la compra rápida');
    }
    if (data.quickPurchaseReason === 'OTRO' && !data.quickPurchaseJustification) {
      errores.push('Debe proporcionar una justificación cuando el motivo es "Otro"');
    }
  }

  // 6. Verificar frecuencia de compras rápidas (alerta, no bloqueo)
  const comprasRecientes = await prisma.goodsReceipt.count({
    where: {
      createdBy: userId,
      companyId,
      isQuickPurchase: true,
      createdAt: { gte: subDays(new Date(), 7) }
    }
  });

  if (comprasRecientes >= config.quickPurchaseAlertThreshold) {
    advertencias.push(`Alerta: Ha realizado ${comprasRecientes} compras rápidas en los últimos 7 días (umbral: ${config.quickPurchaseAlertThreshold})`);

    // Registrar alerta
    await registrarAlertaCompraRapida(companyId, userId, comprasRecientes + 1);
  }

  // Si hay errores, no permitir
  if (errores.length > 0) {
    return { permitido: false, errores, advertencias, requiereAprobacion };
  }

  return {
    permitido: true,
    errores: [],
    advertencias,
    requiereAprobacion
  };
}

/**
 * Registra una alerta de compras rápidas frecuentes
 */
async function registrarAlertaCompraRapida(
  companyId: number,
  userId: number,
  cantidad: number
): Promise<void> {
  try {
    // Verificar si ya hay una alerta reciente para este usuario
    const alertaReciente = await prisma.purchaseAuditLog.findFirst({
      where: {
        companyId,
        userId,
        accion: 'ALERTA_COMPRAS_RAPIDAS_FRECUENTES',
        createdAt: { gte: subDays(new Date(), 1) } // No duplicar en el mismo día
      }
    });

    if (!alertaReciente) {
      await prisma.purchaseAuditLog.create({
        data: {
          entidad: 'goods_receipt',
          entidadId: 0, // No hay entidad específica
          accion: 'ALERTA_COMPRAS_RAPIDAS_FRECUENTES',
          datosNuevos: {
            usuarioId: userId,
            cantidadComprasRapidas: cantidad,
            periodo: '7 días',
            mensaje: `Usuario ha realizado ${cantidad} compras rápidas en los últimos 7 días`
          },
          companyId,
          userId
        }
      });
    }
  } catch (error) {
    console.error('Error registrando alerta de compras rápidas:', error);
  }
}

/**
 * Determina el estado de regularización inicial según la política
 */
export function determinarEstadoRegularizacion(
  montoTotal: number,
  config: {
    quickPurchaseMaxAmount?: number | null;
    diasLimiteRegularizacion: number;
  }
): {
  regularizationStatus: 'REG_PENDING' | 'REG_OK' | 'REG_NOT_REQUIRED';
  fechaLimite: Date | null;
} {
  // Si el monto es menor a un umbral configurable, no requiere regularización
  const umbralNoRegularizacion = config.quickPurchaseMaxAmount
    ? Number(config.quickPurchaseMaxAmount) * 0.1 // 10% del máximo
    : 5000; // Default $5000

  if (montoTotal <= umbralNoRegularizacion) {
    return {
      regularizationStatus: 'REG_NOT_REQUIRED',
      fechaLimite: null
    };
  }

  // Calcular fecha límite de regularización
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() + config.diasLimiteRegularizacion);

  return {
    regularizationStatus: 'REG_PENDING',
    fechaLimite
  };
}

/**
 * Obtiene las compras rápidas pendientes de regularización
 */
export async function obtenerComprasRapidasPendientes(
  companyId: number,
  options?: {
    usuarioId?: number;
    soloVencidas?: boolean;
    page?: number;
    limit?: number;
  }
): Promise<{
  data: any[];
  total: number;
  vencidas: number;
  porVencer: number;
}> {
  const { usuarioId, soloVencidas, page = 1, limit = 20 } = options || {};
  const hoy = new Date();
  const en3Dias = new Date();
  en3Dias.setDate(en3Dias.getDate() + 3);

  const where: any = {
    companyId,
    isQuickPurchase: true,
    regularizationStatus: 'REG_PENDING',
    ...(usuarioId && { createdBy: usuarioId }),
    ...(soloVencidas && {
      fechaLimiteRegularizacion: { lt: hoy }
    })
  };

  const [data, total, vencidas, porVencer] = await Promise.all([
    prisma.goodsReceipt.findMany({
      where,
      include: {
        proveedor: { select: { id: true, name: true } },
        createdByUser: { select: { id: true, name: true } },
        items: {
          select: {
            id: true,
            descripcion: true,
            cantidadAceptada: true,
            unidad: true
          }
        }
      },
      orderBy: { fechaLimiteRegularizacion: 'asc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.goodsReceipt.count({ where }),
    prisma.goodsReceipt.count({
      where: {
        ...where,
        fechaLimiteRegularizacion: { lt: hoy }
      }
    }),
    prisma.goodsReceipt.count({
      where: {
        ...where,
        fechaLimiteRegularizacion: {
          gte: hoy,
          lte: en3Dias
        }
      }
    })
  ]);

  return { data, total, vencidas, porVencer };
}

/**
 * Regulariza una compra rápida
 */
export async function regularizarCompraRapida(
  goodsReceiptId: number,
  companyId: number,
  userId: number,
  data: {
    purchaseOrderId?: number;
    notas?: string;
  }
): Promise<any> {
  const recepcion = await prisma.goodsReceipt.findFirst({
    where: {
      id: goodsReceiptId,
      companyId,
      isQuickPurchase: true,
      regularizationStatus: 'REG_PENDING'
    }
  });

  if (!recepcion) {
    throw new Error('Recepción no encontrada o no requiere regularización');
  }

  // Actualizar estado
  const updated = await prisma.goodsReceipt.update({
    where: { id: goodsReceiptId },
    data: {
      regularizationStatus: 'REG_OK',
      regularizedAt: new Date(),
      regularizedBy: userId,
      regularizationNotes: data.notas,
      ...(data.purchaseOrderId && { purchaseOrderId: data.purchaseOrderId })
    }
  });

  // Registrar en auditoría
  await prisma.purchaseAuditLog.create({
    data: {
      entidad: 'goods_receipt',
      entidadId: goodsReceiptId,
      accion: 'REGULARIZAR_COMPRA_RAPIDA',
      datosAnteriores: {
        regularizationStatus: 'REG_PENDING'
      },
      datosNuevos: {
        regularizationStatus: 'REG_OK',
        purchaseOrderId: data.purchaseOrderId,
        notas: data.notas
      },
      companyId,
      userId
    }
  });

  return updated;
}

/**
 * Lista de razones de compra rápida para el frontend
 */
export const QUICK_PURCHASE_REASONS = [
  { value: 'EMERGENCIA_PRODUCCION', label: 'Emergencia de producción', description: 'Parada de línea, urgencia operativa' },
  { value: 'REPOSICION_URGENTE', label: 'Reposición urgente', description: 'Stock crítico, no puede esperar OC' },
  { value: 'PROVEEDOR_UNICO', label: 'Proveedor único', description: 'Solo este proveedor lo tiene' },
  { value: 'COMPRA_MENOR', label: 'Compra menor', description: 'Monto menor al umbral de OC' },
  { value: 'OPORTUNIDAD_PRECIO', label: 'Oportunidad de precio', description: 'Oferta por tiempo limitado' },
  { value: 'OTRO', label: 'Otro', description: 'Requiere justificación en texto' }
];
