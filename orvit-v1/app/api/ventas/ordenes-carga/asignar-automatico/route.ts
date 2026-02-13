/**
 * POST /api/ventas/ordenes-carga/asignar-automatico
 *
 * Auto-assigns vehicles and drivers to pending load orders based on:
 * - Vehicle capacity (weight/volume)
 * - Vehicle dimensions (3D bin packing)
 * - Optimal vehicle suggestion
 *
 * Uses the 3D bin packing algorithm to:
 * 1. Calculate optimal item positions
 * 2. Suggest the best vehicle type
 * 3. Update item positions for loading sequence
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import {
  packItems3D,
  suggestVehicle,
  VEHICLE_DIMENSIONS,
  ItemDimensions,
} from '@/lib/ventas/bin-packing-3d';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

interface AutoAssignRequest {
  loadOrderIds: number[];
  vehiculoTipo?: string; // Force specific vehicle type
  optimizePositions?: boolean; // Recalculate item positions
}

interface AssignmentResult {
  loadOrderId: number;
  vehiculoTipo: string;
  vehiculo?: string;
  pesoTotal: number;
  volumenTotal: number;
  utilizacion: {
    peso: number;
    volumen: number;
    espacioLineal: number;
  };
  itemsPositioned: number;
  warnings: string[];
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_EDIT);
    if (error) return error;

    const companyId = user!.companyId;
    const body: AutoAssignRequest = await request.json();

    if (!body.loadOrderIds || body.loadOrderIds.length === 0) {
      return NextResponse.json(
        { error: 'loadOrderIds es requerido' },
        { status: 400 }
      );
    }

    // Get pending load orders with items
    const loadOrders = await prisma.loadOrder.findMany({
      where: {
        id: { in: body.loadOrderIds },
        companyId,
        estado: 'PENDIENTE',
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                weight: true,
                volume: true,
              },
            },
          },
        },
        sale: {
          select: {
            id: true,
            numero: true,
            client: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (loadOrders.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron órdenes de carga pendientes' },
        { status: 404 }
      );
    }

    const results = {
      assigned: [] as AssignmentResult[],
      failed: [] as Array<{ loadOrderId: number; reason: string }>,
      summary: {
        totalProcessed: loadOrders.length,
        totalAssigned: 0,
        totalFailed: 0,
        totalWeight: 0,
        totalVolume: 0,
      },
    };

    for (const loadOrder of loadOrders) {
      try {
        // Convert items to bin packing format
        const packingItems: ItemDimensions[] = loadOrder.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          cantidad: item.cantidad,
          pesoUnitario: item.pesoUnitario || item.product?.weight || null,
          volumenUnitario: item.volumenUnitario || item.product?.volume || null,
          largoUnitario: item.largoUnitario,
          anchoUnitario: item.anchoUnitario,
          altoUnitario: item.altoUnitario,
        }));

        // Suggest vehicle or use specified type
        let vehiculoTipo = body.vehiculoTipo;
        let packingResult;

        if (!vehiculoTipo) {
          const suggestion = suggestVehicle(packingItems);
          vehiculoTipo = suggestion.recommended;
          packingResult = suggestion.details[vehiculoTipo];
        } else {
          const vehicle =
            VEHICLE_DIMENSIONS[vehiculoTipo] || VEHICLE_DIMENSIONS.CAMION_MEDIANO;
          packingResult = packItems3D(packingItems, vehicle);
        }

        if (!packingResult.success && packingResult.unpacked.length > 0) {
          // Try larger vehicle
          const vehicleTypes = Object.keys(VEHICLE_DIMENSIONS);
          const currentIndex = vehicleTypes.indexOf(vehiculoTipo);

          for (let i = currentIndex + 1; i < vehicleTypes.length; i++) {
            const largerType = vehicleTypes[i];
            const largerResult = packItems3D(
              packingItems,
              VEHICLE_DIMENSIONS[largerType]
            );

            if (largerResult.success) {
              vehiculoTipo = largerType;
              packingResult = largerResult;
              break;
            }
          }
        }

        // Generate vehicle identification
        const vehiculoPatente = `AUTO-${Math.random()
          .toString(36)
          .substr(2, 6)
          .toUpperCase()}`;

        // Update load order and items in transaction
        await prisma.$transaction(async (tx) => {
          // Update load order
          await tx.loadOrder.update({
            where: { id: loadOrder.id },
            data: {
              vehiculoTipo,
              vehiculo: VEHICLE_DIMENSIONS[vehiculoTipo]?.tipo || vehiculoTipo,
              vehiculoPatente,
              pesoTotal: new Prisma.Decimal(packingResult.pesoTotal),
              volumenTotal: new Prisma.Decimal(packingResult.volumenTotal),
            },
          });

          // Update item positions if optimize is enabled
          if (body.optimizePositions !== false) {
            for (const packed of packingResult.packedItems) {
              await tx.loadOrderItem.update({
                where: { id: packed.itemId },
                data: {
                  secuencia: packed.secuencia,
                  posX: new Prisma.Decimal(packed.posX),
                  posY: new Prisma.Decimal(packed.posY),
                  posZ: new Prisma.Decimal(packed.posZ),
                },
              });
            }
          }
        });

        results.assigned.push({
          loadOrderId: loadOrder.id,
          vehiculoTipo,
          vehiculo: vehiculoPatente,
          pesoTotal: packingResult.pesoTotal,
          volumenTotal: packingResult.volumenTotal,
          utilizacion: packingResult.utilizacion,
          itemsPositioned: packingResult.packedItems.length,
          warnings: packingResult.warnings,
        });

        results.summary.totalWeight += packingResult.pesoTotal;
        results.summary.totalVolume += packingResult.volumenTotal;
        results.summary.totalAssigned++;
      } catch (err) {
        results.failed.push({
          loadOrderId: loadOrder.id,
          reason: err instanceof Error ? err.message : 'Error desconocido',
        });
        results.summary.totalFailed++;
      }
    }

    return NextResponse.json({
      message: `Asignados ${results.summary.totalAssigned} de ${results.summary.totalProcessed} órdenes`,
      results,
    });
  } catch (error) {
    console.error('[AUTO-ASSIGN] Error:', error);
    return NextResponse.json(
      { error: 'Error en asignación automática' },
      { status: 500 }
    );
  }
}
