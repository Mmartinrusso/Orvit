import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { JWT_SECRET } from '@/lib/auth';
import { cached, invalidateCache } from '@/lib/cache/cache-manager';
import { sectorKeys, TTL } from '@/lib/cache/cache-keys';
import { validateRequest } from '@/lib/validations/helpers';
import { CreateSectorSchema } from '@/lib/validations/sectors';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserIdFromToken() {
  const token = cookies().get('token')?.value;
  if (!token) throw new Error('No token provided');
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return payload.userId as number;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

// GET /api/sectores?areaId=123 o ?companyId=1 o ?forProduction=true&companyId=1
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const areaId = searchParams.get('areaId');
  const companyId = searchParams.get('companyId');
  const forProduction = searchParams.get('forProduction');

  try {
    let whereClause: any = {};
    let cacheKey: string;

    // Determinar filtro y clave de caché
    if (forProduction === 'true' && companyId) {
      whereClause.companyId = Number(companyId);
      whereClause.enabledForProduction = true;
      cacheKey = sectorKeys.forProduction(companyId);
    } else if (areaId) {
      whereClause.areaId = Number(areaId);
      cacheKey = sectorKeys.byArea(areaId);
    } else if (companyId) {
      whereClause.companyId = Number(companyId);
      cacheKey = sectorKeys.byArea(`company-${companyId}`);
    } else {
      return NextResponse.json({ error: 'areaId o companyId es requerido' }, { status: 400 });
    }

    const sectors = await cached(cacheKey, async () => {
      return prisma.sector.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          description: true,
          areaId: true,
          companyId: true,
          imageUrl: true,
          enabledForProduction: true,
          area: {
            select: {
              id: true,
              name: true,
              icon: true,
              logo: true,
              companyId: true,
            }
          }
        },
        orderBy: { name: 'asc' },
        take: 200
      });
    }, TTL.MEDIUM);

    return NextResponse.json(sectors, {
      headers: { 'Cache-Control': 'public, max-age=300' }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener sectores' }, { status: 500 });
  }
}

// Helper para verificar permisos
async function checkUserPermission(userId: number, userRole: string, companyId: number, permission: string): Promise<boolean> {
  try {
    // 1. Verificar permisos específicos del usuario primero
    const userPermission = await prisma.userPermission.findFirst({
      where: {
        userId: userId,
        permission: {
          name: permission,
          isActive: true
        },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        permission: true
      }
    });

    if (userPermission) {
      return userPermission.isGranted;
    }

    // 2. Verificar permisos del rol
    const rolePermission = await prisma.rolePermission.findFirst({
      where: {
        role: {
          name: userRole,
          companyId: companyId
        },
        permission: {
          name: permission,
          isActive: true
        },
        isGranted: true
      },
      include: {
        permission: true,
        role: true
      }
    });

    if (rolePermission) {
      return true;
    }

    return false;
  } catch (error) {
    return false;
  }
}

// POST /api/sectors
export async function POST(request: Request) {
  try {
    const userId = await getUserIdFromToken();
    const body = await request.json();
    const validation = validateRequest(CreateSectorSchema, body);
    if (!validation.success) return validation.response;

    const { name, description, areaId, imageUrl } = validation.data;

    // Obtener el área para obtener el companyId
    const area = await prisma.area.findUnique({
      where: { id: areaId },
      select: { companyId: true }
    });
    
    if (!area) {
      return NextResponse.json({ error: 'Área no encontrada' }, { status: 404 });
    }

    // Obtener el rol del usuario en la empresa
    const userOnCompany = await prisma.userOnCompany.findFirst({
      where: {
        userId: userId,
        companyId: area.companyId
      },
      include: {
        role: true
      }
    });

    if (!userOnCompany || !userOnCompany.role) {
      return NextResponse.json({ error: 'No tienes acceso a esta empresa' }, { status: 403 });
    }

    // Verificar permiso para crear sectores
    const hasPermission = await checkUserPermission(
      userId,
      userOnCompany.role.name,
      area.companyId,
      'sectors.create'
    );

    if (!hasPermission) {
      return NextResponse.json({ error: 'No tienes permisos para crear sectores' }, { status: 403 });
    }
    
    const newSector = await prisma.sector.create({
      data: {
        name,
        description: description || undefined,
        imageUrl: imageUrl || undefined,
        areaId,
        companyId: area.companyId, // Asignar el companyId del área
      },
      select: {
        id: true,
        name: true,
        description: true,
        // imageUrl: true, // Temporalmente comentado
        areaId: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
        area: {
          select: {
            id: true,
            name: true,
            icon: true,
            logo: true,
            companyId: true,
            createdAt: true,
            updatedAt: true,
          }
        }
      }
    });
    
    // Obtener imageUrl manualmente
    const imageUrlResult = await prisma.$queryRaw<Array<{ imageUrl: string | null }>>`
      SELECT "imageUrl" FROM "Sector" WHERE id = ${newSector.id}
    `;
    const finalSector = {
      ...newSector,
      imageUrl: imageUrlResult[0]?.imageUrl || null
    };
    
    // Invalidar caché de sectores
    await invalidateCache([
      sectorKeys.byArea(areaId),
      sectorKeys.byArea(`company-${area.companyId}`),
      sectorKeys.forProduction(area.companyId),
    ]);

    return NextResponse.json(finalSector, {
      status: 201,
      headers: { 'Cache-Control': 'no-cache' }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Error al crear sector', detalle: String(error) }, { status: 500 });
  }
} 