/**
 * LoadOrders (Ordenes de Carga) API - O2C Phase 2
 *
 * Handles listing, creation, and management of load orders.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { applyViewMode, getViewMode, isExtendedMode, DOC_TYPE, ViewMode } from '@/lib/view-mode';
import { Prisma } from '@prisma/client';
import { packItems3D, suggestVehicle, VEHICLE_DIMENSIONS, ItemDimensions } from '@/lib/ventas/bin-packing-3d';
import { generateSequentialNumber } from '@/lib/ventas/sequence-generator';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════════════════════
// GET - List load orders
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_VIEW);
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const companyId = user!.companyId;
    const estado = searchParams.get('estado');
    const saleId = searchParams.get('saleId');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
    const search = searchParams.get('search');
    const clienteId = searchParams.get('clienteId');
    const transportista = searchParams.get('transportista');
    const chofer = searchParams.get('chofer');
    const viewMode = (searchParams.get('viewMode') || 'S') as ViewMode;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where = applyViewMode(
      {
        companyId,
        ...(estado && { estado: estado as any }),
        ...(saleId && { saleId: parseInt(saleId) }),
        ...(fechaDesde &&
          fechaHasta && {
            fecha: {
              gte: new Date(fechaDesde),
              lte: new Date(fechaHasta),
            },
          }),
        ...(search && {
          OR: [
            { numero: { contains: search, mode: 'insensitive' as const } },
            { sale: { numero: { contains: search, mode: 'insensitive' as const } } },
            { chofer: { contains: search, mode: 'insensitive' as const } },
          ],
        }),
        ...(clienteId && {
          sale: {
            clientId: parseInt(clienteId),
          },
        }),
        ...(transportista && {
          transportista: { contains: transportista, mode: 'insensitive' as const },
        }),
        ...(chofer && {
          chofer: { contains: chofer, mode: 'insensitive' as const },
        }),
      },
      viewMode
    );

    const [loadOrders, total] = await Promise.all([
      prisma.loadOrder.findMany({
        where,
        include: {
          sale: {
            select: {
              id: true,
              numero: true,
              client: { select: { id: true, name: true, legalName: true } },
            },
          },
          delivery: {
            select: { id: true, numero: true, estado: true },
          },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.loadOrder.count({ where }),
    ]);

    return NextResponse.json({
      data: loadOrders,
      pagination: { total, limit, offset },
    });
  } catch (error) {
    console.error('Error fetching load orders:', error);
    return NextResponse.json(
      { error: 'Error al obtener ordenes de carga' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Create load order with auto-accommodation (bin packing)
// ═══════════════════════════════════════════════════════════════════════════════

interface CreateLoadOrderRequest {
  saleId: number;
  deliveryId?: number;
  fecha?: string;
  vehiculoTipo?: string;
  vehiculo?: string;
  vehiculoPatente?: string;
  chofer?: string;
  choferDNI?: string;
  transportista?: string;
  observaciones?: string;
  autoAcomodar?: boolean; // Enable auto bin packing
  items?: Array<{
    saleItemId: number;
    cantidad: number;
    pesoUnitario?: number;
    volumenUnitario?: number;
    largoUnitario?: number;
    anchoUnitario?: number;
    altoUnitario?: number;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_CREATE);
    if (error) return error;

    const companyId = user!.companyId;
    const viewMode = getViewMode(req);
    const docType = isExtendedMode(req) ? DOC_TYPE.T2 : DOC_TYPE.T1;

    const body: CreateLoadOrderRequest = await req.json();

    // Validate sale exists
    const sale = await prisma.sale.findFirst({
      where: applyViewMode({ id: body.saleId, companyId }, viewMode),
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
        client: {
          select: { id: true, name: true, address: true },
        },
      },
    });

    if (!sale) {
      return NextResponse.json(
        { error: 'Orden de venta no encontrada' },
        { status: 404 }
      );
    }

    // Validate delivery if provided
    let delivery = null;
    if (body.deliveryId) {
      delivery = await prisma.saleDelivery.findFirst({
        where: applyViewMode({ id: body.deliveryId, companyId }, viewMode),
      });
      if (!delivery) {
        return NextResponse.json(
          { error: 'Entrega no encontrada' },
          { status: 404 }
        );
      }
    }

    // Prepare items
    let itemsToLoad: Array<{
      saleItemId: number;
      productId: string | null;
      cantidad: number;
      pesoUnitario: number;
      volumenUnitario: number;
      largoUnitario?: number;
      anchoUnitario?: number;
      altoUnitario?: number;
    }> = [];

    if (body.items && body.items.length > 0) {
      // Use provided items
      for (const item of body.items) {
        const saleItem = sale.items.find((si) => si.id === item.saleItemId);
        if (!saleItem) {
          return NextResponse.json(
            { error: `Item de venta ${item.saleItemId} no encontrado` },
            { status: 400 }
          );
        }

        itemsToLoad.push({
          saleItemId: item.saleItemId,
          productId: saleItem.productId,
          cantidad: item.cantidad,
          pesoUnitario: item.pesoUnitario || (saleItem.product?.weight ?? 0),
          volumenUnitario: item.volumenUnitario || (saleItem.product?.volume ?? 0),
          largoUnitario: item.largoUnitario,
          anchoUnitario: item.anchoUnitario,
          altoUnitario: item.altoUnitario,
        });
      }
    } else {
      // Use all pending items from sale
      for (const saleItem of sale.items) {
        const cantidadPendiente = Number(saleItem.cantidadPendiente);
        if (cantidadPendiente > 0) {
          itemsToLoad.push({
            saleItemId: saleItem.id,
            productId: saleItem.productId,
            cantidad: cantidadPendiente,
            pesoUnitario: saleItem.product?.weight ?? 0,
            volumenUnitario: saleItem.product?.volume ?? 0,
          });
        }
      }
    }

    if (itemsToLoad.length === 0) {
      return NextResponse.json(
        { error: 'No hay items pendientes para cargar' },
        { status: 400 }
      );
    }

    // Auto-accommodation with bin packing
    let vehiculoTipo = body.vehiculoTipo;
    let packingResult = null;

    if (body.autoAcomodar !== false) {
      // Prepare items for bin packing
      const packingItems: ItemDimensions[] = itemsToLoad.map((item, idx) => ({
        id: idx,
        productId: item.productId,
        cantidad: item.cantidad,
        pesoUnitario: item.pesoUnitario,
        volumenUnitario: item.volumenUnitario,
        largoUnitario: item.largoUnitario,
        anchoUnitario: item.anchoUnitario,
        altoUnitario: item.altoUnitario,
      }));

      // Suggest vehicle if not specified
      if (!vehiculoTipo) {
        const suggestion = suggestVehicle(packingItems);
        vehiculoTipo = suggestion.recommended;
      }

      // Pack items
      const vehicle = VEHICLE_DIMENSIONS[vehiculoTipo] || VEHICLE_DIMENSIONS.CAMION_MEDIANO;
      packingResult = packItems3D(packingItems, vehicle);

      // Update items with positions
      for (const packed of packingResult.packedItems) {
        const item = itemsToLoad[packed.itemId];
        if (item) {
          (item as any).secuencia = packed.secuencia;
          (item as any).posX = packed.posX;
          (item as any).posY = packed.posY;
          (item as any).posZ = packed.posZ;
        }
      }
    }

    // Generate load order number
    const numero = await generateSequentialNumber(companyId, 'OC', 'loadOrder');

    // Create load order with items in transaction
    const loadOrder = await prisma.$transaction(async (tx) => {
      const created = await tx.loadOrder.create({
        data: {
          numero,
          saleId: body.saleId,
          deliveryId: body.deliveryId,
          fecha: body.fecha ? new Date(body.fecha) : new Date(),
          vehiculoTipo,
          vehiculo: body.vehiculo,
          vehiculoPatente: body.vehiculoPatente,
          chofer: body.chofer,
          choferDNI: body.choferDNI,
          transportista: body.transportista,
          observaciones: body.observaciones,
          pesoTotal: packingResult?.pesoTotal || null,
          volumenTotal: packingResult?.volumenTotal || null,
          docType,
          companyId,
          createdBy: user!.id,
          items: {
            create: itemsToLoad.map((item, idx) => ({
              saleItemId: item.saleItemId,
              productId: item.productId,
              cantidad: item.cantidad,
              pesoUnitario: item.pesoUnitario,
              volumenUnitario: item.volumenUnitario,
              largoUnitario: item.largoUnitario,
              anchoUnitario: item.anchoUnitario,
              altoUnitario: item.altoUnitario,
              secuencia: (item as any).secuencia ?? idx + 1,
              posX: (item as any).posX,
              posY: (item as any).posY,
              posZ: (item as any).posZ,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true },
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

      return created;
    });

    return NextResponse.json(
      {
        loadOrder,
        packing: packingResult
          ? {
              success: packingResult.success,
              utilizacion: packingResult.utilizacion,
              pesoTotal: packingResult.pesoTotal,
              volumenTotal: packingResult.volumenTotal,
              warnings: packingResult.warnings,
              errors: packingResult.errors,
            }
          : null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating load order:', error);
    return NextResponse.json(
      { error: 'Error al crear orden de carga' },
      { status: 500 }
    );
  }
}
