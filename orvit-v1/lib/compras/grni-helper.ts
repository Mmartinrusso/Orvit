/**
 * GRNI Helper - Goods Received Not Invoiced
 *
 * Funciones para gestionar accruals contables de recepciones sin factura.
 * El GRNI representa un pasivo contingente que se crea al confirmar una recepción
 * y se reversa cuando se vincula la factura correspondiente.
 *
 * Incluye:
 * - Audit logging para todas las operaciones
 * - Asignación de owners para seguimiento
 * - Alertas de antigüedad
 */

import { PrismaClient } from '@prisma/client';
import { format, differenceInDays, addDays } from 'date-fns';

// Tipos de acciones para audit log
type GRNIAction =
  | 'CREATE'
  | 'FACTURED'
  | 'VOID'
  | 'ADJUST'
  | 'ASSIGN_OWNER'
  | 'SEND_ALERT'
  | 'ADD_NOTE';

/**
 * Registra una entrada en el audit log de GRNI
 */
async function logGRNIAction(
  grniAccrualId: number,
  companyId: number,
  action: GRNIAction,
  userId: number,
  data: {
    fromState?: string;
    toState?: string;
    montoAnterior?: number;
    montoNuevo?: number;
    fromOwnerId?: number;
    toOwnerId?: number;
    reasonCode?: string;
    reasonText?: string;
    metadata?: any;
  },
  prismaClient: PrismaClient | any
): Promise<void> {
  try {
    await prismaClient.$executeRaw`
      INSERT INTO "GRNIAuditLog" (
        "grniAccrualId", "companyId", "action", "fromState", "toState",
        "montoAnterior", "montoNuevo", "fromOwnerId", "toOwnerId",
        "reasonCode", "reasonText", "metadata", "userId"
      ) VALUES (
        ${grniAccrualId}, ${companyId}, ${action}, ${data.fromState || null}, ${data.toState || null},
        ${data.montoAnterior || null}, ${data.montoNuevo || null}, ${data.fromOwnerId || null}, ${data.toOwnerId || null},
        ${data.reasonCode || null}, ${data.reasonText || null}, ${data.metadata ? JSON.stringify(data.metadata) : null}::jsonb, ${userId}
      )
    `;
  } catch (err) {
    console.warn('[GRNI] Error logging action:', err);
  }
}

/**
 * Asigna un owner a los accruals GRNI nuevos
 */
async function asignarOwnerGRNI(
  companyId: number,
  accrualId: number,
  prismaClient: PrismaClient | any
): Promise<{ ownerId: number | null; ownerRole: string }> {
  // Obtener configuración de alertas para el rol default
  const config = await prismaClient.$queryRaw<Array<{ ownerRoleDefault: string }>>`
    SELECT "ownerRoleDefault"
    FROM "GRNIAlertConfig"
    WHERE "companyId" = ${companyId} AND "isActive" = true
    LIMIT 1
  `;

  const ownerRole = config[0]?.ownerRoleDefault || 'COMPRAS_ANALISTA';

  // Buscar usuario con el rol
  const ownerUsers = await prismaClient.$queryRaw<Array<{ id: number }>>`
    SELECT u.id
    FROM "User" u
    JOIN "user_companies" uc ON uc."userId" = u.id
    JOIN "user_company_roles" ucr ON ucr."userCompanyId" = uc.id
    JOIN "Role" r ON r.id = ucr."roleId"
    WHERE uc."companyId" = ${companyId}
    AND r.name = ${ownerRole}
    AND u."isActive" = true
    ORDER BY RANDOM()
    LIMIT 1
  `;

  const ownerId = ownerUsers[0]?.id || null;

  // Actualizar el accrual con el owner
  if (ownerId) {
    await prismaClient.$executeRaw`
      UPDATE "grni_accruals"
      SET "ownerId" = ${ownerId}, "ownerRole" = ${ownerRole}
      WHERE "id" = ${accrualId}
    `;
  }

  return { ownerId, ownerRole };
}

/**
 * Crea accruals GRNI al confirmar una recepción
 *
 * Se llama desde recepciones/[id]/confirmar/route.ts
 */
