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
  } catch (error) {
    return null;
  }
}

// Generar número de ajuste
async function generarNumeroAjuste(companyId: number): Promise<string> {
  const año = new Date().getFullYear();
  const prefix = `AJU-${año}-`;

  const ultimoAjuste = await prisma.stockAdjustment.findFirst({
    where: {
      companyId,
      numero: { startsWith: prefix }
    },
    orderBy: { numero: 'desc' },
    select: { numero: true }
  });

  if (ultimoAjuste) {
    const ultimoNumero = parseInt(ultimoAjuste.numero.replace(prefix, '')) || 0;
    return `${prefix}${String(ultimoNumero + 1).padStart(5, '0')}`;
  }

  return `${prefix}00001`;
}

// Reason codes por tipo de ajuste
const REASON_CODES: Record<string, string[]> = {
  INVENTARIO_FISICO: ['Conteo físico', 'Reconciliación', 'Auditoría'],
  ROTURA: ['Caída', 'Transporte', 'Manipulación', 'Otro'],
  VENCIMIENTO: ['Fecha pasada', 'Deterioro visible', 'Control de calidad'],
  MERMA: ['Evaporación', 'Pesaje', 'Proceso productivo', 'Otro'],
  CORRECCION: ['Error de carga', 'Error de sistema', 'Ajuste contable'],
  DEVOLUCION_INTERNA: ['Reingreso producción', 'Producto no usado', 'Otro'],
};

// Reglas de aprobación
const REQUIERE_APROBACION = {
  porTipo: ['INVENTARIO_FISICO'],
  porMontoTotal: 50000,
  porCantidadTotal: 100,
};

