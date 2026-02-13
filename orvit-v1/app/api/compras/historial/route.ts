import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import {
  type AuditableEntity,
  type AuditAction,
  ENTIDAD_CONFIG,
  buildHumanMessage,
  buildDocumentUrl,
  getEntidadLabel,
} from '@/lib/compras/audit-config';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { getViewMode } from '@/lib/view-mode/get-mode';
import { MODE } from '@/lib/view-mode/types';
import { applyViewMode } from '@/lib/view-mode/prisma-helper';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

interface UserPayload {
  userId: number;
  companyId?: number;
}

async function getUserFromToken(): Promise<{
  id: number;
  name: string;
  companyId: number;
} | null> {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    const userPayload = payload as unknown as UserPayload;

    const user = await prisma.user.findUnique({
      where: { id: userPayload.userId },
      select: {
        id: true,
        name: true,
        companies: {
          select: { companyId: true },
          take: 1,
        },
      },
    });

    if (!user || !user.companies?.[0]?.companyId) return null;

    return {
      id: user.id,
      name: user.name || '',
      companyId: user.companies[0].companyId,
    };
  } catch {
    return null;
  }
}

// Encode cursor: createdAt_id
function encodeCursor(createdAt: Date, id: number): string {
  return Buffer.from(`${createdAt.toISOString()}_${id}`).toString('base64');
}

// Decode cursor
function decodeCursor(cursor: string): { createdAt: Date; id: number } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const [dateStr, idStr] = decoded.split('_');
    return {
      createdAt: new Date(dateStr),
      id: parseInt(idStr, 10),
    };
  } catch {
    return null;
  }
}

// Obtener número de documento según entidad
async function getNumeroDocumento(
  entidad: string,
  entidadId: number
): Promise<string> {
  try {
    switch (entidad) {
      case 'purchase_order': {
        const po = await prisma.purchaseOrder.findUnique({
          where: { id: entidadId },
          select: { numero: true },
        });
        return po?.numero || `OC-${entidadId}`;
      }
      case 'goods_receipt': {
        const gr = await prisma.goodsReceipt.findUnique({
          where: { id: entidadId },
          select: { numero: true },
        });
        return gr?.numero || `REC-${entidadId}`;
      }
      case 'purchase_receipt': {
        const pr = await prisma.purchaseReceipt.findUnique({
          where: { id: entidadId },
          select: { numeroSerie: true, numeroFactura: true },
        });
        return pr ? `${pr.numeroSerie || ''}-${pr.numeroFactura || entidadId}` : `COMP-${entidadId}`;
      }
      case 'payment_order': {
        const paym = await prisma.paymentOrder.findUnique({
          where: { id: entidadId },
          select: { numero: true },
        });
        return paym?.numero || `OP-${entidadId}`;
      }
      case 'payment_request': {
        const req = await prisma.paymentRequest.findUnique({
          where: { id: entidadId },
          select: { numero: true },
        });
        return req?.numero || `SP-${entidadId}`;
      }
      case 'credit_debit_note': {
        const cdn = await prisma.creditDebitNote.findUnique({
          where: { id: entidadId },
          select: { numero: true },
        });
        return cdn?.numero || `NC-${entidadId}`;
      }
      default:
        return `DOC-${entidadId}`;
    }
  } catch {
    return `DOC-${entidadId}`;
  }
}

