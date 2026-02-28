import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';

export async function GET(request: Request) {
  try {
    // Permission check: almacen.view_costs
    const { user, error: authError } = await requirePermission('almacen.view_costs');
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 });
    }

    const companyIdNum = parseInt(companyId);
    const dateFrom = fechaDesde ? new Date(fechaDesde) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = fechaHasta ? new Date(fechaHasta + 'T23:59:59') : new Date();

    // Get all despachos with items in the date range
    const despachos = await prisma.despacho.findMany({
      where: {
        companyId: companyIdNum,
        estado: 'RECIBIDO',
        fechaRecepcion: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      include: {
        items: {
          include: {
            supplierItem: {
              select: {
                id: true,
                nombre: true,
                codigoProveedor: true,
                unidad: true,
              },
            },
          },
        },
        workOrder: {
          select: {
            id: true,
            title: true,
            orderNumber: true,
            sectorId: true,
            sector: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        materialRequest: {
          select: {
            solicitante: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Aggregate by sector
    const sectorMap = new Map<number, {
      id: number;
      nombre: string;
      totalDespachos: number;
      totalItems: number;
      costoTotal: number;
    }>();

    // Aggregate by work order
    const workOrderMap = new Map<number, {
      id: number;
      nombre: string;
      totalDespachos: number;
      totalItems: number;
      costoTotal: number;
    }>();

    // Aggregate by item
    const itemMap = new Map<number, {
      supplierItemId: number;
      supplierItemName: string;
      supplierItemCode: string;
      unidad: string;
      totalCantidad: number;
      costoTotal: number;
      despachos: Set<number>;
    }>();

    let totalDespachos = 0;
    let totalItems = 0;
    let costoTotal = 0;

    for (const despacho of despachos) {
      totalDespachos++;

      // Get sector from work order
      const sector = despacho.workOrder?.sector;
      if (sector) {
        const existing = sectorMap.get(sector.id);
        if (existing) {
          existing.totalDespachos++;
        } else {
          sectorMap.set(sector.id, {
            id: sector.id,
            nombre: sector.name,
            totalDespachos: 1,
            totalItems: 0,
            costoTotal: 0,
          });
        }
      }

      // Aggregate work order
      if (despacho.workOrder) {
        const existing = workOrderMap.get(despacho.workOrder.id);
        if (existing) {
          existing.totalDespachos++;
        } else {
          workOrderMap.set(despacho.workOrder.id, {
            id: despacho.workOrder.id,
            nombre: `${despacho.workOrder.orderNumber || despacho.workOrder.id} - ${despacho.workOrder.title || 'Sin título'}`,
            totalDespachos: 1,
            totalItems: 0,
            costoTotal: 0,
          });
        }
      }

      // Process items
      for (const item of despacho.items) {
        if (!item.supplierItem) continue;

        const qty = Number(item.cantidadDespachada) || 0;
        const cost = Number(item.costoTotal) || 0;

        totalItems++;
        costoTotal += cost;

        // Update sector totals
        if (sector) {
          const sectorData = sectorMap.get(sector.id);
          if (sectorData) {
            sectorData.totalItems++;
            sectorData.costoTotal += cost;
          }
        }

        // Update work order totals
        if (despacho.workOrder) {
          const woData = workOrderMap.get(despacho.workOrder.id);
          if (woData) {
            woData.totalItems++;
            woData.costoTotal += cost;
          }
        }

        // Aggregate item
        const existingItem = itemMap.get(item.supplierItem.id);
        if (existingItem) {
          existingItem.totalCantidad += qty;
          existingItem.costoTotal += cost;
          existingItem.despachos.add(despacho.id);
        } else {
          itemMap.set(item.supplierItem.id, {
            supplierItemId: item.supplierItem.id,
            supplierItemName: item.supplierItem.nombre,
            supplierItemCode: item.supplierItem.codigoProveedor || '',
            unidad: item.supplierItem.unidad || 'UN',
            totalCantidad: qty,
            costoTotal: cost,
            despachos: new Set([despacho.id]),
          });
        }
      }
    }

    // Convert to arrays and sort
    const bySector = Array.from(sectorMap.values()).sort((a, b) => b.costoTotal - a.costoTotal);
    const byWorkOrder = Array.from(workOrderMap.values())
      .sort((a, b) => b.costoTotal - a.costoTotal)
      .slice(0, 50); // Top 50 OTs

    const topItems = Array.from(itemMap.values())
      .map((item) => ({
        ...item,
        despachos: item.despachos.size,
      }))
      .sort((a, b) => b.costoTotal - a.costoTotal)
      .slice(0, 30); // Top 30 items

    return NextResponse.json({
      bySector,
      byWorkOrder,
      topItems,
      totals: {
        totalDespachos,
        totalItems,
        costoTotal,
      },
    });
  } catch (error) {
    console.error('Error generating consumption report:', error);
    return NextResponse.json(
      { error: 'Error al generar reporte de consumo' },
      { status: 500 }
    );
  }
}
