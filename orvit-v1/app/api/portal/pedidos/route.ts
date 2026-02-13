import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentPortalSession } from '@/lib/portal/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/portal/pedidos
 * Listar pedidos del cliente
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentPortalSession();

    if (!session) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    if (!session.permissions.canCreateOrders) {
      return NextResponse.json(
        { error: 'No tiene permisos para ver pedidos' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Construir filtro
    const where: any = {
      companyId: session.companyId,
      clientId: session.clientId,
      createdByUserId: session.portalUserId,
    };

    if (status) {
      where.estado = status;
    }

    // Obtener pedidos
    const [pedidos, total] = await Promise.all([
      prisma.clientPortalOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.clientPortalOrder.count({ where }),
    ]);

    // Formatear respuesta
    const formattedPedidos = pedidos.map((p) => ({
      id: p.id,
      numero: p.numero,
      estado: p.estado,
      total: Number(p.total),
      moneda: p.moneda,
      notasCliente: p.notasCliente,
      direccionEntrega: p.direccionEntrega,
      createdAt: p.createdAt,
      processedAt: p.processedAt,
      processNotes: p.processNotes,
      rejectionReason: p.rejectionReason,
      items: p.items.map((item) => ({
        id: item.id,
        product: item.product,
        descripcion: item.descripcion,
        cantidad: Number(item.cantidad),
        precioUnitario: Number(item.precioUnitario),
        subtotal: Number(item.subtotal),
        notas: item.notas,
      })),
      cantidadItems: p.items.length,
    }));

    // Estadísticas
    const stats = await prisma.clientPortalOrder.groupBy({
      by: ['estado'],
      where: {
        companyId: session.companyId,
        clientId: session.clientId,
        createdByUserId: session.portalUserId,
      },
      _count: true,
    });

    const estadisticas = {
      pendientes: stats.find(s => s.estado === 'PENDIENTE')?._count || 0,
      enRevision: stats.find(s => s.estado === 'EN_REVISION')?._count || 0,
      confirmados: stats.find(s => s.estado === 'CONFIRMADO')?._count || 0,
      convertidos: stats.find(s => s.estado === 'CONVERTIDO')?._count || 0,
      rechazados: stats.find(s => s.estado === 'RECHAZADO')?._count || 0,
      cancelados: stats.find(s => s.estado === 'CANCELADO')?._count || 0,
      total: stats.reduce((acc, s) => acc + s._count, 0),
    };

    return NextResponse.json({
      pedidos: formattedPedidos,
      estadisticas,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error obteniendo pedidos del portal:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portal/pedidos
 * Crear nuevo pedido desde el portal
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentPortalSession();

    if (!session) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    if (!session.permissions.canCreateOrders) {
      return NextResponse.json(
        { error: 'No tiene permisos para crear pedidos' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { items, notas, direccionEntrega } = body;

    // Validaciones
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Debe incluir al menos un producto' },
        { status: 400 }
      );
    }

    // Validar items y calcular totales
    const productIds = items.map((i: any) => i.productId);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        companyId: session.companyId,
        isActive: true,
      },
      include: {
        prices: {
          where: {
            priceList: {
              clients: {
                some: { id: session.clientId },
              },
            },
            isActive: true,
          },
          take: 1,
        },
      },
    });

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { error: 'Algunos productos no están disponibles' },
        { status: 400 }
      );
    }

    // Construir items con precios
    let subtotal = 0;
    const orderItems = items.map((item: any) => {
      const product = products.find(p => p.id === item.productId);
      const price = product?.prices[0]?.price || 0;
      const cantidad = Number(item.cantidad) || 1;
      const itemSubtotal = Number(price) * cantidad;
      subtotal += itemSubtotal;

      return {
        productId: item.productId,
        descripcion: product?.name || 'Producto',
        cantidad,
        unidad: product?.unit || 'unidad',
        precioUnitario: price,
        subtotal: itemSubtotal,
        notas: item.notas || null,
      };
    });

    const total = subtotal * 1.21; // Con IVA

    // Verificar límite de monto
    if (session.limits.maxOrderAmount && total > session.limits.maxOrderAmount) {
      return NextResponse.json(
        { error: `El monto total ($${total.toLocaleString()}) excede su límite de $${session.limits.maxOrderAmount.toLocaleString()}` },
        { status: 400 }
      );
    }

    // Determinar si requiere aprobación
    const requiresApproval = session.limits.requiresApprovalAbove
      ? total > session.limits.requiresApprovalAbove
      : false;

    // Generar número de pedido
    const year = new Date().getFullYear();
    const lastOrder = await prisma.clientPortalOrder.findFirst({
      where: { companyId: session.companyId },
      orderBy: { createdAt: 'desc' },
      select: { numero: true },
    });

    let nextNumber = 1;
    if (lastOrder?.numero) {
      const match = lastOrder.numero.match(/PED-\d{4}-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    const numero = `PED-${year}-${String(nextNumber).padStart(5, '0')}`;

    // Obtener IP y user agent
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;

    // Generar clientRequestId único
    const clientRequestId = `${session.portalUserId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Crear pedido
    const pedido = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.clientPortalOrder.create({
        data: {
          companyId: session.companyId,
          clientId: session.clientId,
          createdByUserId: session.portalUserId,
          clientRequestId,
          numero,
          estado: requiresApproval ? 'PENDIENTE' : 'EN_REVISION',
          subtotal,
          total,
          moneda: 'ARS',
          notasCliente: notas || null,
          direccionEntrega: direccionEntrega || null,
          ipAddress: ip,
          userAgent,
          items: {
            create: orderItems,
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, code: true, name: true },
              },
            },
          },
        },
      });

      // Registrar actividad
      await tx.clientPortalActivity.create({
        data: {
          portalUserId: session.portalUserId,
          clientId: session.clientId,
          companyId: session.companyId,
          action: 'CREATE_ORDER',
          entityType: 'portal_order',
          entityId: newOrder.id,
          details: {
            numero,
            total,
            itemsCount: orderItems.length,
            requiresApproval,
          },
          ipAddress: ip,
          userAgent,
        },
      });

      return newOrder;
    });

    return NextResponse.json({
      success: true,
      message: requiresApproval
        ? 'Pedido creado y pendiente de aprobación'
        : 'Pedido creado correctamente',
      pedido: {
        id: pedido.id,
        numero: pedido.numero,
        estado: pedido.estado,
        total: Number(pedido.total),
        requiresApproval,
      },
    });
  } catch (error) {
    console.error('Error creando pedido del portal:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