export async function crearGRNIAccruals(
  goodsReceipt: {
    id: number;
    companyId: number;
    proveedorId: number;
    moneda?: string;
    docType?: string;
    items: Array<{
      id: number;
      descripcion?: string;
      cantidadAceptada?: number | any;
      precioUnitario?: number | any;
      supplierItemId?: number | null;
    }>;
  },
  userId: number,
  prismaClient: PrismaClient | any
): Promise<{ created: number; montoTotal: number }> {
  const periodo = format(new Date(), 'yyyy-MM');
  let created = 0;
  let montoTotal = 0;

  for (const item of goodsReceipt.items) {
    const cantidad = Number(item.cantidadAceptada || 0);
    const precio = Number(item.precioUnitario || 0);

    // Solo crear accrual si hay cantidad y precio
    if (cantidad > 0 && precio > 0) {
      const montoEstimado = cantidad * precio;
      montoTotal += montoEstimado;

      const accrual = await prismaClient.gRNIAccrual.create({
        data: {
          companyId: goodsReceipt.companyId,
          goodsReceiptId: goodsReceipt.id,
          goodsReceiptItemId: item.id,
          supplierId: goodsReceipt.proveedorId,
          descripcion: item.descripcion || `Item ${item.supplierItemId || item.id}`,
          montoEstimado,
          estado: 'PENDIENTE',
          periodoCreacion: periodo,
          moneda: goodsReceipt.moneda || 'ARS',
          docType: goodsReceipt.docType || 'T1',
          createdBy: userId,
        },
      });

      // Asignar owner
      const { ownerId, ownerRole } = await asignarOwnerGRNI(
        goodsReceipt.companyId,
        accrual.id,
        prismaClient
      );

      // Registrar en audit log
      await logGRNIAction(
        accrual.id,
        goodsReceipt.companyId,
        'CREATE',
        userId,
        {
          toState: 'PENDIENTE',
          montoNuevo: montoEstimado,
          toOwnerId: ownerId || undefined,
          metadata: {
            goodsReceiptId: goodsReceipt.id,
            itemId: item.id,
            supplierItemId: item.supplierItemId,
            ownerRole,
          },
        },
        prismaClient
      );

      created++;
    }
  }

  console.log(`[GRNI] Creados ${created} accruals por $${montoTotal.toFixed(2)} para recepción ${goodsReceipt.id}`);

  return { created, montoTotal };
}

/**
 * Reversa accruals GRNI al vincular factura a recepción
 *
 * Se llama cuando se vincula una factura (comprobante) a una recepción
 */
export async function reversarGRNIAlVincularFactura(
  goodsReceiptId: number,
  facturaId: number,
  userId: number,
  prismaClient: PrismaClient | any
): Promise<{ reversed: number; varianzaTotal: number }> {
  const periodo = format(new Date(), 'yyyy-MM');

  // Buscar accruals pendientes de esta recepción
  const accrualsPendientes = await prismaClient.gRNIAccrual.findMany({
    where: {
      goodsReceiptId,
      estado: 'PENDIENTE',
    },
  });

  if (accrualsPendientes.length === 0) {
    console.log(`[GRNI] No hay accruals pendientes para recepción ${goodsReceiptId}`);
    return { reversed: 0, varianzaTotal: 0 };
  }

  // Obtener factura con items para calcular varianza
  const factura = await prismaClient.purchaseReceipt.findUnique({
    where: { id: facturaId },
    include: {
      items: true,
    },
  });

  let reversed = 0;
  let varianzaTotal = 0;

  for (const accrual of accrualsPendientes) {
    // Intentar encontrar item correspondiente en la factura
    // Matching por goodsReceiptItemId o por descripción
    const itemFactura = factura?.items?.find(
      (i: any) =>
        i.goodsReceiptItemId === accrual.goodsReceiptItemId ||
        i.descripcion?.toLowerCase() === accrual.descripcion?.toLowerCase()
    );

    const montoFacturado = itemFactura
      ? Number(itemFactura.cantidad || 0) * Number(itemFactura.precioUnitario || 0)
      : 0;

    const varianza = montoFacturado - Number(accrual.montoEstimado);
    varianzaTotal += varianza;

    // Obtener companyId del accrual
    const companyId = accrual.companyId;

    await prismaClient.gRNIAccrual.update({
      where: { id: accrual.id },
      data: {
        estado: 'FACTURADO',
        facturaId,
        montoFacturado: montoFacturado > 0 ? montoFacturado : null,
        varianza: varianza,
        periodoFacturacion: periodo,
        reversadoAt: new Date(),
        reversadoBy: userId,
        reasonCode: 'INVOICE_LINKED',
        reasonText: `Facturado con factura #${facturaId}`,
      },
    });

    // Registrar en audit log
    await logGRNIAction(
      accrual.id,
      companyId,
      'FACTURED',
      userId,
      {
        fromState: 'PENDIENTE',
        toState: 'FACTURADO',
        montoAnterior: Number(accrual.montoEstimado),
        montoNuevo: montoFacturado,
        reasonCode: 'INVOICE_LINKED',
        reasonText: `Vinculado a factura #${facturaId}`,
        metadata: {
          facturaId,
          varianza,
          periodoFacturacion: periodo,
        },
      },
      prismaClient
    );

    reversed++;
  }

  console.log(`[GRNI] Reversados ${reversed} accruals con varianza total $${varianzaTotal.toFixed(2)}`);

  return { reversed, varianzaTotal };
}

