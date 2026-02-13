import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

export const dynamic = 'force-dynamic';

// Crear un nuevo alias para un SupplierItem
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    const companyId = payload.companyId as number;
    if (!companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const body = await req.json();
    const { supplierItemId, alias, codigoProveedor } = body;

    if (!supplierItemId || !alias) {
      return NextResponse.json(
        { error: 'supplierItemId y alias son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el supplierItem existe y pertenece a la company
    const supplierItem = await prisma.supplierItem.findFirst({
      where: {
        id: supplierItemId,
        companyId,
      },
    });

    if (!supplierItem) {
      return NextResponse.json(
        { error: 'SupplierItem no encontrado' },
        { status: 404 }
      );
    }

    // Verificar si ya existe un alias igual
    const existingAlias = await prisma.supplierItemAlias.findFirst({
      where: {
        supplierItemId,
        alias: {
          equals: alias,
          mode: 'insensitive',
        },
      },
    });

    if (existingAlias) {
      // Incrementar contador de uso
      await prisma.supplierItemAlias.update({
        where: { id: existingAlias.id },
        data: { vecesUsado: { increment: 1 } },
      });

      return NextResponse.json({
        success: true,
        alias: existingAlias,
        message: 'Alias ya existía, se incrementó el contador de uso',
      });
    }

    // Crear nuevo alias
    const newAlias = await prisma.supplierItemAlias.create({
      data: {
        supplierItemId,
        alias: alias.trim(),
        codigoProveedor: codigoProveedor?.trim() || null,
        esNombreFactura: true,
        confianza: 100,
        vecesUsado: 1,
        companyId,
      },
    });

    return NextResponse.json({
      success: true,
      alias: newAlias,
      message: 'Alias creado correctamente',
    });
  } catch (error: any) {
    console.error('Error creating alias:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear alias' },
      { status: 500 }
    );
  }
}

// Obtener todos los aliases de un SupplierItem
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = session.user.companyId;
    const { searchParams } = new URL(req.url);
    const supplierItemId = searchParams.get('supplierItemId');
    const supplierId = searchParams.get('supplierId');

    if (supplierItemId) {
      const aliases = await prisma.supplierItemAlias.findMany({
        where: {
          supplierItemId: parseInt(supplierItemId),
          companyId,
        },
        orderBy: { vecesUsado: 'desc' },
      });

      return NextResponse.json({ aliases });
    }

    if (supplierId) {
      // Obtener todos los aliases de items de un proveedor
      const aliases = await prisma.supplierItemAlias.findMany({
        where: {
          companyId,
          supplierItem: {
            supplierId: parseInt(supplierId),
          },
        },
        include: {
          supplierItem: {
            include: {
              supply: true,
            },
          },
        },
        orderBy: { vecesUsado: 'desc' },
      });

      return NextResponse.json({ aliases });
    }

    return NextResponse.json(
      { error: 'supplierItemId o supplierId es requerido' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error getting aliases:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener aliases' },
      { status: 500 }
    );
  }
}

// Eliminar un alias
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = session.user.companyId;
    const { searchParams } = new URL(req.url);
    const aliasId = searchParams.get('id');

    if (!aliasId) {
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
    }

    // Verificar que el alias pertenece a la company
    const alias = await prisma.supplierItemAlias.findFirst({
      where: {
        id: parseInt(aliasId),
        companyId,
      },
    });

    if (!alias) {
      return NextResponse.json({ error: 'Alias no encontrado' }, { status: 404 });
    }

    await prisma.supplierItemAlias.delete({
      where: { id: parseInt(aliasId) },
    });

    return NextResponse.json({
      success: true,
      message: 'Alias eliminado correctamente',
    });
  } catch (error: any) {
    console.error('Error deleting alias:', error);
    return NextResponse.json(
      { error: error.message || 'Error al eliminar alias' },
      { status: 500 }
    );
  }
}