// GET - Listar ajustes
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
    const tipo = searchParams.get('tipo');
    const estado = searchParams.get('estado');
    const warehouseId = searchParams.get('warehouseId');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');

    // ViewMode: Standard oculta ajustes que involucran items T2
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

    const where: Prisma.StockAdjustmentWhereInput = {
      companyId,
      ...(tipo && { tipo: tipo as any }),
      ...(estado && { estado: estado as any }),
      ...(warehouseId && { warehouseId: parseInt(warehouseId) }),
      ...(fechaDesde && {
        createdAt: { gte: new Date(fechaDesde) }
      }),
      ...(fechaHasta && {
        createdAt: { lte: new Date(fechaHasta) }
      }),
      // ViewMode: Excluir ajustes que tienen items T2
      ...(t2ItemIds.length > 0 && {
        items: {
          none: {
            supplierItemId: { in: t2ItemIds }
          }
        }
      }),
    };

    const [ajustes, total] = await Promise.all([
      prisma.stockAdjustment.findMany({
        where,
        include: {
          warehouse: {
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
      prisma.stockAdjustment.count({ where })
    ]);

    return NextResponse.json({
      data: ajustes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      reasonCodes: REASON_CODES
    });
  } catch (error) {
    console.error('Error fetching ajustes:', error);
    return NextResponse.json(
      { error: 'Error al obtener los ajustes' },
      { status: 500 }
    );
  }
}

// POST - Crear ajuste
export async function POST(request: NextRequest) {
  try {
    // Permission check: almacen.adjust
    const { error: permError } = await requirePermission('almacen.adjust');
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
      tipo,
      warehouseId,
      motivo,
      motivoDetalle,
      reasonCode,
      notas,
      adjuntos,
      items, // [{ supplierItemId, cantidadActual, cantidadNueva, notas }]
    } = body;

    // Validaciones
    if (!tipo) {
      return NextResponse.json({ error: 'El tipo de ajuste es requerido' }, { status: 400 });
    }

    const tiposValidos = ['INVENTARIO_FISICO', 'ROTURA', 'VENCIMIENTO', 'MERMA', 'CORRECCION', 'DEVOLUCION_INTERNA'];
    if (!tiposValidos.includes(tipo)) {
      return NextResponse.json({ error: 'Tipo de ajuste inválido' }, { status: 400 });
    }

    if (!warehouseId) {
      return NextResponse.json({ error: 'El depósito es requerido' }, { status: 400 });
    }

    if (!motivo || motivo.length < 10) {
      return NextResponse.json({ error: 'El motivo debe tener al menos 10 caracteres' }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Debe agregar al menos un item' }, { status: 400 });
    }

    // Verificar warehouse
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: parseInt(warehouseId), companyId, isActive: true }
    });

    if (!warehouse) {
      return NextResponse.json({ error: 'Depósito no encontrado o inactivo' }, { status: 400 });
    }

    // Calcular totales para determinar si requiere aprobación
    let cantidadTotalPositiva = 0;
    let cantidadTotalNegativa = 0;
    let valorTotalPositivo = 0;
    let valorTotalNegativo = 0;

    // Obtener costos de los items para calcular valores
    const supplierItemIds = items.map((i: any) => parseInt(i.supplierItemId));
    const stockLocations = await prisma.stockLocation.findMany({
      where: {
        warehouseId: parseInt(warehouseId),
        supplierItemId: { in: supplierItemIds }
      },
      select: {
        supplierItemId: true,
        cantidad: true,
        costoUnitario: true
      }
    });

    const costoByItem = new Map<number, number>();
    const stockByItem = new Map<number, number>();
    for (const loc of stockLocations) {
      costoByItem.set(loc.supplierItemId, Number(loc.costoUnitario || 0));
      stockByItem.set(loc.supplierItemId, Number(loc.cantidad || 0));
    }

    // Validar items y calcular diferencias
    const itemsValidados = [];
    for (const item of items) {
      if (!item.supplierItemId) {
        return NextResponse.json({ error: 'Cada item debe tener supplierItemId' }, { status: 400 });
      }

      const cantidadNueva = parseFloat(item.cantidadNueva || '0');
      const stockActual = stockByItem.get(parseInt(item.supplierItemId)) || 0;
      const diferencia = cantidadNueva - stockActual;
      const costo = costoByItem.get(parseInt(item.supplierItemId)) || 0;

      // Validar que no quede negativo (excepto para ciertos tipos)
      if (cantidadNueva < 0) {
        return NextResponse.json({ error: 'La cantidad nueva no puede ser negativa' }, { status: 400 });
      }

      if (diferencia > 0) {
        cantidadTotalPositiva += diferencia;
        valorTotalPositivo += diferencia * costo;
      } else {
        cantidadTotalNegativa += Math.abs(diferencia);
        valorTotalNegativo += Math.abs(diferencia) * costo;
      }

      itemsValidados.push({
        supplierItemId: parseInt(item.supplierItemId),
        cantidadAnterior: stockActual,
        cantidadNueva,
        diferencia,
        costo
      });
    }

    // Determinar si requiere aprobación
    const valorTotal = Math.max(valorTotalPositivo, valorTotalNegativo);
    const cantidadTotal = Math.max(cantidadTotalPositiva, cantidadTotalNegativa);

    let requiereAprobacion = false;
    if (REQUIERE_APROBACION.porTipo.includes(tipo)) {
      requiereAprobacion = true;
    } else if (valorTotal > REQUIERE_APROBACION.porMontoTotal) {
      requiereAprobacion = true;
    } else if (cantidadTotal > REQUIERE_APROBACION.porCantidadTotal) {
      requiereAprobacion = true;
    }

    // Generar número
    const numero = await generarNumeroAjuste(companyId);

    // Crear ajuste con items
    const nuevoAjuste = await prisma.$transaction(async (tx) => {
      const ajuste = await tx.stockAdjustment.create({
        data: {
          numero,
          tipo: tipo as any,
          warehouseId: parseInt(warehouseId),
          motivo,
          motivoDetalle: motivoDetalle || null,
          reasonCode: reasonCode || null,
          notas: notas || null,
          adjuntos: adjuntos || [],
          estado: requiereAprobacion ? 'PENDIENTE_APROBACION' : 'BORRADOR',
          companyId,
          createdBy: user.id
        }
      });

      // Crear items
      await tx.stockAdjustmentItem.createMany({
        data: itemsValidados.map(item => ({
          adjustmentId: ajuste.id,
          supplierItemId: item.supplierItemId,
          cantidadAnterior: item.cantidadAnterior,
          cantidadNueva: item.cantidadNueva,
          diferencia: item.diferencia
        }))
      });

      return ajuste;
    });

    // Obtener ajuste completo
    const ajusteCompleto = await prisma.stockAdjustment.findUnique({
      where: { id: nuevoAjuste.id },
      include: {
        warehouse: { select: { id: true, codigo: true, nombre: true } },
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
      entidad: 'stock_adjustment',
      entidadId: nuevoAjuste.id,
      companyId,
      userId: user.id,
      estadoInicial: requiereAprobacion ? 'PENDIENTE_APROBACION' : 'BORRADOR',
    });

    return NextResponse.json(ajusteCompleto, { status: 201 });
  } catch (error) {
    console.error('Error creating ajuste:', error);
    return NextResponse.json(
      { error: 'Error al crear el ajuste' },
      { status: 500 }
    );
  }
}
