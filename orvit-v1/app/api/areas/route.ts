import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cached, invalidateCache } from '@/lib/cache/cache-manager';
import { areaKeys, TTL } from '@/lib/cache/cache-keys';
import { validateRequest } from '@/lib/validations/helpers';
import { CreateAreaSchema } from '@/lib/validations/areas';

export const dynamic = 'force-dynamic';

// GET /api/areas?companyId=123 - Obtener áreas reales de la base de datos
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return new NextResponse('ID de empresa requerido', { status: 400 });
    }

    const companyIdNum = parseInt(companyId);
    const cacheKey = areaKeys.list(companyIdNum);

    const areas = await cached(cacheKey, async () => {
      const result = await prisma.area.findMany({
        where: { companyId: companyIdNum },
        select: {
          id: true,
          name: true,
          icon: true,
          logo: true,
          companyId: true,
        },
        orderBy: { name: 'asc' },
        take: 100
      });

      // Si no hay áreas, crear las áreas del sistema automáticamente
      if (result.length === 0) {
        console.log('No hay áreas, creando áreas del sistema...');
        const SYSTEM_AREAS = [
          { name: "Administración", icon: "users" },
          { name: "Mantenimiento", icon: "wrench" },
          { name: "Producción", icon: "settings" }
        ];

        const createdAreas = [];
        for (const areaData of SYSTEM_AREAS) {
          try {
            const newArea = await prisma.area.create({
              data: {
                name: areaData.name,
                icon: areaData.icon,
                companyId: companyIdNum,
              },
            });
            createdAreas.push(newArea);
          } catch (error) {
            console.error(`Error creando área ${areaData.name}:`, error);
          }
        }
        return createdAreas;
      }

      return result;
    }, TTL.MEDIUM);

    return NextResponse.json(areas, {
      headers: { 'Cache-Control': 'public, max-age=300' }
    });
  } catch (error) {
    console.error('Error al obtener áreas:', error);
    return new NextResponse('Error interno del servidor', { status: 500 });
  }
}

// POST /api/areas - Crear área en la base de datos
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = validateRequest(CreateAreaSchema, body);
    if (!validation.success) return validation.response;

    const { name, companyId, icon, logo } = validation.data;

    const companyIdNum = companyId;

    // Verificar si ya existe
    const existingArea = await prisma.area.findFirst({
      where: { name, companyId: companyIdNum },
    });

    if (existingArea) {
      return NextResponse.json(existingArea);
    }

    // Crear nueva área
    const newArea = await prisma.area.create({
      data: {
        name,
        icon: icon || (name === 'Administración' ? 'users' : name === 'Mantenimiento' ? 'wrench' : 'settings'),
        logo: logo || null,
        companyId: companyIdNum,
      },
    });

    // Invalidar caché de áreas para esta empresa
    await invalidateCache([areaKeys.list(companyIdNum)]);

    return NextResponse.json(newArea, {
      headers: { 'Cache-Control': 'no-cache' }
    });
  } catch (error) {
    console.error('Error al crear área:', error);
    return new NextResponse('Error interno del servidor', { status: 500 });
  }
}

 