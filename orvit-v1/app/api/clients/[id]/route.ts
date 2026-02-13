import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper para obtener usuario desde JWT
async function getUserFromToken(request: NextRequest) {
  try {
    const token = cookies().get('token')?.value;
    
    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: {
            company: true
          }
        }
      }
    });

    if (!user || !user.companies || user.companies.length === 0) {
      return null;
    }

    return {
      userId: user.id,
      companyId: user.companies[0].companyId,
    };
  } catch (error) {
    console.error('Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

// GET - Obtener un cliente por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getUserFromToken(request);
    if (!auth || !auth.userId || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyIdNum = Number(auth.companyId);

    // Verificar primero si el modelo existe antes de intentar usarlo
    const hasClientModel = prisma.client && typeof (prisma.client as any).findFirst === 'function';
    
    if (!hasClientModel) {
      // Usar consulta raw
      try {
        const clientsRaw = await prisma.$queryRaw`
          SELECT 
            c.id,
            c."legalName",
            c.name,
            c.email,
            c.phone,
            c."alternatePhone",
            c.address,
            c.city,
            c.province,
            c."postalCode",
            c.cuit,
            c."taxCondition",
            c."creditLimit",
            c."currentBalance",
            c."paymentTerms",
            c."checkTerms",
            c."saleCondition",
            c."contactPerson",
            c."merchandisePendingDays",
            c."grossIncome",
            c."activityStartDate",
            c."sellerId",
            c."isActive",
            c."companyId",
            c.observations,
            c."createdAt",
            c."updatedAt"
          FROM "Client" c
          WHERE c.id = ${params.id}
            AND c."companyId" = ${companyIdNum}
        ` as any[];

        if (!clientsRaw || clientsRaw.length === 0) {
          return NextResponse.json(
            { error: 'Cliente no encontrado' },
            { status: 404 }
          );
        }

        const client = clientsRaw[0];

        // Obtener descuentos y listas de precios
        const discounts = await prisma.$queryRaw`
          SELECT * FROM "ClientDiscount"
          WHERE "clientId" = ${params.id} AND "isActive" = true
          ORDER BY "createdAt" DESC
        ` as any[];

        const priceLists = await prisma.$queryRaw`
          SELECT * FROM "ClientPriceList"
          WHERE "clientId" = ${params.id} AND "isActive" = true
          ORDER BY "isDefault" DESC, "createdAt" DESC
        ` as any[];

        return NextResponse.json({
          ...client,
          discounts: discounts || [],
          priceLists: priceLists || [],
        });
      } catch (rawError: any) {
        if (rawError.code === '42P01' || rawError.message?.includes('does not exist')) {
          return NextResponse.json(
            { error: 'Cliente no encontrado' },
            { status: 404 }
          );
        }
        throw rawError;
      }
    }

    // Intentar usar Prisma Client si está disponible
    try {
      // Verificar nuevamente que el modelo existe antes de usarlo
      if (!prisma.client || typeof (prisma.client as any).findFirst !== 'function') {
        throw new Error('Model Client not available');
      }

      const client = await prisma.client.findFirst({
        where: {
          id: params.id,
          companyId: companyIdNum,
        },
        include: {
          discounts: {
            orderBy: {
              createdAt: 'desc',
            },
          },
          priceLists: {
            orderBy: {
              isDefault: 'desc',
              createdAt: 'desc',
            },
          },
        },
      });

      if (!client) {
        return NextResponse.json(
          { error: 'Cliente no encontrado' },
          { status: 404 }
        );
      }

      return NextResponse.json(client);
    } catch (prismaError: any) {
      // Si falla, usar consulta raw
      if (prismaError.code === 'P2021' || prismaError.message?.includes('does not exist') || 
          prismaError.message?.includes('Unknown model') ||
          prismaError.message?.includes('model Client')) {
        try {
          const clientsRaw = await prisma.$queryRaw`
            SELECT 
              c.id,
              c."legalName",
              c.name,
              c.email,
              c.phone,
              c."alternatePhone",
              c.address,
              c.city,
              c.province,
              c."postalCode",
              c.cuit,
              c."taxCondition",
              c."creditLimit",
              c."currentBalance",
              c."paymentTerms",
              c."checkTerms",
              c."saleCondition",
              c."contactPerson",
              c."merchandisePendingDays",
              c."grossIncome",
              c."activityStartDate",
              c."sellerId",
              c."isActive",
              c."companyId",
              c.observations,
              c."createdAt",
              c."updatedAt"
            FROM "Client" c
            WHERE c.id = ${params.id}
              AND c."companyId" = ${companyIdNum}
          ` as any[];

          if (!clientsRaw || clientsRaw.length === 0) {
            return NextResponse.json(
              { error: 'Cliente no encontrado' },
              { status: 404 }
            );
          }

          const client = clientsRaw[0];

          const discounts = await prisma.$queryRaw`
            SELECT * FROM "ClientDiscount"
            WHERE "clientId" = ${params.id} AND "isActive" = true
            ORDER BY "createdAt" DESC
          ` as any[];

          const priceLists = await prisma.$queryRaw`
            SELECT * FROM "ClientPriceList"
            WHERE "clientId" = ${params.id} AND "isActive" = true
            ORDER BY "isDefault" DESC, "createdAt" DESC
          ` as any[];

          return NextResponse.json({
            ...client,
            discounts: discounts || [],
            priceLists: priceLists || [],
          });
        } catch (rawError: any) {
          if (rawError.code === '42P01' || rawError.message?.includes('does not exist')) {
            return NextResponse.json(
              { error: 'Cliente no encontrado' },
              { status: 404 }
            );
          }
          throw rawError;
        }
      }
      throw prismaError;
    }
  } catch (error: any) {
    console.error('Error al obtener cliente:', error);
    return NextResponse.json(
      { error: 'Error al obtener cliente', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Actualizar un cliente
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getUserFromToken(request);
    if (!auth || !auth.userId || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { name, email, phone, address, cuit, taxCondition, creditLimit, paymentTerms, observations, isActive } = body;

    // Verificar que el cliente existe y pertenece a la empresa
    const existingClient = await prisma.client.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
    });

    if (!existingClient) {
      return NextResponse.json(
        { error: 'Cliente no encontrado' },
        { status: 404 }
      );
    }

    // Si se cambia el email, verificar que no exista otro cliente con ese email
    if (email && email !== existingClient.email) {
      const emailExists = await prisma.client.findFirst({
        where: {
          email: email.toLowerCase().trim(),
          companyId: auth.companyId,
          id: { not: params.id },
        },
      });

      if (emailExists) {
        return NextResponse.json(
          { error: 'Ya existe otro cliente con ese email' },
          { status: 409 }
        );
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (email !== undefined) updateData.email = email.toLowerCase().trim();
    if (phone !== undefined) updateData.phone = phone.trim();
    if (address !== undefined) updateData.address = address.trim();
    if (cuit !== undefined) updateData.cuit = cuit?.trim() || null;
    if (taxCondition !== undefined) updateData.taxCondition = taxCondition;
    if (creditLimit !== undefined) updateData.creditLimit = creditLimit ? parseFloat(creditLimit) : null;
    if (paymentTerms !== undefined) updateData.paymentTerms = parseInt(paymentTerms);
    if (observations !== undefined) updateData.observations = observations?.trim() || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const client = await prisma.client.update({
      where: {
        id: params.id,
      },
      data: updateData,
      include: {
        discounts: true,
        priceLists: true,
      },
    });

    return NextResponse.json(client);
  } catch (error: any) {
    console.error('Error al actualizar cliente:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Ya existe otro cliente con ese email' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Error al actualizar cliente' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar (desactivar) un cliente
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getUserFromToken(request);
    if (!auth || !auth.userId || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const client = await prisma.client.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Cliente no encontrado' },
        { status: 404 }
      );
    }

    // Soft delete: marcar como inactivo
    await prisma.client.update({
      where: {
        id: params.id,
      },
      data: {
        isActive: false,
      },
    });

    return NextResponse.json({ message: 'Cliente eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar cliente:', error);
    return NextResponse.json(
      { error: 'Error al eliminar cliente' },
      { status: 500 }
    );
  }
}

