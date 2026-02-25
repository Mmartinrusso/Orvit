import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { PurchaseRequestStatus, RequestPriority, Prisma } from '@prisma/client';
import { cache, CacheKeys, CacheTTL } from '@/lib/cache';
import { evaluarRequiereAprobacion } from '@/lib/compras/pedidos-enforcement';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        name: true,
        companies: {
          select: { companyId: true },
          take: 1
        }
      }
    });

    return user;
  } catch {
    return null;
  }
}

// Generar número de pedido: REQ-2026-00001
async function generateRequestNumber(companyId: number, tx?: any): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `REQ-${year}-`;

  const client = tx || prisma;
  const lastRequest = await client.purchaseRequest.findFirst({
    where: {
      companyId,
      numero: { startsWith: prefix }
    },
    orderBy: { numero: 'desc' },
    select: { numero: true }
  });

  let nextNumber = 1;
  if (lastRequest?.numero) {
    const parts = lastRequest.numero.split('-');
    const lastNum = parseInt(parts[2] || '0', 10);
    nextNumber = lastNum + 1;
  }

  return `${prefix}${String(nextNumber).padStart(5, '0')}`;
}

// Helper para crear comentario de sistema
async function createSystemComment(
  entidadId: number,
  contenido: string,
  companyId: number,
  userId: number
) {
  await prisma.purchaseComment.create({
    data: {
      entidad: 'request',
      entidadId,
      tipo: 'SISTEMA',
      contenido,
      companyId,
      userId
    }
  });
}

// GET - Listar pedidos de compra
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const estado = searchParams.get('estado');
    const prioridad = searchParams.get('prioridad');
    const solicitanteId = searchParams.get('solicitanteId');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Cursor-based pagination (opcional, más eficiente para grandes datasets)
    const cursor = searchParams.get('cursor'); // ID del último elemento
    const useCursor = searchParams.get('useCursor') === 'true';

    // Modo ligero: excluye items y cotizaciones para listas rápidas
    const lightMode = searchParams.get('light') === 'true';

    // Quick filters
    const quickFilter = searchParams.get('quickFilter'); // misPedidos, venceEstaSemana, pendientesAccion

    // Construir where
    const where: Prisma.PurchaseRequestWhereInput = {
      companyId,
      ...(estado && { estado: estado as PurchaseRequestStatus }),
      ...(prioridad && { prioridad: prioridad as RequestPriority }),
      ...(solicitanteId && { solicitanteId: parseInt(solicitanteId) }),
      ...(search && {
        OR: [
          { numero: { contains: search, mode: 'insensitive' } },
          { titulo: { contains: search, mode: 'insensitive' } },
          { descripcion: { contains: search, mode: 'insensitive' } }
        ]
      }),
      // Quick filters
      ...(quickFilter === 'misPedidos' && { solicitanteId: user.id }),
      ...(quickFilter === 'venceEstaSemana' && {
        fechaNecesidad: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días
        },
        estado: { notIn: ['COMPLETADA', 'RECHAZADA', 'CANCELADA'] as PurchaseRequestStatus[] }
      }),
      ...(quickFilter === 'pendientesAccion' && {
        estado: { in: ['ENVIADA', 'EN_COTIZACION', 'EN_APROBACION'] as PurchaseRequestStatus[] }
      }),
      ...(quickFilter === 'urgentes' && {
        prioridad: { in: ['URGENTE', 'ALTA'] as RequestPriority[] },
        estado: { notIn: ['COMPLETADA', 'RECHAZADA', 'CANCELADA'] as PurchaseRequestStatus[] }
      })
    };

    // KPIs con cache (30 segundos) - se obtienen en paralelo pero cacheados
    const kpisPromise = cache.getOrSet(
      CacheKeys.purchaseRequestKPIs(companyId),
      async () => {
        const kpis = await prisma.purchaseRequest.groupBy({
          by: ['estado'],
          where: { companyId },
          _count: { id: true }
        });

        const formatted = {
          borradores: 0,
          enviadas: 0,
          enCotizacion: 0,
          cotizadas: 0,
          enAprobacion: 0,
          aprobadas: 0,
          enProceso: 0,
          completadas: 0,
          rechazadas: 0,
          canceladas: 0
        };

        kpis.forEach(k => {
          switch (k.estado) {
            case 'BORRADOR': formatted.borradores = k._count.id; break;
            case 'ENVIADA': formatted.enviadas = k._count.id; break;
            case 'EN_COTIZACION': formatted.enCotizacion = k._count.id; break;
            case 'COTIZADA': formatted.cotizadas = k._count.id; break;
            case 'EN_APROBACION': formatted.enAprobacion = k._count.id; break;
            case 'APROBADA': formatted.aprobadas = k._count.id; break;
            case 'EN_PROCESO': formatted.enProceso = k._count.id; break;
            case 'COMPLETADA': formatted.completadas = k._count.id; break;
            case 'RECHAZADA': formatted.rechazadas = k._count.id; break;
            case 'CANCELADA': formatted.canceladas = k._count.id; break;
          }
        });

        return formatted;
      },
      CacheTTL.KPIs
    );

    // Configurar paginación
    const paginationConfig = useCursor && cursor
      ? {
          cursor: { id: parseInt(cursor) },
          skip: 1, // Saltar el cursor
          take: limit
        }
      : {
          skip: (page - 1) * limit,
          take: limit
        };

    // Configurar select basado en lightMode
    const selectConfig = {
      id: true,
      numero: true,
      titulo: true,
      descripcion: !lightMode, // Excluir en modo ligero
      estado: true,
      prioridad: true,
      departamento: true,
      fechaNecesidad: true,
      fechaLimite: true,
      presupuestoEstimado: !lightMode,
      moneda: true,
      createdAt: true,
      solicitante: {
        select: { id: true, name: true }
      },
      // En modo ligero solo contamos, no traemos datos
      ...(lightMode
        ? {
            _count: {
              select: { items: true, quotations: true }
            }
          }
        : {
            items: {
              select: { id: true, descripcion: true, cantidad: true, unidad: true }
            },
            quotations: {
              select: {
                id: true,
                numero: true,
                estado: true,
                total: true,
                esSeleccionada: true,
                supplier: {
                  select: { id: true, name: true }
                }
              }
            },
            purchaseOrders: {
              select: { id: true, numero: true, estado: true }
            },
            _count: {
              select: { quotations: true }
            }
          }
      )
    };

    const [pedidos, total, kpisFormatted] = await Promise.all([
      prisma.purchaseRequest.findMany({
        where,
        select: selectConfig,
        orderBy: sortBy === 'prioridad'
          ? [{ prioridad: sortOrder as 'asc' | 'desc' }, { createdAt: 'desc' }]
          : { [sortBy]: sortOrder as 'asc' | 'desc' },
        ...paginationConfig
      }),
      // Solo contar si no usamos cursor (para offset pagination)
      useCursor ? Promise.resolve(0) : prisma.purchaseRequest.count({ where }),
      kpisPromise
    ]);

    // Calcular nextCursor para paginación cursor-based
    const nextCursor = pedidos.length === limit ? pedidos[pedidos.length - 1]?.id : null;

    return NextResponse.json({
      data: pedidos,
      kpis: kpisFormatted,
      pagination: useCursor
        ? {
            limit,
            nextCursor,
            hasMore: pedidos.length === limit
          }
        : {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
    });
  } catch (error) {
    console.error('Error fetching pedidos de compra:', error);
    return NextResponse.json(
      { error: 'Error al obtener los pedidos de compra' },
      { status: 500 }
    );
  }
}

