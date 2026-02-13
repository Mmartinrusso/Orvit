import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/products/[id]/stock-movements - Obtener historial de movimientos de stock
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Verificar que el producto existe y pertenece a la empresa
    const product = await prisma.product.findFirst({
      where: {
        id,
        companyId: auth.companyId,
      },
      select: { id: true, name: true, currentStock: true, unit: true }
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    // Obtener movimientos de stock
    const movements = await prisma.productStockMovement.findMany({
      where: {
        productId: id,
        companyId: auth.companyId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: { id: true, name: true }
        }
      }
    });

    // Contar total de movimientos
    const total = await prisma.productStockMovement.count({
      where: {
        productId: id,
        companyId: auth.companyId,
      }
    });

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        currentStock: product.currentStock,
        unit: product.unit
      },
      movements,
      total,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error in GET /api/products/[id]/stock-movements:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/products/[id]/stock-movements - Crear ajuste manual de stock
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();

    // Validar campos requeridos
    if (!body.tipo || body.cantidad === undefined) {
      return NextResponse.json(
        { error: 'Tipo y cantidad son requeridos' },
        { status: 400 }
      );
    }

    // Validar tipo
    if (!['ENTRADA', 'SALIDA', 'AJUSTE'].includes(body.tipo)) {
      return NextResponse.json(
        { error: 'Tipo debe ser ENTRADA, SALIDA o AJUSTE' },
        { status: 400 }
      );
    }

    // Verificar que el producto existe y pertenece a la empresa
    const product = await prisma.product.findFirst({
      where: {
        id,
        companyId: auth.companyId,
      }
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    const cantidad = parseFloat(body.cantidad);
    const stockAnterior = product.currentStock || 0;
    let stockPosterior: number;

    // Calcular nuevo stock segun el tipo
    switch (body.tipo) {
      case 'ENTRADA':
        stockPosterior = stockAnterior + Math.abs(cantidad);
        break;
      case 'SALIDA':
        stockPosterior = stockAnterior - Math.abs(cantidad);
        if (stockPosterior < 0) {
          return NextResponse.json(
            { error: 'No hay suficiente stock disponible' },
            { status: 400 }
          );
        }
        break;
      case 'AJUSTE':
        // Para ajuste, la cantidad es el nuevo valor absoluto
        stockPosterior = Math.max(0, cantidad);
        break;
      default:
        stockPosterior = stockAnterior;
    }

    // Usar transaccion para crear movimiento y actualizar stock
    const result = await prisma.$transaction(async (tx) => {
      // Crear el movimiento
      const movement = await tx.productStockMovement.create({
        data: {
          productId: id,
          companyId: auth.companyId,
          tipo: body.tipo,
          cantidad: body.tipo === 'AJUSTE'
            ? stockPosterior - stockAnterior
            : Math.abs(cantidad),
          stockAnterior,
          stockPosterior,
          sourceType: body.sourceType || 'MANUAL',
          sourceId: body.sourceId || null,
          sourceNumber: body.sourceNumber || null,
          motivo: body.motivo || null,
          notas: body.notas || null,
          createdBy: auth.userId,
        },
        include: {
          user: {
            select: { id: true, name: true }
          }
        }
      });

      // Actualizar stock del producto
      const updatedProduct = await tx.product.update({
        where: { id },
        data: {
          currentStock: stockPosterior
        },
        select: { id: true, name: true, currentStock: true }
      });

      return { movement, updatedProduct };
    });

    return NextResponse.json({
      message: 'Movimiento de stock registrado',
      movement: result.movement,
      product: result.updatedProduct
    }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/products/[id]/stock-movements:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
