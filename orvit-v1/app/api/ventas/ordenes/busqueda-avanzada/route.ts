/**
 * POST /api/ventas/ordenes/busqueda-avanzada
 *
 * Advanced search endpoint for Sale Orders with complex filters.
 * Supports:
 * - Multi-status filter
 * - Amount range (min/max)
 * - Date ranges
 * - Client, seller, product filters
 * - "Frozen" orders (no activity for N days)
 * - Overdue orders
 * - Text search across multiple fields
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { Prisma } from '@prisma/client';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

interface AdvancedSearchRequest {
  // Status filters
  estados?: string[]; // Multiple states

  // Amount filters
  montoMin?: number;
  montoMax?: number;

  // Date filters
  fechaEmisionDesde?: string;
  fechaEmisionHasta?: string;
  fechaEntregaDesde?: string;
  fechaEntregaHasta?: string;

  // Related entity filters
  clienteIds?: number[];
  vendedorIds?: number[];
  productIds?: string[];

  // Activity filters
  diasSinActividad?: number; // "Frozen" orders
  soloVencidas?: boolean; // Overdue delivery dates

  // Text search
  busquedaTexto?: string; // Search across numero, notas, client name

  // Pagination
  limit?: number;
  offset?: number;

  // Sorting
  ordenarPor?: 'fecha' | 'monto' | 'cliente' | 'estado';
  ordenDireccion?: 'asc' | 'desc';
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const viewMode = getViewMode(request);
    const body: AdvancedSearchRequest = await request.json();

    // Build where clause
    const where: Prisma.SaleWhereInput = applyViewMode({ companyId }, viewMode);

    // Status filter (multiple)
    if (body.estados && body.estados.length > 0) {
      where.estado = { in: body.estados as any };
    }

    // Amount range
    if (body.montoMin !== undefined || body.montoMax !== undefined) {
      where.total = {};
      if (body.montoMin !== undefined) {
        where.total.gte = new Prisma.Decimal(body.montoMin);
      }
      if (body.montoMax !== undefined) {
        where.total.lte = new Prisma.Decimal(body.montoMax);
      }
    }

    // Date range - Emisión
    if (body.fechaEmisionDesde || body.fechaEmisionHasta) {
      where.fechaEmision = {};
      if (body.fechaEmisionDesde) {
        where.fechaEmision.gte = new Date(body.fechaEmisionDesde);
      }
      if (body.fechaEmisionHasta) {
        where.fechaEmision.lte = new Date(body.fechaEmisionHasta);
      }
    }

    // Date range - Entrega
    if (body.fechaEntregaDesde || body.fechaEntregaHasta) {
      where.fechaEntregaDeseada = {};
      if (body.fechaEntregaDesde) {
        where.fechaEntregaDeseada.gte = new Date(body.fechaEntregaDesde);
      }
      if (body.fechaEntregaHasta) {
        where.fechaEntregaDeseada.lte = new Date(body.fechaEntregaHasta);
      }
    }

    // Client filter (multiple)
    if (body.clienteIds && body.clienteIds.length > 0) {
      where.clientId = { in: body.clienteIds.map(String) };
    }

    // Seller filter (multiple)
    if (body.vendedorIds && body.vendedorIds.length > 0) {
      where.sellerId = { in: body.vendedorIds };
    }

    // Product filter (orders containing these products)
    if (body.productIds && body.productIds.length > 0) {
      where.items = {
        some: {
          productId: { in: body.productIds },
        },
      };
    }

    // Frozen orders (no activity for N days)
    if (body.diasSinActividad) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - body.diasSinActividad);
      where.updatedAt = { lte: cutoffDate };
    }

    // Overdue orders
    if (body.soloVencidas) {
      const now = new Date();
      where.fechaEntregaDeseada = {
        ...where.fechaEntregaDeseada,
        lt: now,
      };
      where.estado = {
        notIn: ['ENTREGADA', 'FACTURADA', 'CANCELADA'],
      };
    }

    // Text search across multiple fields
    if (body.busquedaTexto && body.busquedaTexto.trim() !== '') {
      const searchTerm = body.busquedaTexto.trim();
      where.OR = [
        { numero: { contains: searchTerm, mode: 'insensitive' } },
        { notas: { contains: searchTerm, mode: 'insensitive' } },
        { notasInternas: { contains: searchTerm, mode: 'insensitive' } },
        {
          client: {
            OR: [
              { legalName: { contains: searchTerm, mode: 'insensitive' } },
              { name: { contains: searchTerm, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    // Build orderBy
    const orderBy: Prisma.SaleOrderByWithRelationInput = {};
    if (body.ordenarPor) {
      switch (body.ordenarPor) {
        case 'fecha':
          orderBy.fechaEmision = body.ordenDireccion || 'desc';
          break;
        case 'monto':
          orderBy.total = body.ordenDireccion || 'desc';
          break;
        case 'cliente':
          orderBy.client = { legalName: body.ordenDireccion || 'asc' };
          break;
        case 'estado':
          orderBy.estado = body.ordenDireccion || 'asc';
          break;
        default:
          orderBy.fechaEmision = 'desc';
      }
    } else {
      orderBy.fechaEmision = 'desc';
    }

    // Pagination
    const limit = Math.min(body.limit || 50, 200);
    const offset = body.offset || 0;

    // Execute query
    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          client: {
            select: {
              id: true,
              legalName: true,
              name: true,
            },
          },
          seller: {
            select: {
              id: true,
              name: true,
            },
          },
          createdByUser: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              items: true,
              deliveries: true,
              invoices: true,
            },
          },
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      prisma.sale.count({ where }),
    ]);

    return NextResponse.json({
      data: sales,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      filters: body, // Echo back filters for UI state
    });
  } catch (error) {
    console.error('[BUSQUEDA-AVANZADA] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error en búsqueda' },
      { status: 500 }
    );
  }
}
