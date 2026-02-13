import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Verificar que el usuario sea admin/superadmin
async function verifyAdmin(request: NextRequest) {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
    });

    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error verificando admin:', error);
    return null;
  }
}

// GET - Obtener descuentos por rubro de una lista
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: discountListId } = params;

    const rubros = await prisma.$queryRaw`
      SELECT dlr.*, c.name as "categoryNameFromDB"
      FROM "DiscountListRubro" dlr
      LEFT JOIN "Category" c ON c.id = dlr."categoryId"
      WHERE dlr."discountListId" = ${discountListId}
      ORDER BY dlr."categoryName" ASC
    ` as any[];

    return NextResponse.json(rubros || []);
  } catch (error: any) {
    console.error('Error al obtener descuentos por rubro:', error);
    return NextResponse.json(
      { error: 'Error al obtener descuentos', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Agregar descuento por rubro a una lista
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: discountListId } = params;
    const body = await request.json();
    const {
      categoryId,
      categoryName,
      serieDesde,
      serieHasta,
      descuento1,
      descuento2,
      descuentoPago,
      comision,
    } = body;

    if (!categoryId || !categoryName) {
      return NextResponse.json(
        { error: 'categoryId y categoryName son requeridos' },
        { status: 400 }
      );
    }

    const cuid = () => {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 15);
      return `dlr${timestamp}${random}`;
    };
    const rubroId = cuid();

    await prisma.$executeRaw`
      INSERT INTO "DiscountListRubro" (
        id, "discountListId", "categoryId", "categoryName",
        "serieDesde", "serieHasta",
        descuento1, descuento2, "descuentoPago", comision,
        "isActive", "createdAt", "updatedAt"
      ) VALUES (
        ${rubroId}, ${discountListId}, ${parseInt(categoryId)}, ${categoryName},
        ${serieDesde || 0}, ${serieHasta || 0},
        ${descuento1 || null}, ${descuento2 || null}, ${descuentoPago || null}, ${comision || null},
        true, NOW(), NOW()
      )
    `;

    const created = await prisma.$queryRaw`
      SELECT * FROM "DiscountListRubro" WHERE id = ${rubroId}
    ` as any[];

    return NextResponse.json(created[0], { status: 201 });
  } catch (error: any) {
    console.error('Error al crear descuento por rubro:', error);
    return NextResponse.json(
      { error: 'Error al crear descuento', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Actualizar descuento por rubro
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      rubroId, // ID del descuento a actualizar
      serieDesde,
      serieHasta,
      descuento1,
      descuento2,
      descuentoPago,
      comision,
      isActive,
    } = body;

    if (!rubroId) {
      return NextResponse.json({ error: 'rubroId es requerido' }, { status: 400 });
    }

    await prisma.$executeRaw`
      UPDATE "DiscountListRubro"
      SET "serieDesde" = ${serieDesde || 0},
          "serieHasta" = ${serieHasta || 0},
          descuento1 = ${descuento1 || null},
          descuento2 = ${descuento2 || null},
          "descuentoPago" = ${descuentoPago || null},
          comision = ${comision || null},
          "isActive" = COALESCE(${isActive}, "isActive"),
          "updatedAt" = NOW()
      WHERE id = ${rubroId}
    `;

    const updated = await prisma.$queryRaw`
      SELECT * FROM "DiscountListRubro" WHERE id = ${rubroId}
    ` as any[];

    return NextResponse.json(updated[0]);
  } catch (error: any) {
    console.error('Error al actualizar descuento:', error);
    return NextResponse.json(
      { error: 'Error al actualizar descuento', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar descuento por rubro
export async function DELETE(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rubroId = searchParams.get('rubroId');

    if (!rubroId) {
      return NextResponse.json({ error: 'rubroId es requerido' }, { status: 400 });
    }

    await prisma.$executeRaw`
      DELETE FROM "DiscountListRubro" WHERE id = ${rubroId}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al eliminar descuento:', error);
    return NextResponse.json(
      { error: 'Error al eliminar descuento', details: error.message },
      { status: 500 }
    );
  }
}
