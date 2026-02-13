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

// GET - Obtener descuentos por producto de una lista
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

    const products = await prisma.$queryRaw`
      SELECT dlp.*, p.name as "productNameFromDB", p.code as "productCodeFromDB"
      FROM "DiscountListProduct" dlp
      LEFT JOIN "Product" p ON p.id = dlp."productId"
      WHERE dlp."discountListId" = ${discountListId}
      ORDER BY dlp."productName" ASC
    ` as any[];

    return NextResponse.json(products || []);
  } catch (error: any) {
    console.error('Error al obtener descuentos por producto:', error);
    return NextResponse.json(
      { error: 'Error al obtener descuentos', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Agregar descuento por producto a una lista
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
    const { productId, productCode, productName, descuento } = body;

    if (!productId || !productCode || !productName || descuento === undefined) {
      return NextResponse.json(
        { error: 'productId, productCode, productName y descuento son requeridos' },
        { status: 400 }
      );
    }

    const cuid = () => {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 15);
      return `dlp${timestamp}${random}`;
    };
    const productDiscountId = cuid();

    await prisma.$executeRaw`
      INSERT INTO "DiscountListProduct" (
        id, "discountListId", "productId", "productCode", "productName",
        descuento, "isActive", "createdAt", "updatedAt"
      ) VALUES (
        ${productDiscountId}, ${discountListId}, ${productId}, ${productCode}, ${productName},
        ${descuento}, true, NOW(), NOW()
      )
    `;

    const created = await prisma.$queryRaw`
      SELECT * FROM "DiscountListProduct" WHERE id = ${productDiscountId}
    ` as any[];

    return NextResponse.json(created[0], { status: 201 });
  } catch (error: any) {
    console.error('Error al crear descuento por producto:', error);
    return NextResponse.json(
      { error: 'Error al crear descuento', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Actualizar descuento por producto
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
    const { productDiscountId, descuento, isActive } = body;

    if (!productDiscountId) {
      return NextResponse.json({ error: 'productDiscountId es requerido' }, { status: 400 });
    }

    await prisma.$executeRaw`
      UPDATE "DiscountListProduct"
      SET descuento = ${descuento},
          "isActive" = COALESCE(${isActive}, "isActive"),
          "updatedAt" = NOW()
      WHERE id = ${productDiscountId}
    `;

    const updated = await prisma.$queryRaw`
      SELECT * FROM "DiscountListProduct" WHERE id = ${productDiscountId}
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

// DELETE - Eliminar descuento por producto
export async function DELETE(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const productDiscountId = searchParams.get('productDiscountId');

    if (!productDiscountId) {
      return NextResponse.json({ error: 'productDiscountId es requerido' }, { status: 400 });
    }

    await prisma.$executeRaw`
      DELETE FROM "DiscountListProduct" WHERE id = ${productDiscountId}
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