// Obtener proveedor según entidad
async function getProveedorInfo(
  entidad: string,
  entidadId: number
): Promise<{ id: number; nombre: string } | null> {
  try {
    switch (entidad) {
      case 'purchase_order': {
        const po = await prisma.purchaseOrder.findUnique({
          where: { id: entidadId },
          select: { proveedor: { select: { id: true, name: true } } },
        });
        return po?.proveedor ? { id: po.proveedor.id, nombre: po.proveedor.name } : null;
      }
      case 'goods_receipt': {
        const gr = await prisma.goodsReceipt.findUnique({
          where: { id: entidadId },
          select: { proveedor: { select: { id: true, name: true } } },
        });
        return gr?.proveedor ? { id: gr.proveedor.id, nombre: gr.proveedor.name } : null;
      }
      case 'purchase_receipt': {
        const pr = await prisma.purchaseReceipt.findUnique({
          where: { id: entidadId },
          select: { proveedor: { select: { id: true, name: true } } },
        });
        return pr?.proveedor ? { id: pr.proveedor.id, nombre: pr.proveedor.name } : null;
      }
      case 'payment_request': {
        const req = await prisma.paymentRequest.findUnique({
          where: { id: entidadId },
          select: { proveedor: { select: { id: true, name: true } } },
        });
        return req?.proveedor ? { id: req.proveedor.id, nombre: req.proveedor.name } : null;
      }
      case 'credit_debit_note': {
        const cdn = await prisma.creditDebitNote.findUnique({
          where: { id: entidadId },
          select: { proveedor: { select: { id: true, name: true } } },
        });
        return cdn?.proveedor ? { id: cdn.proveedor.id, nombre: cdn.proveedor.name } : null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // Parámetros
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100);
    const entidad = searchParams.get('entidad') as AuditableEntity | 'all' | null;
    const accion = searchParams.get('accion') as AuditAction | 'all' | null;
    const proveedorId = searchParams.get('proveedorId');
    const userId = searchParams.get('userId');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
    const search = searchParams.get('search');
    const mode = (searchParams.get('mode') || 'lite') as 'lite' | 'full';

    // Get ViewMode from middleware header
    const viewMode = getViewMode(request);

    // Construir where base
    const baseWhere: Prisma.PurchaseAuditLogWhereInput = {
      companyId: user.companyId,
    };

    // Aplicar filtro de ViewMode usando applyViewMode (usa NOT T2 para compatibilidad con Prisma)
    // Standard: NOT T2 (equivale a T1 + null), Extended: sin filtro
    const where: Prisma.PurchaseAuditLogWhereInput = applyViewMode(baseWhere, viewMode);

    // Filtro por entidad
    if (entidad && entidad !== 'all') {
      where.entidad = entidad;
    }

    // Filtro por acción
    if (accion && accion !== 'all') {
      where.accion = accion;
    }

    // Filtro por usuario
    if (userId) {
      where.userId = parseInt(userId);
    }

    // Filtro por fechas
    if (fechaDesde || fechaHasta) {
      where.createdAt = {};
      if (fechaDesde) {
        where.createdAt.gte = new Date(fechaDesde);
      }
      if (fechaHasta) {
        const hasta = new Date(fechaHasta);
        hasta.setHours(23, 59, 59, 999);
        where.createdAt.lte = hasta;
      }
    }

    // Cursor pagination
    // applyViewMode usa NOT (no OR), así que podemos agregar el cursor OR directamente
    if (cursor) {
      const decodedCursor = decodeCursor(cursor);
      if (decodedCursor) {
        where.OR = [
          { createdAt: { lt: decodedCursor.createdAt } },
          {
            createdAt: decodedCursor.createdAt,
            id: { lt: decodedCursor.id },
          },
        ];
      }
    }

    // Query principal
    const logs = await prisma.purchaseAuditLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1, // +1 para saber si hay más
    });

    // Verificar si hay más resultados
    const hasMore = logs.length > limit;
    const results = hasMore ? logs.slice(0, limit) : logs;

    // Buscar por número de documento (post-filter si search está activo)
    let filteredResults = results;
    if (search) {
      const searchLower = search.toLowerCase();
      const enrichedResults = await Promise.all(
        results.map(async (log) => {
          const numero = await getNumeroDocumento(log.entidad, log.entidadId);
          return { ...log, numeroDocumento: numero };
        })
      );
      filteredResults = enrichedResults.filter((r) =>
        r.numeroDocumento.toLowerCase().includes(searchLower)
      );
    }

    // Enriquecer resultados
    const eventos = await Promise.all(
      filteredResults.map(async (log) => {
        const numeroDocumento =
          (log as any).numeroDocumento ||
          (await getNumeroDocumento(log.entidad, log.entidadId));

        // Obtener proveedor solo en mode=full o si hay filtro de proveedor
        let proveedor: { id: number; nombre: string } | null = null;
        if (mode === 'full' || proveedorId) {
          proveedor = await getProveedorInfo(log.entidad, log.entidadId);
        }

        // Filtrar por proveedor si está activo
        if (proveedorId && proveedor?.id !== parseInt(proveedorId)) {
          return null;
        }

        // Extraer metadata
        const datosNuevos = log.datosNuevos as Record<string, any> | null;
        const datosAnteriores = log.datosAnteriores as Record<string, any> | null;
        const estadoAnterior = datosAnteriores?.estado;
        const estadoNuevo = datosNuevos?.estado;

        return {
          id: log.id,
          eventKey: `purchase_audit:${log.id}`,
          entidad: log.entidad as AuditableEntity,
          entidadId: log.entidadId,
          numeroDocumento,
          documentUrl: buildDocumentUrl(log.entidad as AuditableEntity, log.entidadId),
          entidadLabel: getEntidadLabel(log.entidad as AuditableEntity),
          accion: log.accion as AuditAction,
          message: buildHumanMessage(log.accion as AuditAction, {
            estadoAnterior,
            estadoNuevo,
            reason: datosNuevos?.reason,
          }),
          estadoAnterior,
          estadoNuevo,
          metadata: {
            reason: datosNuevos?.reason,
            amount: datosNuevos?.amount,
            relatedIds: datosNuevos?.relatedIds,
          },
          proveedor,
          usuario: {
            id: log.user?.id || log.userId,
            nombre: log.user?.name || 'Usuario',
          },
          createdAt: log.createdAt.toISOString(),
          relativeTime: formatDistanceToNow(log.createdAt, {
            addSuffix: true,
            locale: es,
          }),
        };
      })
    );

    // Filtrar nulls (por filtro de proveedor)
    const eventosFiltered = eventos.filter((e) => e !== null);

    // Calcular nextCursor
    let nextCursor: string | undefined;
    if (hasMore && results.length > 0) {
      const lastResult = results[results.length - 1];
      nextCursor = encodeCursor(lastResult.createdAt, lastResult.id);
    }

    // Contar total (para UX, opcional)
    const total = await prisma.purchaseAuditLog.count({
      where: { companyId: user.companyId },
    });

    return NextResponse.json({
      eventos: eventosFiltered,
      nextCursor,
      total,
    });
  } catch (error) {
    console.error('Error en historial:', error);
    return NextResponse.json(
      { error: 'Error al obtener historial' },
      { status: 500 }
    );
  }
}
