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

// GET - Obtener todos los tipos de clientes de la empresa
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserFromToken(request);
    if (!auth || !auth.userId || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || auth.companyId.toString();

    try {
      // Intentar usar Prisma primero
      const clientTypes = await (prisma as any).clientType.findMany({
        where: {
          companyId: parseInt(companyId),
          isActive: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      return NextResponse.json(clientTypes || []);
    } catch (error: any) {
      // Si la tabla no existe o el modelo no está disponible, usar raw SQL
      if (error.code === 'P2021' || 
          error.message?.includes('does not exist') || 
          error.message?.includes('Unknown model') || 
          error.message?.includes('clientType is not a function') ||
          error.message?.includes('Cannot read properties of undefined')) {
        console.log('Tabla ClientType no existe, devolviendo array vacío');
        try {
          const clientTypesRaw = await prisma.$queryRaw`
            SELECT id, name, description, "companyId", "isActive", "createdAt", "updatedAt"
            FROM "ClientType"
            WHERE "companyId" = ${parseInt(companyId)} AND "isActive" = true
            ORDER BY name ASC
          ` as any[];
          return NextResponse.json(clientTypesRaw || []);
        } catch (rawError: any) {
          if (rawError.code === '42P01' || rawError.message?.includes('does not exist')) {
            return NextResponse.json([]);
          }
          throw rawError;
        }
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error al obtener tipos de clientes:', error);
    return NextResponse.json([]);
  }
}

// POST - Crear un nuevo tipo de cliente
export async function POST(request: NextRequest) {
  try {
    const auth = await getUserFromToken(request);
    if (!auth || !auth.userId || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      );
    }

    try {
      // Intentar usar Prisma primero
      const clientType = await (prisma as any).clientType.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          companyId: auth.companyId,
        },
      });

      return NextResponse.json(clientType, { status: 201 });
    } catch (error: any) {
      // Si el modelo no está disponible, usar consulta raw
      if (error.message?.includes('Unknown model') || 
          error.message?.includes('clientType is not a function') ||
          error.message?.includes('Cannot read properties of undefined')) {
        const cuid = () => {
          const timestamp = Date.now().toString(36);
          const random = Math.random().toString(36).substring(2, 15);
          return `ct${timestamp}${random}`;
        };
        const clientTypeId = cuid();
        
        await prisma.$executeRaw`
          INSERT INTO "ClientType" (
            id, name, description, "companyId", "isActive", "createdAt", "updatedAt"
          ) VALUES (
            ${clientTypeId},
            ${name.trim()},
            ${description?.trim() || null},
            ${auth.companyId},
            true,
            NOW(),
            NOW()
          )
        `;

        const created = await prisma.$queryRaw`
          SELECT * FROM "ClientType" WHERE id = ${clientTypeId}
        ` as any[];

        return NextResponse.json(created[0], { status: 201 });
      }
      
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'Ya existe un tipo de cliente con ese nombre en la empresa' },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error al crear tipo de cliente:', error);
    return NextResponse.json(
      { error: 'Error al crear tipo de cliente', details: error.message },
      { status: 500 }
    );
  }
}