// POST - Crear pedido de compra
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const body = await request.json();
    const {
      titulo,
      descripcion,
      prioridad = 'NORMAL',
      departamento,
      fechaNecesidad,
      fechaLimite,
      presupuestoEstimado,
      moneda = 'ARS',
      notas,
      items = []
    } = body;

    // Validaciones
    if (!titulo) {
      return NextResponse.json({ error: 'El título es requerido' }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Debe incluir al menos un item' }, { status: 400 });
    }

    // ENFORCEMENT: Evaluar si requiere aprobación
    const evaluacion = await evaluarRequiereAprobacion(
      {
        total: presupuestoEstimado ? parseFloat(presupuestoEstimado) : 0,
        presupuestoEstimado: presupuestoEstimado ? parseFloat(presupuestoEstimado) : null,
        prioridad: prioridad || 'NORMAL',
        items: items.map((item: any) => ({
          supplierItemId: item.supplierItemId ? parseInt(item.supplierItemId) : null,
          descripcion: item.descripcion,
        })),
      },
      companyId,
      prisma
    );

    console.log('[PEDIDOS] Evaluación de aprobación:', evaluacion);

    // Crear en transacción
    const pedido = await prisma.$transaction(async (tx) => {
      const numero = await generateRequestNumber(companyId, tx);

      const newPedido = await tx.purchaseRequest.create({
        data: {
          numero,
          titulo,
          descripcion,
          estado: evaluacion.estadoInicial as PurchaseRequestStatus,
          prioridad: prioridad as RequestPriority,
          solicitanteId: user.id,
          departamento,
          fechaNecesidad: fechaNecesidad ? new Date(fechaNecesidad) : null,
          fechaLimite: fechaLimite ? new Date(fechaLimite) : null,
          presupuestoEstimado: presupuestoEstimado ? parseFloat(presupuestoEstimado) : null,
          moneda,
          notas,
          companyId,
          items: {
            create: items.map((item: any) => ({
              descripcion: item.descripcion,
              cantidad: parseFloat(item.cantidad),
              unidad: item.unidad || 'UN',
              supplierItemId: item.supplierItemId ? parseInt(item.supplierItemId) : null,
              especificaciones: item.especificaciones,
              toolId: item.toolId ? parseInt(item.toolId) : null,
              componentId: item.componentId ? parseInt(item.componentId) : null,
              machineId: item.machineId ? parseInt(item.machineId) : null,
            }))
          }
        },
        include: {
          solicitante: { select: { id: true, name: true } },
          items: true
        }
      });

      // Crear comentario de sistema
      const comentarioContenido = evaluacion.requiereAprobacion
        ? `Pedido de compra ${numero} creado. Requiere aprobación: ${evaluacion.motivos.join(', ')}`
        : `Pedido de compra ${numero} creado y enviado para cotización`;

      await tx.purchaseComment.create({
        data: {
          entidad: 'request',
          entidadId: newPedido.id,
          tipo: 'SISTEMA',
          contenido: comentarioContenido,
          companyId,
          userId: user.id
        }
      });

      return newPedido;
    });

    // Invalidar cache de KPIs al crear pedido
    cache.invalidate(CacheKeys.purchaseRequestKPIs(companyId));

    return NextResponse.json(pedido, { status: 201 });
  } catch (error: any) {
    console.error('Error creating pedido de compra:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear el pedido de compra' },
      { status: 500 }
    );
  }
}