/**
 * Anula accruals GRNI cuando se anula una recepción
 */
export async function anularGRNIPorRecepcion(
  goodsReceiptId: number,
  userId: number,
  motivoAnulacion: string,
  prismaClient: PrismaClient | any
): Promise<{ anulados: number }> {
  // Obtener los accruals pendientes primero para el audit log
  const accrualsPendientes = await prismaClient.gRNIAccrual.findMany({
    where: {
      goodsReceiptId,
      estado: 'PENDIENTE',
    },
    select: {
      id: true,
      companyId: true,
      montoEstimado: true,
    },
  });

  if (accrualsPendientes.length === 0) {
    return { anulados: 0 };
  }

  // Actualizar todos
  const result = await prismaClient.gRNIAccrual.updateMany({
    where: {
      goodsReceiptId,
      estado: 'PENDIENTE',
    },
    data: {
      estado: 'ANULADO',
      reversadoAt: new Date(),
      reversadoBy: userId,
      motivoReversion: motivoAnulacion,
      reasonCode: 'RECEIPT_VOIDED',
      reasonText: motivoAnulacion,
    },
  });

  // Registrar audit log para cada accrual
  for (const accrual of accrualsPendientes) {
    await logGRNIAction(
      accrual.id,
      accrual.companyId,
      'VOID',
      userId,
      {
        fromState: 'PENDIENTE',
        toState: 'ANULADO',
        montoAnterior: Number(accrual.montoEstimado),
        reasonCode: 'RECEIPT_VOIDED',
        reasonText: motivoAnulacion,
        metadata: {
          goodsReceiptId,
        },
      },
      prismaClient
    );
  }

  console.log(`[GRNI] Anulados ${result.count} accruals por anulación de recepción ${goodsReceiptId}`);

  return { anulados: result.count };
}

/**
 * Obtiene estadísticas de GRNI para el Control Tower
 */
