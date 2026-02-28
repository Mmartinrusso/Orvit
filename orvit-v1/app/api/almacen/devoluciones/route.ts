import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import {
  DevolucionStatus,
  DevolucionType,
  InventoryItemType,
  StockMovementType,
} from '@prisma/client';
import { requirePermission } from '@/lib/auth/shared-helpers';

/**
 * GET /api/almacen/devoluciones
 *
 * Query params:
 * - companyId: number (required)
 * - estado: string (optional)
 * - tipo: string (optional)
 * - warehouseId: number (optional)
 * - page: number (optional)
 * - pageSize: number (optional)
 */
export async function GET(request: NextRequest) {
  try {
    // Permission check: almacen.return.view
    const { user, error: authError } = await requirePermission('almacen.return.view');
    if (authError) return authError;

    const { searchParams } = new URL(request.url);

    const companyId = Number(searchParams.get('companyId'));
    if (!companyId || isNaN(companyId)) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    // Build where clause
    const where: any = { companyId };

    const estado = searchParams.get('estado');
    if (estado) where.estado = estado as DevolucionStatus;

    const tipo = searchParams.get('tipo');
    if (tipo) where.tipo = tipo as DevolucionType;

    const warehouseId = searchParams.get('warehouseId');
    if (warehouseId) where.warehouseId = Number(warehouseId);

    const page = Number(searchParams.get('page')) || 1;
    const pageSize = Number(searchParams.get('pageSize')) || 20;

    const [devoluciones, total] = await Promise.all([
      prisma.devolucionMaterial.findMany({
        where,
        include: {
          items: {
            include: {
              supplierItem: {
                select: { id: true, nombre: true, codigoProveedor: true, unidad: true },
              },
              tool: {
                select: { id: true, name: true, code: true },
              },
            },
          },
          warehouse: {
            select: { id: true, nombre: true },
          },
          despachoOrigen: {
            select: { id: true, numero: true },
          },
          devolviente: {
            select: { id: true, name: true },
          },
          recibidoByUser: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.devolucionMaterial.count({ where }),
    ]);

    return NextResponse.json({
      devoluciones,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Error en GET /api/almacen/devoluciones:', error);
    return NextResponse.json(
      { error: 'Error al obtener devoluciones' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/almacen/devoluciones
 *
 * Create a new devolucion
 *
 * Body:
 * - tipo: DevolucionType
 * - warehouseId: number
 * - despachoOrigenId?: number
 * - devolvienteId: number
 * - motivo: string
 * - notas?: string
 * - companyId: number
 * - items: Array<{
 *     itemType: InventoryItemType
 *     supplierItemId?: number
 *     toolId?: number
 *     cantidad: number
 *     estadoItem?: string
 *   }>
 */
export async function POST(request: NextRequest) {
  try {
    // Permission check: almacen.return.create
    const { user, error } = await requirePermission('almacen.return.create');
    if (error) return error;

    const body = await request.json();
    const {
      tipo,
      warehouseId,
      despachoOrigenId,
      devolvienteId,
      motivo,
      notas,
      companyId,
      items,
    } = body;

    if (!tipo || !warehouseId || !devolvienteId || !motivo || !companyId || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'tipo, warehouseId, devolvienteId, motivo, companyId e items son requeridos' },
        { status: 400 }
      );
    }

    // Generate devolucion number
    const lastDevolucion = await prisma.devolucionMaterial.findFirst({
      where: { companyId: Number(companyId) },
      orderBy: { id: 'desc' },
      select: { numero: true },
    });

    const nextNumber = lastDevolucion
      ? String(Number(lastDevolucion.numero.replace(/\D/g, '')) + 1).padStart(6, '0')
      : '000001';
    const numero = `DV-${nextNumber}`;

    // Create devolucion with items
    const devolucion = await prisma.devolucionMaterial.create({
      data: {
        numero,
        tipo: tipo as DevolucionType,
        estado: DevolucionStatus.BORRADOR,
        warehouseId: Number(warehouseId),
        despachoOrigenId: despachoOrigenId ? Number(despachoOrigenId) : null,
        devolvienteId: Number(devolvienteId),
        motivo,
        notas,
        companyId: Number(companyId),
        items: {
          create: items.map((item: any) => ({
            itemType: item.itemType as InventoryItemType,
            supplierItemId: item.supplierItemId ? Number(item.supplierItemId) : null,
            toolId: item.toolId ? Number(item.toolId) : null,
            cantidad: item.cantidad,
            estadoItem: item.estadoItem,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json({ devolucion });
  } catch (error) {
    console.error('Error en POST /api/almacen/devoluciones:', error);
    return NextResponse.json(
      { error: 'Error al crear devolución' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/almacen/devoluciones
 *
 * Update devolucion status (submit, accept, reject)
 *
 * Body:
 * - id: number (required)
 * - action: 'submit' | 'accept' | 'reject'
 * - userId: number (required for accept/reject)
 * - motivoRechazo?: string (for reject)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, userId, motivoRechazo } = body;

    if (!id || !action) {
      return NextResponse.json(
        { error: 'id y action son requeridos' },
        { status: 400 }
      );
    }

    // Permission check per action
    const actionPermissionMap: Record<string, string> = {
      submit: 'almacen.return.create',
      accept: 'almacen.return.process',
      reject: 'almacen.return.process',
    };
    const requiredPerm = actionPermissionMap[action];
    if (requiredPerm) {
      const { user, error: authError } = await requirePermission(requiredPerm);
      if (authError) return authError;
    }

    const devolucion = await prisma.devolucionMaterial.findUnique({
      where: { id: Number(id) },
      include: {
        items: {
          include: {
            supplierItem: true,
          },
        },
      },
    });

    if (!devolucion) {
      return NextResponse.json(
        { error: 'Devolución no encontrada' },
        { status: 404 }
      );
    }

    switch (action) {
      case 'submit': {
        if (devolucion.estado !== DevolucionStatus.BORRADOR) {
          return NextResponse.json(
            { error: 'Solo se pueden enviar devoluciones en estado BORRADOR' },
            { status: 400 }
          );
        }

        const updated = await prisma.devolucionMaterial.update({
          where: { id: Number(id) },
          data: { estado: DevolucionStatus.PENDIENTE_REVISION },
        });

        return NextResponse.json({ devolucion: updated });
      }

      case 'accept': {
        if (devolucion.estado !== DevolucionStatus.PENDIENTE_REVISION) {
          return NextResponse.json(
            { error: 'Solo se pueden aceptar devoluciones PENDIENTE_REVISION' },
            { status: 400 }
          );
        }

        // Process acceptance in transaction
        await prisma.$transaction(async (tx) => {
          // Create stock movements and update stock for each item
          for (const item of devolucion.items) {
            if (item.itemType === 'SUPPLIER_ITEM' && item.supplierItemId) {
              // Get or create stock location
              let stockLocation = await tx.stockLocation.findUnique({
                where: {
                  warehouseId_supplierItemId: {
                    warehouseId: devolucion.warehouseId,
                    supplierItemId: item.supplierItemId,
                  },
                },
              });

              const currentQty = stockLocation ? Number(stockLocation.cantidad) : 0;
              const returnQty = Number(item.cantidad);
              const newQty = currentQty + returnQty;

              if (stockLocation) {
                // Update existing stock location
                await tx.stockLocation.update({
                  where: { id: stockLocation.id },
                  data: { cantidad: new Decimal(newQty) },
                });
              } else {
                // Create new stock location
                stockLocation = await tx.stockLocation.create({
                  data: {
                    warehouseId: devolucion.warehouseId,
                    supplierItemId: item.supplierItemId,
                    cantidad: new Decimal(newQty),
                    cantidadReservada: new Decimal(0),
                    companyId: devolucion.companyId,
                  },
                });
              }

              // Create stock movement
              const movement = await tx.stockMovement.create({
                data: {
                  tipo: StockMovementType.DEVOLUCION,
                  cantidad: new Decimal(returnQty),
                  cantidadAnterior: new Decimal(currentQty),
                  cantidadPosterior: new Decimal(newQty),
                  costoUnitario: stockLocation.costoUnitario,
                  supplierItemId: item.supplierItemId,
                  warehouseId: devolucion.warehouseId,
                  devolucionId: devolucion.id,
                  companyId: devolucion.companyId,
                  userId: userId ? Number(userId) : devolucion.devolvienteId,
                  motivo: devolucion.motivo,
                },
              });

              // Update devolucion item with movement reference
              await tx.devolucionMaterialItem.update({
                where: { id: item.id },
                data: { stockMovementId: movement.id },
              });
            }
          }

          // Update devolucion status
          await tx.devolucionMaterial.update({
            where: { id: Number(id) },
            data: {
              estado: DevolucionStatus.ACEPTADA,
              fechaDevolucion: new Date(),
              recibidoPor: userId ? Number(userId) : null,
            },
          });
        });

        const updated = await prisma.devolucionMaterial.findUnique({
          where: { id: Number(id) },
          include: { items: true },
        });

        return NextResponse.json({ devolucion: updated });
      }

      case 'reject': {
        if (devolucion.estado !== DevolucionStatus.PENDIENTE_REVISION) {
          return NextResponse.json(
            { error: 'Solo se pueden rechazar devoluciones PENDIENTE_REVISION' },
            { status: 400 }
          );
        }

        const updated = await prisma.devolucionMaterial.update({
          where: { id: Number(id) },
          data: {
            estado: DevolucionStatus.RECHAZADA,
            notas: motivoRechazo
              ? `${devolucion.notas || ''}\n[RECHAZADA] ${motivoRechazo}`
              : devolucion.notas,
          },
        });

        return NextResponse.json({ devolucion: updated });
      }

      default:
        return NextResponse.json(
          { error: 'Acción no válida' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error en PATCH /api/almacen/devoluciones:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al actualizar devolución' },
      { status: 500 }
    );
  }
}
