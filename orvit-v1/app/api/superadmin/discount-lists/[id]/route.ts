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

// GET - Obtener una lista de descuentos por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = params;

    try {
      const list = await (prisma as any).discountList.findUnique({
        where: { id },
        include: {
          rubroDiscounts: {
            include: {
              category: true,
            },
          },
          productDiscounts: {
            include: {
              product: true,
            },
          },
          _count: {
            select: {
              clients: true,
            },
          },
        },
      });

      if (!list) {
        return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 });
      }

      return NextResponse.json(list);
    } catch (error: any) {
      // Fallback a SQL raw
      if (error.message?.includes('Unknown model') || error.message?.includes('Cannot read properties')) {
        const lists = await prisma.$queryRaw`
          SELECT * FROM "DiscountList" WHERE id = ${id}
        ` as any[];

        if (lists.length === 0) {
          return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 });
        }

        const list = lists[0];

        const rubros = await prisma.$queryRaw`
          SELECT dlr.*, c.name as "categoryNameFromDB"
          FROM "DiscountListRubro" dlr
          LEFT JOIN "Category" c ON c.id = dlr."categoryId"
          WHERE dlr."discountListId" = ${id}
        ` as any[];

        const products = await prisma.$queryRaw`
          SELECT dlp.*, p.name as "productNameFromDB", p.code as "productCodeFromDB"
          FROM "DiscountListProduct" dlp
          LEFT JOIN "Product" p ON p.id = dlp."productId"
          WHERE dlp."discountListId" = ${id}
        ` as any[];

        const clientCount = await prisma.$queryRaw`
          SELECT COUNT(*) as count FROM "Client" WHERE "discountListId" = ${id}
        ` as any[];

        return NextResponse.json({
          ...list,
          rubroDiscounts: rubros,
          productDiscounts: products,
          _count: { clients: parseInt(clientCount[0]?.count) || 0 },
        });
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error al obtener lista:', error);
    return NextResponse.json(
      { error: 'Error al obtener lista', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Actualizar una lista de descuentos
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { name, description, isActive } = body;

    try {
      const list = await (prisma as any).discountList.update({
        where: { id },
        data: {
          name: name?.trim(),
          description: description?.trim() || null,
          isActive: isActive !== undefined ? isActive : undefined,
          updatedAt: new Date(),
        },
      });

      return NextResponse.json(list);
    } catch (error: any) {
      // Fallback a SQL raw
      if (error.message?.includes('Unknown model') || error.message?.includes('Cannot read properties')) {
        await prisma.$executeRaw`
          UPDATE "DiscountList"
          SET name = ${name?.trim()},
              description = ${description?.trim() || null},
              "isActive" = COALESCE(${isActive}, "isActive"),
              "updatedAt" = NOW()
          WHERE id = ${id}
        `;

        const updated = await prisma.$queryRaw`
          SELECT * FROM "DiscountList" WHERE id = ${id}
        ` as any[];

        return NextResponse.json(updated[0]);
      }

      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'Ya existe una lista con ese nombre en la empresa' },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error al actualizar lista:', error);
    return NextResponse.json(
      { error: 'Error al actualizar lista', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar una lista de descuentos
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = params;

    try {
      // Verificar si hay clientes usando esta lista
      const clientCount = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM "Client" WHERE "discountListId" = ${id}
      ` as any[];

      if (parseInt(clientCount[0]?.count) > 0) {
        return NextResponse.json(
          { error: `No se puede eliminar: ${clientCount[0].count} cliente(s) usan esta lista` },
          { status: 409 }
        );
      }

      await (prisma as any).discountList.delete({
        where: { id },
      });

      return NextResponse.json({ success: true });
    } catch (error: any) {
      // Fallback a SQL raw
      if (error.message?.includes('Unknown model') || error.message?.includes('Cannot read properties')) {
        // Verificar clientes
        const clientCount = await prisma.$queryRaw`
          SELECT COUNT(*) as count FROM "Client" WHERE "discountListId" = ${id}
        ` as any[];

        if (parseInt(clientCount[0]?.count) > 0) {
          return NextResponse.json(
            { error: `No se puede eliminar: ${clientCount[0].count} cliente(s) usan esta lista` },
            { status: 409 }
          );
        }

        // Eliminar productos asociados primero
        await prisma.$executeRaw`
          DELETE FROM "DiscountListProduct" WHERE "discountListId" = ${id}
        `;
        // Eliminar rubros asociados
        await prisma.$executeRaw`
          DELETE FROM "DiscountListRubro" WHERE "discountListId" = ${id}
        `;
        // Eliminar lista
        await prisma.$executeRaw`
          DELETE FROM "DiscountList" WHERE id = ${id}
        `;

        return NextResponse.json({ success: true });
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error al eliminar lista:', error);
    return NextResponse.json(
      { error: 'Error al eliminar lista', details: error.message },
      { status: 500 }
    );
  }
}
