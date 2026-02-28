import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requirePermission, checkPermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { createLiquidacionSchema, liquidacionFilterSchema } from '@/lib/ventas/validation-schemas';
import { generateLiquidacionNumber } from '@/lib/ventas/document-number';

export const dynamic = 'force-dynamic';

// GET - Listar liquidaciones
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.LIQUIDACIONES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const { searchParams } = new URL(request.url);

    // Check if user can view all comisiones or only own
    const canViewAll = await checkPermission(user!.id, companyId, VENTAS_PERMISSIONS.COMISIONES_VIEW_ALL);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const estado = searchParams.get('estado');
    const sellerId = searchParams.get('sellerId');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
    const search = searchParams.get('search');

    const where: Prisma.SellerLiquidacionWhereInput = {
      companyId,
      // If user cannot view all, restrict to own liquidaciones
      ...(!canViewAll && { sellerId: user!.id }),
      ...(estado && { estado: estado as any }),
      ...(sellerId && { sellerId: parseInt(sellerId) }),
      ...(fechaDesde && { fechaDesde: { gte: new Date(fechaDesde) } }),
      ...(fechaHasta && { fechaHasta: { lte: new Date(fechaHasta) } }),
      ...(search && {
        OR: [
          { numero: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { seller: { name: { contains: search, mode: Prisma.QueryMode.insensitive } } },
        ],
      }),
    };

    const [liquidaciones, total] = await Promise.all([
      prisma.sellerLiquidacion.findMany({
        where,
        include: {
          seller: { select: { id: true, name: true, email: true } },
          createdByUser: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.sellerLiquidacion.count({ where }),
    ]);

    return NextResponse.json({
      data: liquidaciones,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching liquidaciones:', error);
    return NextResponse.json({ error: 'Error al obtener liquidaciones' }, { status: 500 });
  }
}

// POST - Crear liquidación
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.LIQUIDACIONES_CREATE);
    if (error) return error;

    const companyId = user!.companyId;
    const body = await request.json();

    const validation = createLiquidacionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Verificar que el vendedor existe
    const vendedor = await prisma.user.findFirst({
      where: { id: data.sellerId, companyId },
    });
    if (!vendedor) {
      return NextResponse.json({ error: 'Vendedor no encontrado' }, { status: 404 });
    }

    // Verificar que las ventas pertenecen al vendedor y están en estado elegible
    const saleIds = data.items.map(i => i.saleId);
    const ventas = await prisma.sale.findMany({
      where: {
        id: { in: saleIds },
        companyId,
        sellerId: data.sellerId,
      },
      include: {
        client: { select: { legalName: true } },
        items: { select: { subtotal: true, aplicaComision: true } },
      },
    });

    if (ventas.length !== saleIds.length) {
      return NextResponse.json(
        { error: 'Algunas ventas no pertenecen al vendedor o no existen' },
        { status: 400 }
      );
    }

    // Verificar que no estén en otra liquidación activa
    const ventasYaLiquidadas = await prisma.sellerLiquidacionItem.findMany({
      where: {
        saleId: { in: saleIds },
        incluido: true,
        liquidacion: {
          estado: { in: ['CONFIRMADA', 'PAGADA'] },
        },
      },
      select: { saleId: true, liquidacion: { select: { numero: true } } },
    });

    if (ventasYaLiquidadas.length > 0) {
      const duplicadas = ventasYaLiquidadas.map(v =>
        `Venta #${v.saleId} ya está en liquidación ${v.liquidacion.numero}`
      );
      return NextResponse.json(
        { error: 'Ventas ya liquidadas', details: duplicadas },
        { status: 400 }
      );
    }

    // Buscar comisión del SalesRep si no se provee
    let comisionPct = data.comisionPorcentaje;
    if (comisionPct === undefined) {
      const rep = await prisma.salesRep.findFirst({
        where: {
          companyId,
          OR: [
            { email: vendedor.email || '' },
            { nombre: vendedor.name || '' },
          ],
        },
        select: { comision: true },
      });
      comisionPct = rep ? Number(rep.comision) : 0;
    }

    // Calcular totales
    const ventasMap = new Map(ventas.map(v => [v.id, v]));
    let totalVentas = 0;
    let totalComisiones = 0;

    const itemsData = data.items.map(itemInput => {
      const venta = ventasMap.get(itemInput.saleId)!;
      const totalVenta = Number(venta.total);
      // Base de comisión: solo ítems con aplicaComision=true
      const baseComision = venta.items
        .filter(i => i.aplicaComision)
        .reduce((sum, i) => sum + Number(i.subtotal), 0);
      const comisionMonto = baseComision * (comisionPct! / 100);
      totalVentas += itemInput.incluido ? totalVenta : 0;
      totalComisiones += itemInput.incluido ? comisionMonto : 0;

      return {
        saleId: venta.id,
        saleNumero: venta.numero,
        clienteNombre: venta.client.legalName || 'Sin nombre',
        fechaVenta: venta.fechaEmision,
        totalVenta,
        baseComision,
        comisionMonto,
        incluido: itemInput.incluido,
        motivoExclusion: itemInput.motivoExclusion || null,
      };
    });

    const ajustes = data.ajustes || 0;
    const totalLiquidacion = totalComisiones + ajustes;

    const numero = await generateLiquidacionNumber(companyId);

    const liquidacion = await prisma.$transaction(async (tx) => {
      const liq = await tx.sellerLiquidacion.create({
        data: {
          numero,
          sellerId: data.sellerId,
          estado: 'BORRADOR',
          fechaDesde: new Date(data.fechaDesde),
          fechaHasta: new Date(data.fechaHasta),
          totalVentas,
          comisionPorcentaje: comisionPct!,
          totalComisiones,
          ajustes,
          totalLiquidacion,
          notas: data.notas || null,
          notasInternas: data.notasInternas || null,
          companyId,
          createdBy: user!.id,
        },
      });

      await tx.sellerLiquidacionItem.createMany({
        data: itemsData.map(item => ({
          liquidacionId: liq.id,
          ...item,
        })),
      });

      return liq;
    });

    // Obtener completa
    const liquidacionCompleta = await prisma.sellerLiquidacion.findUnique({
      where: { id: liquidacion.id },
      include: {
        seller: { select: { id: true, name: true, email: true } },
        items: { include: { sale: { select: { id: true, numero: true } } } },
        createdByUser: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(liquidacionCompleta, { status: 201 });
  } catch (error) {
    console.error('Error creating liquidación:', error);
    return NextResponse.json(
      { error: 'Error al crear la liquidación', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
