/**
 * Control Tower Queues - Bandejas de trabajo por rol
 *
 * Proporciona vistas filtradas del Control Tower según el rol del usuario:
 * - COMPRAS_ANALISTA: Excepciones de match, pedidos pendientes
 * - COMPRAS_SUPERVISOR: Aprobaciones pendientes, escalados
 * - ALMACEN_SUPERVISOR: Recepciones pendientes, GRNI
 * - TESORERIA: Pagos pendientes, cambios bancarios
 * - GERENCIA: Vista ejecutiva, KPIs
 */

import { PrismaClient } from '@prisma/client';
import { differenceInDays, addDays } from 'date-fns';

// ============================================================
// TIPOS
// ============================================================

export type QueueRole =
  | 'COMPRAS_ANALISTA'
  | 'COMPRAS_SUPERVISOR'
  | 'COMPRAS_GERENTE'
  | 'ALMACEN_SUPERVISOR'
  | 'TESORERIA'
  | 'TESORERIA_GERENTE'
  | 'GERENCIA';

export interface QueueItem {
  id: number;
  tipo: string;
  prioridad: 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE';
  titulo: string;
  descripcion: string;
  monto?: number;
  diasPendiente: number;
  slaBreached: boolean;
  entityType: string;
  entityId: number;
  actionRequired: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface RoleQueue {
  role: QueueRole;
  total: number;
  urgentes: number;
  slaBreach: number;
  items: QueueItem[];
}

// ============================================================
// QUERIES POR ROL
// ============================================================

/**
 * Obtiene la bandeja de trabajo para un rol específico
 */
export async function getQueueForRole(
  companyId: number,
  role: QueueRole,
  userId: number,
  prismaClient: PrismaClient | any,
  options?: {
    limit?: number;
    includeResolved?: boolean;
    docType?: string | null;
  }
): Promise<RoleQueue> {
  const limit = options?.limit || 50;
  const hoy = new Date();

  switch (role) {
    case 'COMPRAS_ANALISTA':
      return getComprasAnalistaQueue(companyId, userId, prismaClient, limit, options?.docType);

    case 'COMPRAS_SUPERVISOR':
      return getComprasSupervisorQueue(companyId, userId, prismaClient, limit, options?.docType);

    case 'ALMACEN_SUPERVISOR':
      return getAlmacenSupervisorQueue(companyId, userId, prismaClient, limit, options?.docType);

    case 'TESORERIA':
      return getTesoreriaQueue(companyId, userId, prismaClient, limit, options?.docType);

    case 'TESORERIA_GERENTE':
      return getTesoreriaGerenteQueue(companyId, userId, prismaClient, limit, options?.docType);

    case 'COMPRAS_GERENTE':
    case 'GERENCIA':
      return getGerenciaQueue(companyId, prismaClient, limit, options?.docType);

    default:
      return { role, total: 0, urgentes: 0, slaBreach: 0, items: [] };
  }
}

/**
 * Bandeja para Analista de Compras
 * - Excepciones de match asignadas
 * - GRNI pendientes
 */
async function getComprasAnalistaQueue(
  companyId: number,
  userId: number,
  prismaClient: PrismaClient | any,
  limit: number,
  docType?: string | null
): Promise<RoleQueue> {
  const items: QueueItem[] = [];
  const hoy = new Date();

  // 1. Excepciones de match asignadas al usuario o al rol
  const excepciones = await prismaClient.$queryRaw<Array<{
    id: number;
    tipo: string;
    campo: string;
    montoAfectado: number | null;
    prioridad: string | null;
    slaDeadline: Date | null;
    slaBreached: boolean;
    createdAt: Date;
    facturaId: number | null;
    facturaNumero: string | null;
  }>>`
    SELECT
      me.id,
      me.tipo,
      me.campo,
      me."montoAfectado"::float,
      me.prioridad,
      me."slaDeadline",
      me."slaBreached",
      me."createdAt",
      pr.id as "facturaId",
      CONCAT(pr.tipo, ' ', pr."numeroSerie", '-', pr."numeroFactura") as "facturaNumero"
    FROM "match_exceptions" me
    JOIN "MatchResult" mr ON mr.id = me."matchResultId"
    LEFT JOIN "PurchaseReceipt" pr ON pr.id = mr."facturaId"
    WHERE mr."companyId" = ${companyId}
    AND me."resuelto" = false
    AND (me."ownerId" = ${userId} OR me."ownerRole" = 'COMPRAS_ANALISTA')
    ${docType ? `AND mr."docType" = ${docType}` : ''}
    ORDER BY
      CASE me.prioridad WHEN 'URGENTE' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'NORMAL' THEN 3 ELSE 4 END,
      me."slaDeadline" ASC NULLS LAST
    LIMIT ${limit}
  `;

  for (const exc of excepciones) {
    items.push({
      id: exc.id,
      tipo: 'MATCH_EXCEPTION',
      prioridad: (exc.prioridad as QueueItem['prioridad']) || 'NORMAL',
      titulo: `Excepción: ${exc.tipo}`,
      descripcion: exc.campo,
      monto: exc.montoAfectado || undefined,
      diasPendiente: differenceInDays(hoy, exc.createdAt),
      slaBreached: exc.slaBreached,
      entityType: 'MatchException',
      entityId: exc.id,
      actionRequired: 'RESOLVER_EXCEPCION',
      actionUrl: exc.facturaId ? `/administracion/compras/facturas/${exc.facturaId}` : undefined,
      metadata: { facturaNumero: exc.facturaNumero },
    });
  }

  // 2. GRNI pendientes (si tiene menos excepciones)
  if (items.length < limit) {
    const grniItems = await prismaClient.$queryRaw<Array<{
      id: number;
      descripcion: string | null;
      montoEstimado: number;
      createdAt: Date;
      diasAlerta: number | null;
      proveedorNombre: string | null;
      recepcionId: number;
    }>>`
      SELECT
        ga.id,
        ga.descripcion,
        ga."montoEstimado"::float,
        ga."createdAt",
        ga."diasAlerta",
        s.name as "proveedorNombre",
        ga."goodsReceiptId" as "recepcionId"
      FROM "grni_accruals" ga
      LEFT JOIN "suppliers" s ON s.id = ga."supplierId"
      WHERE ga."companyId" = ${companyId}
      AND ga.estado = 'PENDIENTE'
      AND (ga."ownerId" = ${userId} OR ga."ownerRole" = 'COMPRAS_ANALISTA')
      ${docType ? `AND ga."docType" = ${docType}` : ''}
      ORDER BY ga."createdAt" ASC
      LIMIT ${limit - items.length}
    `;

    for (const grni of grniItems) {
      const dias = differenceInDays(hoy, grni.createdAt);
      items.push({
        id: grni.id,
        tipo: 'GRNI_PENDIENTE',
        prioridad: dias > 60 ? 'ALTA' : dias > 30 ? 'NORMAL' : 'BAJA',
        titulo: `GRNI: ${grni.proveedorNombre || 'Proveedor'}`,
        descripcion: grni.descripcion || `Recepción sin facturar`,
        monto: grni.montoEstimado,
        diasPendiente: dias,
        slaBreached: dias > (grni.diasAlerta || 30),
        entityType: 'GRNIAccrual',
        entityId: grni.id,
        actionRequired: 'SEGUIMIENTO_GRNI',
        actionUrl: `/administracion/compras/recepciones/${grni.recepcionId}`,
      });
    }
  }

  return {
    role: 'COMPRAS_ANALISTA',
    total: items.length,
    urgentes: items.filter(i => i.prioridad === 'URGENTE').length,
    slaBreach: items.filter(i => i.slaBreached).length,
    items,
  };
}

/**
 * Bandeja para Supervisor de Compras
 * - Pedidos pendientes de aprobación
 * - OCs pendientes de aprobación
 * - Excepciones escaladas
 */
async function getComprasSupervisorQueue(
  companyId: number,
  userId: number,
  prismaClient: PrismaClient | any,
  limit: number,
  docType?: string | null
): Promise<RoleQueue> {
  const items: QueueItem[] = [];
  const hoy = new Date();

  // 1. Pedidos pendientes de aprobación
  const pedidos = await prismaClient.purchaseRequest.findMany({
    where: {
      companyId,
      estado: 'EN_APROBACION',
    },
    include: {
      solicitante: { select: { name: true } },
    },
    orderBy: [
      { prioridad: 'desc' },
      { createdAt: 'asc' },
    ],
    take: limit,
  });

  for (const pedido of pedidos) {
    const dias = differenceInDays(hoy, pedido.createdAt);
    items.push({
      id: pedido.id,
      tipo: 'PEDIDO_APROBACION',
      prioridad: pedido.prioridad as QueueItem['prioridad'],
      titulo: `Pedido ${pedido.numero}`,
      descripcion: `${pedido.titulo} - Solicitado por ${pedido.solicitante?.name || 'N/A'}`,
      monto: Number(pedido.presupuestoEstimado || 0),
      diasPendiente: dias,
      slaBreached: dias > 3,
      entityType: 'PurchaseRequest',
      entityId: pedido.id,
      actionRequired: 'APROBAR_PEDIDO',
      actionUrl: `/administracion/compras/pedidos/${pedido.id}`,
    });
  }

  // 2. OCs pendientes de aprobación (si hay espacio)
  if (items.length < limit) {
    const ocs = await prismaClient.purchaseOrder.findMany({
      where: {
        companyId,
        estado: 'PENDIENTE_APROBACION',
        ...(docType && { docType }),
      },
      include: {
        proveedor: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: limit - items.length,
    });

    for (const oc of ocs) {
      const dias = differenceInDays(hoy, oc.createdAt);
      items.push({
        id: oc.id,
        tipo: 'OC_APROBACION',
        prioridad: dias > 2 ? 'ALTA' : 'NORMAL',
        titulo: `OC ${oc.numero}`,
        descripcion: `${oc.proveedor?.name || 'Proveedor'}`,
        monto: Number(oc.total || 0),
        diasPendiente: dias,
        slaBreached: dias > 2,
        entityType: 'PurchaseOrder',
        entityId: oc.id,
        actionRequired: 'APROBAR_OC',
        actionUrl: `/administracion/compras/ordenes/${oc.id}`,
      });
    }
  }

  // 3. Excepciones escaladas
  if (items.length < limit) {
    const escalados = await prismaClient.$queryRaw<Array<{
      id: number;
      tipo: string;
      montoAfectado: number | null;
      createdAt: Date;
      facturaNumero: string | null;
    }>>`
      SELECT
        me.id,
        me.tipo,
        me."montoAfectado"::float,
        me."createdAt",
        CONCAT(pr.tipo, ' ', pr."numeroSerie", '-', pr."numeroFactura") as "facturaNumero"
      FROM "match_exceptions" me
      JOIN "MatchResult" mr ON mr.id = me."matchResultId"
      LEFT JOIN "PurchaseReceipt" pr ON pr.id = mr."facturaId"
      WHERE mr."companyId" = ${companyId}
      AND me."resuelto" = false
      AND me."escalatedTo" IS NOT NULL
      AND me."ownerRole" = 'COMPRAS_SUPERVISOR'
      LIMIT ${limit - items.length}
    `;

    for (const exc of escalados) {
      items.push({
        id: exc.id,
        tipo: 'EXCEPCION_ESCALADA',
        prioridad: 'URGENTE',
        titulo: `Escalado: ${exc.tipo}`,
        descripcion: `Factura: ${exc.facturaNumero || 'N/A'}`,
        monto: exc.montoAfectado || undefined,
        diasPendiente: differenceInDays(hoy, exc.createdAt),
        slaBreached: true,
        entityType: 'MatchException',
        entityId: exc.id,
        actionRequired: 'RESOLVER_ESCALADO',
      });
    }
  }

  return {
    role: 'COMPRAS_SUPERVISOR',
    total: items.length,
    urgentes: items.filter(i => i.prioridad === 'URGENTE').length,
    slaBreach: items.filter(i => i.slaBreached).length,
    items,
  };
}

/**
 * Bandeja para Supervisor de Almacén
 * - Recepciones pendientes
 * - OCs por recibir vencidas
 */
async function getAlmacenSupervisorQueue(
  companyId: number,
  userId: number,
  prismaClient: PrismaClient | any,
  limit: number,
  docType?: string | null
): Promise<RoleQueue> {
  const items: QueueItem[] = [];
  const hoy = new Date();

  // 1. OCs vencidas (fecha entrega pasada)
  const ocsVencidas = await prismaClient.purchaseOrder.findMany({
    where: {
      companyId,
      estado: { in: ['ENVIADA_PROVEEDOR', 'CONFIRMADA', 'PARCIALMENTE_RECIBIDA'] },
      fechaEntregaEstimada: { lt: hoy },
      ...(docType && { docType }),
    },
    include: {
      proveedor: { select: { name: true } },
    },
    orderBy: { fechaEntregaEstimada: 'asc' },
    take: limit,
  });

  for (const oc of ocsVencidas) {
    const diasVencida = oc.fechaEntregaEstimada ? differenceInDays(hoy, oc.fechaEntregaEstimada) : 0;
    items.push({
      id: oc.id,
      tipo: 'OC_VENCIDA',
      prioridad: diasVencida > 7 ? 'URGENTE' : diasVencida > 3 ? 'ALTA' : 'NORMAL',
      titulo: `OC ${oc.numero} vencida`,
      descripcion: `${oc.proveedor?.name} - ${diasVencida} días de retraso`,
      monto: Number(oc.total || 0),
      diasPendiente: diasVencida,
      slaBreached: true,
      entityType: 'PurchaseOrder',
      entityId: oc.id,
      actionRequired: 'SEGUIMIENTO_OC',
      actionUrl: `/administracion/compras/ordenes/${oc.id}`,
    });
  }

  // 2. Recepciones en borrador
  if (items.length < limit) {
    const recepcionesBorrador = await prismaClient.goodsReceipt.findMany({
      where: {
        companyId,
        estado: 'BORRADOR',
        ...(docType && { docType }),
      },
      include: {
        proveedor: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: limit - items.length,
    });

    for (const rec of recepcionesBorrador) {
      const dias = differenceInDays(hoy, rec.createdAt);
      items.push({
        id: rec.id,
        tipo: 'RECEPCION_BORRADOR',
        prioridad: dias > 3 ? 'ALTA' : 'NORMAL',
        titulo: `Recepción ${rec.numero}`,
        descripcion: `${rec.proveedor?.name} - Pendiente de confirmar`,
        diasPendiente: dias,
        slaBreached: dias > 2,
        entityType: 'GoodsReceipt',
        entityId: rec.id,
        actionRequired: 'CONFIRMAR_RECEPCION',
        actionUrl: `/administracion/compras/recepciones/${rec.id}`,
      });
    }
  }

  return {
    role: 'ALMACEN_SUPERVISOR',
    total: items.length,
    urgentes: items.filter(i => i.prioridad === 'URGENTE').length,
    slaBreach: items.filter(i => i.slaBreached).length,
    items,
  };
}

/**
 * Bandeja para Tesorería
 * - Pagos pendientes de aprobación
 * - Cambios bancarios pendientes
 */
async function getTesoreriaQueue(
  companyId: number,
  userId: number,
  prismaClient: PrismaClient | any,
  limit: number,
  docType?: string | null
): Promise<RoleQueue> {
  const items: QueueItem[] = [];
  const hoy = new Date();

  // 1. Pagos pendientes de aprobación
  const pagosPendientes = await prismaClient.paymentOrder.findMany({
    where: {
      companyId,
      estado: 'PENDIENTE_APROBACION',
    },
    include: {
      proveedor: { select: { name: true } },
    },
    orderBy: { fechaPago: 'asc' },
    take: limit,
  });

  for (const pago of pagosPendientes) {
    const dias = differenceInDays(hoy, pago.createdAt);
    items.push({
      id: pago.id,
      tipo: 'PAGO_APROBACION',
      prioridad: dias > 2 ? 'ALTA' : 'NORMAL',
      titulo: `Pago ${pago.numero}`,
      descripcion: `${pago.proveedor?.name || 'Proveedor'}`,
      monto: Number(pago.totalPago || 0),
      diasPendiente: dias,
      slaBreached: dias > 3,
      entityType: 'PaymentOrder',
      entityId: pago.id,
      actionRequired: 'APROBAR_PAGO',
      actionUrl: `/administracion/compras/pagos/${pago.id}`,
    });
  }

  // 2. Cambios bancarios pendientes
  if (items.length < limit) {
    const cambiosBancarios = await prismaClient.supplierChangeRequest.findMany({
      where: {
        companyId,
        estado: 'PENDIENTE_APROBACION',
        tipo: 'CAMBIO_BANCARIO',
      },
      include: {
        supplier: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: limit - items.length,
    });

    for (const cambio of cambiosBancarios) {
      const dias = differenceInDays(hoy, cambio.createdAt);
      items.push({
        id: cambio.id,
        tipo: 'CAMBIO_BANCARIO',
        prioridad: 'URGENTE', // Cambios bancarios siempre urgentes
        titulo: `Cambio bancario: ${cambio.supplier?.name}`,
        descripcion: `Cambio de datos bancarios pendiente de aprobación`,
        diasPendiente: dias,
        slaBreached: dias > 1,
        entityType: 'SupplierChangeRequest',
        entityId: cambio.id,
        actionRequired: 'APROBAR_CAMBIO_BANCARIO',
        actionUrl: `/administracion/proveedores/${cambio.supplierId}`,
      });
    }
  }

  return {
    role: 'TESORERIA',
    total: items.length,
    urgentes: items.filter(i => i.prioridad === 'URGENTE').length,
    slaBreach: items.filter(i => i.slaBreached).length,
    items,
  };
}

/**
 * Bandeja para Gerente de Tesorería
 * - Pagos que requieren doble aprobación
 * - Pagos de alto monto
 */
async function getTesoreriaGerenteQueue(
  companyId: number,
  userId: number,
  prismaClient: PrismaClient | any,
  limit: number,
  docType?: string | null
): Promise<RoleQueue> {
  const items: QueueItem[] = [];
  const hoy = new Date();

  // Pagos que requieren segunda aprobación
  const pagosDobleAprobacion = await prismaClient.paymentOrder.findMany({
    where: {
      companyId,
      OR: [
        { estado: 'PENDIENTE_SEGUNDA_APROBACION' },
        { estado: 'PENDIENTE_APROBACION', requiereDobleAprobacion: true },
      ],
    },
    include: {
      proveedor: { select: { name: true } },
    },
    orderBy: { fechaPago: 'asc' },
    take: limit,
  });

  for (const pago of pagosDobleAprobacion) {
    const dias = differenceInDays(hoy, pago.createdAt);
    items.push({
      id: pago.id,
      tipo: 'PAGO_DOBLE_APROBACION',
      prioridad: 'URGENTE',
      titulo: `Pago alto monto: ${pago.numero}`,
      descripcion: `${pago.proveedor?.name} - Requiere segunda aprobación`,
      monto: Number(pago.totalPago || 0),
      diasPendiente: dias,
      slaBreached: dias > 1,
      entityType: 'PaymentOrder',
      entityId: pago.id,
      actionRequired: 'SEGUNDA_APROBACION',
      actionUrl: `/administracion/compras/pagos/${pago.id}`,
    });
  }

  return {
    role: 'TESORERIA_GERENTE',
    total: items.length,
    urgentes: items.filter(i => i.prioridad === 'URGENTE').length,
    slaBreach: items.filter(i => i.slaBreached).length,
    items,
  };
}

/**
 * Bandeja para Gerencia
 * - Vista ejecutiva con KPIs y alertas críticas
 */
async function getGerenciaQueue(
  companyId: number,
  prismaClient: PrismaClient | any,
  limit: number,
  docType?: string | null
): Promise<RoleQueue> {
  const items: QueueItem[] = [];
  const hoy = new Date();

  // 1. Alertas críticas (SLA breach, alto monto)
  const alertasCriticas = await prismaClient.$queryRaw<Array<{
    tipo: string;
    count: bigint;
    montoTotal: number | null;
  }>>`
    SELECT 'EXCEPCIONES_SLA_BREACH' as tipo, COUNT(*) as count, SUM(me."montoAfectado")::float as "montoTotal"
    FROM "match_exceptions" me
    JOIN "MatchResult" mr ON mr.id = me."matchResultId"
    WHERE mr."companyId" = ${companyId}
    AND me."resuelto" = false
    AND me."slaBreached" = true

    UNION ALL

    SELECT 'GRNI_CRITICO' as tipo, COUNT(*) as count, SUM(ga."montoEstimado")::float as "montoTotal"
    FROM "grni_accruals" ga
    WHERE ga."companyId" = ${companyId}
    AND ga.estado = 'PENDIENTE'
    AND ga."createdAt" < NOW() - INTERVAL '90 days'

    UNION ALL

    SELECT 'PAGOS_PENDIENTES_ALTO' as tipo, COUNT(*) as count, SUM(po."totalPago")::float as "montoTotal"
    FROM "PaymentOrder" po
    WHERE po."companyId" = ${companyId}
    AND po.estado = 'PENDIENTE_APROBACION'
    AND po."totalPago" > 500000
  `;

  for (const alerta of alertasCriticas) {
    if (Number(alerta.count) > 0) {
      items.push({
        id: 0,
        tipo: alerta.tipo,
        prioridad: 'URGENTE',
        titulo: getAlertaTitulo(alerta.tipo),
        descripcion: `${Number(alerta.count)} items - Total: $${(alerta.montoTotal || 0).toLocaleString()}`,
        monto: alerta.montoTotal || undefined,
        diasPendiente: 0,
        slaBreached: true,
        entityType: 'ALERT',
        entityId: 0,
        actionRequired: 'REVISAR',
      });
    }
  }

  return {
    role: 'GERENCIA',
    total: items.length,
    urgentes: items.filter(i => i.prioridad === 'URGENTE').length,
    slaBreach: items.filter(i => i.slaBreached).length,
    items,
  };
}

function getAlertaTitulo(tipo: string): string {
  switch (tipo) {
    case 'EXCEPCIONES_SLA_BREACH': return 'Excepciones con SLA vencido';
    case 'GRNI_CRITICO': return 'GRNI crítico (>90 días)';
    case 'PAGOS_PENDIENTES_ALTO': return 'Pagos alto monto pendientes';
    default: return tipo;
  }
}

// ============================================================
// FUNCIÓN PRINCIPAL
// ============================================================

/**
 * Obtiene todas las bandejas relevantes para un usuario según sus roles
 */
export async function getAllQueuesForUser(
  userId: number,
  companyId: number,
  prismaClient: PrismaClient | any,
  docType?: string | null
): Promise<Record<QueueRole, RoleQueue>> {
  // Obtener roles del usuario
  const userRoles = await prismaClient.$queryRaw<Array<{ name: string }>>`
    SELECT r.name
    FROM "Role" r
    JOIN "user_company_roles" ucr ON ucr."roleId" = r.id
    JOIN "user_companies" uc ON uc.id = ucr."userCompanyId"
    WHERE uc."userId" = ${userId}
    AND uc."companyId" = ${companyId}
  `;

  const roleNames = userRoles.map(r => r.name);

  // Mapear roles del sistema a roles de cola
  const queueRoles = new Set<QueueRole>();
  for (const role of roleNames) {
    if (role.includes('ANALISTA') || role.includes('COMPRAS')) {
      queueRoles.add('COMPRAS_ANALISTA');
    }
    if (role.includes('SUPERVISOR') && role.includes('COMPRAS')) {
      queueRoles.add('COMPRAS_SUPERVISOR');
    }
    if (role.includes('ALMACEN') || role.includes('BODEGA') || role.includes('DEPOSITO')) {
      queueRoles.add('ALMACEN_SUPERVISOR');
    }
    if (role.includes('TESORERIA') || role.includes('PAGOS')) {
      queueRoles.add('TESORERIA');
    }
    if (role.includes('GERENTE') && (role.includes('TESORERIA') || role.includes('FINANZAS'))) {
      queueRoles.add('TESORERIA_GERENTE');
    }
    if (role.includes('GERENTE') || role.includes('DIRECTOR') || role.includes('ADMIN')) {
      queueRoles.add('GERENCIA');
    }
  }

  // Si no tiene roles específicos, darle al menos la vista de analista
  if (queueRoles.size === 0) {
    queueRoles.add('COMPRAS_ANALISTA');
  }

  // Obtener cada cola
  const queues: Record<string, RoleQueue> = {};
  for (const role of queueRoles) {
    queues[role] = await getQueueForRole(companyId, role, userId, prismaClient, { docType });
  }

  return queues as Record<QueueRole, RoleQueue>;
}
