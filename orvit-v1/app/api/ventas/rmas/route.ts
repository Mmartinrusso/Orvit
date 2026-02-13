import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { prisma } from '@/lib/prisma';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

/**
 * GET - List RMAs with filters
 *
 * Query params:
 * - estado: Filter by status
 * - clientId: Filter by client
 * - tipo: Filter by type
 * - dateFrom, dateTo: Date range
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ENTREGAS_VIEW);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const estado = searchParams.get('estado');
    const clientId = searchParams.get('clientId');
    const tipo = searchParams.get('tipo');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const viewMode = getViewMode(request);

    const where: any = applyViewMode({}, viewMode, user!.companyId);

    if (estado) where.estado = estado;
    if (clientId) where.clientId = clientId;
    if (tipo) where.tipo = tipo;
    if (dateFrom) where.fechaSolicitud = { ...where.fechaSolicitud, gte: new Date(dateFrom) };
    if (dateTo) where.fechaSolicitud = { ...where.fechaSolicitud, lte: new Date(dateTo) };

    const [rmas, total] = await Promise.all([
      prisma.saleRMA.findMany({
        where,
        include: {
          client: {
            select: { id: true, legalName: true, email: true },
          },
          solicitante: {
            select: { id: true, name: true },
          },
          items: {
            include: {
              product: {
                select: { id: true, name: true, code: true },
              },
            },
          },
        },
        orderBy: { fechaSolicitud: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.saleRMA.count({ where }),
    ]);

    return NextResponse.json({
      data: rmas,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching RMAs:', error);
    return NextResponse.json({ error: 'Error al obtener RMAs' }, { status: 500 });
  }
}

/**
 * POST - Create new RMA
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ENTREGAS_EDIT);
    if (error) return error;

    const body = await request.json();
    const {
      clientId,
      saleId,
      invoiceId,
      tipo,
      categoriaMotivo,
      motivoDetallado,
      items,
    } = body;

    // Generate RMA number
    const count = await prisma.saleRMA.count({
      where: { companyId: user!.companyId },
    });
    const numero = `RMA-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    // Create RMA
    const rma = await prisma.saleRMA.create({
      data: {
        numero,
        companyId: user!.companyId,
        clientId,
        saleId,
        invoiceId,
        tipo,
        categoriaMotivo,
        motivoDetallado,
        solicitadoPor: user!.id,
        estado: 'SOLICITADO',
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            cantidadSolicitada: item.cantidad,
            precioUnitario: item.precioUnitario || 0,
            subtotal: (item.cantidad || 0) * (item.precioUnitario || 0),
            motivoEspecifico: item.motivo,
            lote: item.lote,
            numeroSerie: item.numeroSerie,
          })),
        },
      },
      include: {
        client: {
          select: { id: true, legalName: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
    });

    // Create history entry
    await prisma.saleRMAHistory.create({
      data: {
        rmaId: rma.id,
        estadoNuevo: 'SOLICITADO',
        userId: user!.id,
        notas: 'RMA creado',
      },
    });

    return NextResponse.json(rma, { status: 201 });
  } catch (error) {
    console.error('Error creating RMA:', error);
    return NextResponse.json({ error: 'Error al crear RMA' }, { status: 500 });
  }
}
