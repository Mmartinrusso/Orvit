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

// GET - Obtener todas las listas de descuentos de una empresa
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 });
    }

    try {
      const lists = await (prisma as any).discountList.findMany({
        where: {
          companyId: parseInt(companyId),
        },
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
        orderBy: {
          name: 'asc',
        },
      });

      return NextResponse.json(lists || []);
    } catch (error: any) {
      // Fallback a SQL raw si el modelo no está disponible
      if (error.message?.includes('Unknown model') || error.message?.includes('Cannot read properties')) {
        const lists = await prisma.$queryRaw`
          SELECT
            dl.*,
            (SELECT COUNT(*) FROM "Client" WHERE "discountListId" = dl.id) as "clientCount"
          FROM "DiscountList" dl
          WHERE dl."companyId" = ${parseInt(companyId)}
          ORDER BY dl.name ASC
        ` as any[];

        // Cargar rubros y productos para cada lista
        const listsWithDetails = await Promise.all(
          lists.map(async (list: any) => {
            const rubros = await prisma.$queryRaw`
              SELECT dlr.*, c.name as "categoryNameFromDB"
              FROM "DiscountListRubro" dlr
              LEFT JOIN "Category" c ON c.id = dlr."categoryId"
              WHERE dlr."discountListId" = ${list.id}
            ` as any[];

            const products = await prisma.$queryRaw`
              SELECT dlp.*, p.name as "productNameFromDB", p.code as "productCodeFromDB"
              FROM "DiscountListProduct" dlp
              LEFT JOIN "Product" p ON p.id = dlp."productId"
              WHERE dlp."discountListId" = ${list.id}
            ` as any[];

            return {
              ...list,
              rubroDiscounts: rubros,
              productDiscounts: products,
              _count: { clients: parseInt(list.clientCount) || 0 },
            };
          })
        );

        return NextResponse.json(listsWithDetails);
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error al obtener listas de descuentos:', error);
    return NextResponse.json(
      { error: 'Error al obtener listas de descuentos', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Crear una nueva lista de descuentos
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, companyId } = body;

    if (!name || !companyId) {
      return NextResponse.json(
        { error: 'name y companyId son requeridos' },
        { status: 400 }
      );
    }

    try {
      const list = await (prisma as any).discountList.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          companyId: parseInt(companyId),
        },
      });

      return NextResponse.json(list, { status: 201 });
    } catch (error: any) {
      // Fallback a SQL raw
      if (error.message?.includes('Unknown model') || error.message?.includes('Cannot read properties')) {
        const cuid = () => {
          const timestamp = Date.now().toString(36);
          const random = Math.random().toString(36).substring(2, 15);
          return `dl${timestamp}${random}`;
        };
        const listId = cuid();

        await prisma.$executeRaw`
          INSERT INTO "DiscountList" (id, name, description, "companyId", "isActive", "createdAt", "updatedAt")
          VALUES (${listId}, ${name.trim()}, ${description?.trim() || null}, ${parseInt(companyId)}, true, NOW(), NOW())
        `;

        const created = await prisma.$queryRaw`
          SELECT * FROM "DiscountList" WHERE id = ${listId}
        ` as any[];

        return NextResponse.json(created[0], { status: 201 });
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
    console.error('Error al crear lista de descuentos:', error);
    return NextResponse.json(
      { error: 'Error al crear lista de descuentos', details: error.message },
      { status: 500 }
    );
  }
}