export async function getGRNIStats(
  companyId: number,
  docType: string | null,
  prismaClient: PrismaClient | any
): Promise<{
  totalPendiente: number;
  cantidadRecepciones: number;
  aging: {
    '0-30': number;
    '31-60': number;
    '61-90': number;
    '90+': number;
  };
  topProveedores: Array<{
    id: number;
    nombre: string;
    monto: number;
    dias: number;
  }>;
}> {
  const whereClause = {
    companyId,
    estado: 'PENDIENTE' as const,
    ...(docType && { docType }),
  };

  const accruals = await prismaClient.gRNIAccrual.findMany({
    where: whereClause,
    include: {
      supplier: {
        select: { id: true, name: true },
      },
    },
  });

  const hoy = new Date();
  let totalPendiente = 0;
  const aging = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  const proveedorTotals = new Map<number, { nombre: string; monto: number; fechaMasAntigua: Date }>();
  const goodsReceiptIds = new Set<number>();

  for (const accrual of accruals) {
    const monto = Number(accrual.montoEstimado || 0);
    totalPendiente += monto;
    goodsReceiptIds.add(accrual.goodsReceiptId);

    // Calcular aging
    const dias = differenceInDays(hoy, accrual.createdAt);
    if (dias <= 30) {
      aging['0-30'] += monto;
    } else if (dias <= 60) {
      aging['31-60'] += monto;
    } else if (dias <= 90) {
      aging['61-90'] += monto;
    } else {
      aging['90+'] += monto;
    }

    // Agrupar por proveedor
    const provKey = accrual.supplierId;
    const existing = proveedorTotals.get(provKey);
    if (existing) {
      existing.monto += monto;
      if (accrual.createdAt < existing.fechaMasAntigua) {
        existing.fechaMasAntigua = accrual.createdAt;
      }
    } else {
      proveedorTotals.set(provKey, {
        nombre: accrual.supplier?.name || `Proveedor ${provKey}`,
        monto,
        fechaMasAntigua: accrual.createdAt,
      });
    }
  }

  // Top 5 proveedores por monto
  const topProveedores = Array.from(proveedorTotals.entries())
    .map(([id, data]) => ({
      id,
      nombre: data.nombre,
      monto: data.monto,
      dias: differenceInDays(hoy, data.fechaMasAntigua),
    }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 5);

  return {
    totalPendiente,
    cantidadRecepciones: goodsReceiptIds.size,
    aging,
    topProveedores,
  };
}

/**
 * Obtiene detalle de GRNI para reporte
 */
export async function getGRNIDetalle(
  companyId: number,
  filters: {
    estado?: string;
    supplierId?: number;
    periodoDesde?: string;
    periodoHasta?: string;
    docType?: string;
  },
  prismaClient: PrismaClient | any
): Promise<Array<{
  id: number;
  goodsReceiptId: number;
  numeroRecepcion: string;
  proveedor: { id: number; name: string };
  descripcion: string;
  montoEstimado: number;
  montoFacturado: number | null;
  varianza: number | null;
  estado: string;
  diasPendiente: number;
  periodoCreacion: string;
  facturaNumero: string | null;
}>> {
  const where: any = {
    companyId,
  };

  if (filters.estado) {
    where.estado = filters.estado;
  }
  if (filters.supplierId) {
    where.supplierId = filters.supplierId;
  }
  if (filters.periodoDesde || filters.periodoHasta) {
    where.periodoCreacion = {};
    if (filters.periodoDesde) {
      where.periodoCreacion.gte = filters.periodoDesde;
    }
    if (filters.periodoHasta) {
      where.periodoCreacion.lte = filters.periodoHasta;
    }
  }
  if (filters.docType) {
    where.docType = filters.docType;
  }

  const accruals = await prismaClient.gRNIAccrual.findMany({
    where,
    include: {
      supplier: {
        select: { id: true, name: true },
      },
      goodsReceipt: {
        select: { numero: true },
      },
      factura: {
        select: { numeroFactura: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const hoy = new Date();

  return accruals.map((a: any) => ({
    id: a.id,
    goodsReceiptId: a.goodsReceiptId,
    numeroRecepcion: a.goodsReceipt?.numero || `REC-${a.goodsReceiptId}`,
    proveedor: {
      id: a.supplier?.id || a.supplierId,
      name: a.supplier?.name || 'Desconocido',
    },
    descripcion: a.descripcion || '',
    montoEstimado: Number(a.montoEstimado || 0),
    montoFacturado: a.montoFacturado ? Number(a.montoFacturado) : null,
    varianza: a.varianza ? Number(a.varianza) : null,
    estado: a.estado,
    diasPendiente: a.estado === 'PENDIENTE' ? differenceInDays(hoy, a.createdAt) : 0,
    periodoCreacion: a.periodoCreacion,
    facturaNumero: a.factura?.numeroFactura || null,
  }));
}

/**
 * Procesa alertas de antigüedad de GRNI
 * Crea notificaciones para accruals que exceden los días de alerta
 */
export async function procesarAlertasGRNI(
  companyId: number,
  prismaClient: PrismaClient | any
): Promise<{ alertasEnviadas: number; notificacionesCreadas: number }> {
  // Obtener configuración de alertas
  const config = await prismaClient.$queryRaw<Array<{
    diasAlertaAmarilla: number;
    diasAlertaRoja: number;
    diasAlertaCritica: number;
    emailsNotificar: string[] | null;
  }>>`
    SELECT "diasAlertaAmarilla", "diasAlertaRoja", "diasAlertaCritica", "emailsNotificar"
    FROM "GRNIAlertConfig"
    WHERE "companyId" = ${companyId} AND "isActive" = true
    LIMIT 1
  `;

  if (config.length === 0) {
    return { alertasEnviadas: 0, notificacionesCreadas: 0 };
  }

  const { diasAlertaAmarilla, diasAlertaRoja, diasAlertaCritica } = config[0];
  const hoy = new Date();

  // Buscar accruals que necesitan alerta
  const accrualsSinAlerta = await prismaClient.gRNIAccrual.findMany({
    where: {
      companyId,
      estado: 'PENDIENTE',
      alertaEnviada: false,
    },
    include: {
      supplier: { select: { id: true, name: true } },
      goodsReceipt: { select: { numero: true } },
    },
  });

  let alertasEnviadas = 0;
  let notificacionesCreadas = 0;

  for (const accrual of accrualsSinAlerta) {
    const dias = differenceInDays(hoy, accrual.createdAt);

    let nivelAlerta: 'AMARILLA' | 'ROJA' | 'CRITICA' | null = null;
    let prioridad = 'NORMAL';

    if (dias >= diasAlertaCritica) {
      nivelAlerta = 'CRITICA';
      prioridad = 'URGENTE';
    } else if (dias >= diasAlertaRoja) {
      nivelAlerta = 'ROJA';
      prioridad = 'ALTA';
    } else if (dias >= diasAlertaAmarilla) {
      nivelAlerta = 'AMARILLA';
      prioridad = 'NORMAL';
    }

    if (nivelAlerta) {
      // Marcar como alerta enviada
      await prismaClient.gRNIAccrual.update({
        where: { id: accrual.id },
        data: {
          alertaEnviada: true,
          alertaEnviadaAt: hoy,
          diasAlerta: dias,
        },
      });

      alertasEnviadas++;

      // Crear notificación en NotificationOutbox si el owner existe
      if (accrual.ownerId) {
        try {
          await prismaClient.$executeRaw`
            INSERT INTO "NotificationOutbox" (
              "companyId", "type", "priority", "entityType", "entityId",
              "recipientUserId", "subject", "body", "metadata"
            ) VALUES (
              ${companyId}, 'GRNI_AGING_ALERT', ${prioridad}, 'GRNI_ACCRUAL', ${accrual.id},
              ${accrual.ownerId},
              ${`GRNI ${nivelAlerta}: ${accrual.supplier?.name || 'Proveedor'} - ${dias} días`},
              ${`El accrual GRNI de la recepción ${accrual.goodsReceipt?.numero || accrual.goodsReceiptId} tiene ${dias} días de antigüedad. Monto: $${Number(accrual.montoEstimado).toFixed(2)}`},
              ${JSON.stringify({
                nivelAlerta,
                dias,
                montoEstimado: Number(accrual.montoEstimado),
                supplierId: accrual.supplierId,
                goodsReceiptId: accrual.goodsReceiptId,
              })}::jsonb
            )
          `;
          notificacionesCreadas++;
        } catch (err) {
          console.warn('[GRNI] Error creando notificación:', err);
        }
      }

      // Registrar en audit log
      await logGRNIAction(
        accrual.id,
        companyId,
        'SEND_ALERT',
        0, // Sistema
        {
          reasonCode: `ALERT_${nivelAlerta}`,
          reasonText: `Alerta de antigüedad ${nivelAlerta} - ${dias} días`,
          metadata: {
            nivelAlerta,
            dias,
            ownerId: accrual.ownerId,
          },
        },
        prismaClient
      );
    }
  }

  return { alertasEnviadas, notificacionesCreadas };
}

/**
 * Obtiene el historial de audit log de un accrual GRNI
 */
export async function getGRNIAuditHistory(
  accrualId: number,
  prismaClient: PrismaClient | any
): Promise<Array<{
  id: number;
  action: string;
  fromState: string | null;
  toState: string | null;
  montoAnterior: number | null;
  montoNuevo: number | null;
  reasonCode: string | null;
  reasonText: string | null;
  metadata: any;
  userId: number;
  userName: string | null;
  createdAt: Date;
}>> {
  const history = await prismaClient.$queryRaw<Array<{
    id: number;
    action: string;
    fromState: string | null;
    toState: string | null;
    montoAnterior: number | null;
    montoNuevo: number | null;
    reasonCode: string | null;
    reasonText: string | null;
    metadata: any;
    userId: number;
    userName: string | null;
    createdAt: Date;
  }>>`
    SELECT
      gal.id,
      gal.action,
      gal."fromState",
      gal."toState",
      gal."montoAnterior"::float,
      gal."montoNuevo"::float,
      gal."reasonCode",
      gal."reasonText",
      gal.metadata,
      gal."userId",
      u.name as "userName",
      gal."createdAt"
    FROM "GRNIAuditLog" gal
    LEFT JOIN "User" u ON u.id = gal."userId"
    WHERE gal."grniAccrualId" = ${accrualId}
    ORDER BY gal."createdAt" DESC
  `;

  return history;
}

/**
 * Agrega una nota de seguimiento a un accrual GRNI
 */
export async function agregarNotaGRNI(
  accrualId: number,
  userId: number,
  nota: string,
  prismaClient: PrismaClient | any
): Promise<{ success: boolean }> {
  const accrual = await prismaClient.gRNIAccrual.findUnique({
    where: { id: accrualId },
    select: { id: true, companyId: true, notasSegumiento: true },
  });

  if (!accrual) {
    return { success: false };
  }

  const notaAnterior = accrual.notasSegumiento || '';
  const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm');
  const nuevaNota = notaAnterior
    ? `${notaAnterior}\n[${timestamp}] ${nota}`
    : `[${timestamp}] ${nota}`;

  await prismaClient.gRNIAccrual.update({
    where: { id: accrualId },
    data: {
      notasSegumiento: nuevaNota,
      seguimientoAt: new Date(),
    },
  });

  await logGRNIAction(
    accrualId,
    accrual.companyId,
    'ADD_NOTE',
    userId,
    {
      reasonText: nota,
      metadata: { timestamp },
    },
    prismaClient
  );

  return { success: true };
}

/**
 * Resumen de cierre de período GRNI
 */
export async function getResumenCierrePeriodo(
  companyId: number,
  periodo: string, // formato YYYY-MM
  docType: string | null,
  prismaClient: PrismaClient | any
): Promise<{
  periodo: string;
  accrualCreados: number;
  montoCreado: number;
  accrualCerrados: number;
  montoCerrado: number;
  varianzaTotal: number;
  saldoPendiente: number;
}> {
  const whereBase = {
    companyId,
    ...(docType && { docType }),
  };

  // Accruals creados en el período
  const creados = await prismaClient.gRNIAccrual.aggregate({
    where: {
      ...whereBase,
      periodoCreacion: periodo,
    },
    _count: { id: true },
    _sum: { montoEstimado: true },
  });

  // Accruals cerrados (facturados) en el período
  const cerrados = await prismaClient.gRNIAccrual.aggregate({
    where: {
      ...whereBase,
      periodoFacturacion: periodo,
      estado: 'FACTURADO',
    },
    _count: { id: true },
    _sum: { montoFacturado: true, varianza: true },
  });

  // Saldo pendiente al fin del período
  const pendientes = await prismaClient.gRNIAccrual.aggregate({
    where: {
      ...whereBase,
      estado: 'PENDIENTE',
      periodoCreacion: { lte: periodo },
    },
    _sum: { montoEstimado: true },
  });

  return {
    periodo,
    accrualCreados: creados._count.id || 0,
    montoCreado: Number(creados._sum.montoEstimado || 0),
    accrualCerrados: cerrados._count.id || 0,
    montoCerrado: Number(cerrados._sum.montoFacturado || 0),
    varianzaTotal: Number(cerrados._sum.varianza || 0),
    saldoPendiente: Number(pendientes._sum.montoEstimado || 0),
  };
}
