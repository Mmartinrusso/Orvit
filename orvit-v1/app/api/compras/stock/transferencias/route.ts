import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { logCreation } from '@/lib/compras/audit-helper';
import { getViewMode } from '@/lib/view-mode/get-mode';
import { MODE } from '@/lib/view-mode/types';
import { requirePermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const token = cookies().get('token')?.value;
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
  } catch (error) {
    return null;
  }
}

// Generar número de transferencia
async function generarNumeroTransferencia(companyId: number): Promise<string> {
  const año = new Date().getFullYear();
  const prefix = `TRF-${año}-`;

  const ultimaTransferencia = await prisma.stockTransfer.findFirst({
    where: {
      companyId,
      numero: { startsWith: prefix }
    },
    orderBy: { numero: 'desc' },
    select: { numero: true }
  });

  if (ultimaTransferencia) {
    const ultimoNumero = parseInt(ultimaTransferencia.numero.replace(prefix, '')) || 0;
    return `${prefix}${String(ultimoNumero + 1).padStart(5, '0')}`;
  }

  return `${prefix}00001`;
}

// GET - Listar transferencias
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
    const limit = parseInt(searchParams.get('limit') || '20');
    const estado = searchParams.get('estado');
    const warehouseOrigenId = searchParams.get('warehouseOrigenId');
    const warehouseDestinoId = searchParams.get('warehouseDestinoId');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');

    // ViewMode: Standard oculta transferencias que involucran items T2
    const viewMode = getViewMode(request);

    // Obtener IDs de items T2 si estamos en Standard mode
    let t2ItemIds: number[] = [];
    if (viewMode === MODE.STANDARD) {
      const t2Items = await prisma.stockMovement.findMany({
        where: {
          companyId,
          docType: 'T2',
          tipo: 'ENTRADA_RECEPCION'
        },
        select: { supplierItemId: true },
        distinct: ['supplierItemId']
      });
      t2ItemIds = t2Items.map(i => i.supplierItemId);
    }

    const where: Prisma.StockTransferWhereInput = {
      companyId,
      ...(estado && { estado: estado as any }),
      ...(warehouseOrigenId && { warehouseOrigenId: parseInt(warehouseOrigenId) }),
      ...(warehouseDestinoId && { warehouseDestinoId: parseInt(warehouseDestinoId) }),
      ...(fechaDesde && {
        createdAt: { gte: new Date(fechaDesde) }
      }),
      ...(fechaHasta && {
        createdAt: { lte: new Date(fechaHasta) }
      }),
      // ViewMode: Excluir transferencias que tienen items T2
      ...(t2ItemIds.length > 0 && {
        items: {
          none: {
            supplierItemId: { in: t2ItemIds }
          }
        }
      }),
    };

    const [transferencias, total] = await Promise.all([
      prisma.stockTransfer.findMany({
        where,
        include: {
          warehouseOrigen: {
            select: { id: true, codigo: true, nombre: true }
          },
          warehouseDestino: {
            select: { id: true, codigo: true, nombre: true }
          },
          createdByUser: {
            select: { id: true, name: true }
          },
          _count: {
            select: { items: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.stockTransfer.count({ where })
    ]);

    return NextResponse.json({
      data: transferencias,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching transferencias:', error);
    return NextResponse.json(
      { error: 'Error al obtener las transferencias' },
      { status: 500 }
    );
  }
}

// POST - Crear transferencia
export async function POST(request: NextRequest) {
  try {
    // Permission check: almacen.transfer
    const { error: permError } = await requirePermission('almacen.transfer');
    if (permError) return permError;

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
      warehouseOrigenId,
      warehouseDestinoId,
      motivo,
      notas,
      items, // [{ supplierItemId, cantidad, notas }]
    } = body;

    // Validaciones
    if (!warehouseOrigenId || !warehouseDestinoId) {
      return NextResponse.json({ error: 'Debe seleccionar depósito origen y destino' }, { status: 400 });
    }

    if (warehouseOrigenId === warehouseDestinoId) {
      return NextResponse.json({ error: 'El depósito origen y destino no pueden ser el mismo' }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Debe agregar al menos un item' }, { status: 400 });
    }

    // Verificar warehouses (no pueden ser de tránsito)
    const [warehouseOrigen, warehouseDestino] = await Promise.all([
      prisma.warehouse.findFirst({
        where: { id: parseInt(warehouseOrigenId), companyId, isActive: true, isTransit: false }
      }),
      prisma.warehouse.findFirst({
        where: { id: parseInt(warehouseDestinoId), companyId, isActive: true, isTransit: false }
      })
    ]);

    if (!warehouseOrigen) {
      return NextResponse.json({ error: 'Depósito origen no encontrado o inválido' }, { status: 400 });
    }

    if (!warehouseDestino) {
      return NextResponse.json({ error: 'Depósito destino no encontrado o inválido' }, { status: 400 });
    }

    // Obtener stock disponible en origen para validar
    const supplierItemIds = items.map((i: any) => parseInt(i.supplierItemId));
    const stockOrigen = await prisma.stockLocation.findMany({
      where: {
        warehouseId: parseInt(warehouseOrigenId),
        supplierItemId: { in: supplierItemIds }
      }
    });

    const stockByItem = new Map<number, { cantidad: number; reservado: number }>();
    for (const loc of stockOrigen) {
      stockByItem.set(loc.supplierItemId, {
        cantidad: Number(loc.cantidad || 0),
        reservado: Number(loc.cantidadReservada || 0)
      });
    }

    // Validar cantidades
    for (const item of items) {
      const cantidad = parseFloat(item.cantidad || '0');
      if (cantidad <= 0) {
        return NextResponse.json({ error: 'Las cantidades deben ser mayores a 0' }, { status: 400 });
      }

      const stock = stockByItem.get(parseInt(item.supplierItemId));
      const disponible = (stock?.cantidad || 0) - (stock?.reservado || 0);

      if (cantidad > disponible) {
        return NextResponse.json({
          error: `Stock insuficiente para item ${item.supplierItemId}. Disponible: ${disponible}, Solicitado: ${cantidad}`
        }, { status: 400 });
      }
    }

    // Generar número
    const numero = await generarNumeroTransferencia(companyId);

    // Crear transferencia con items
    const nuevaTransferencia = await prisma.$transaction(async (tx) => {
      const transferencia = await tx.stockTransfer.create({
        data: {
          numero,
          warehouseOrigenId: parseInt(warehouseOrigenId),
          warehouseDestinoId: parseInt(warehouseDestinoId),
          estado: 'BORRADOR',
          motivo: motivo || null,
          notas: notas || null,
          companyId,
          createdBy: user.id
        }
      });

      // Crear items
      await tx.stockTransferItem.createMany({
        data: items.map((item: any) => ({
          transferId: transferencia.id,
          supplierItemId: parseInt(item.supplierItemId),
          cantidadSolicitada: parseFloat(item.cantidad),
          cantidadEnviada: 0,
          cantidadRecibida: 0,
          notas: item.notas || null
        }))
      });

      return transferencia;
    });

    // Obtener transferencia completa
    const transferenciaCompleta = await prisma.stockTransfer.findUnique({
      where: { id: nuevaTransferencia.id },
      include: {
        warehouseOrigen: { select: { id: true, codigo: true, nombre: true } },
        warehouseDestino: { select: { id: true, codigo: true, nombre: true } },
        items: {
          include: {
            supplierItem: {
              select: {
                id: true,
                nombre: true,
                unidad: true,
                codigoProveedor: true
              }
            }
          }
        }
      }
    });

    // Registrar auditoría
    await logCreation({
      entidad: 'stock_transfer',
      entidadId: nuevaTransferencia.id,
      companyId,
      userId: user.id,
      estadoInicial: 'BORRADOR',
    });

    return NextResponse.json(transferenciaCompleta, { status: 201 });
  } catch (error) {
    console.error('Error creating transferencia:', error);
    return NextResponse.json(
      { error: 'Error al crear la transferencia' },
      { status: 500 }
    );
  }
}
