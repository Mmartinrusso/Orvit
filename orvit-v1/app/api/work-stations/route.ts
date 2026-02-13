import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import {
  createWorkStationSchema,
  listWorkStationsSchema,
  validateSafe
} from '@/lib/work-stations/validations';

export const dynamic = 'force-dynamic';

// ============================================================
// GET /api/work-stations - Listar puestos de trabajo
// ✅ OPTIMIZADO: Incluye instructives, machines y counts en una sola query
// ============================================================
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const token = cookies().get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Validar parámetros
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());

    const validation = validateSafe(listWorkStationsSchema, params);
    if (!validation.success) {
      return NextResponse.json({ error: validation.errors.join(', ') }, { status: 400 });
    }

    const { companyId, sectorId, status, search, hasInstructives, hasMachines, sortBy } = validation.data;

    // Construir filtros base
    const where: any = { companyId };

    if (sectorId) {
      where.sectorId = sectorId;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    // ✅ OPTIMIZADO: Una sola query con todos los datos necesarios
    const workStations = await prisma.workStation.findMany({
      where,
      include: {
        sector: {
          select: {
            id: true,
            name: true
          }
        },
        // ✅ Incluir instructivos (activos e inactivos para conteo)
        instructives: {
          select: {
            id: true,
            title: true,
            fileName: true,
            fileType: true,
            isActive: true,
            scope: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' }
        },
        // ✅ Incluir máquinas asignadas
        machines: {
          select: {
            id: true,
            isRequired: true,
            notes: true,
            machine: {
              select: {
                id: true,
                name: true,
                nickname: true,
                type: true,
                brand: true,
                model: true,
                status: true,
                photo: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        // ✅ Contar OTs activas
        _count: {
          select: {
            workOrders: {
              where: {
                status: { in: ['PENDING', 'IN_PROGRESS'] }
              }
            }
          }
        }
      },
      orderBy: getOrderBy(sortBy)
    });

    // ✅ Filtrar por hasInstructives/hasMachines en memoria (más eficiente que subqueries)
    let filteredWorkStations = workStations;

    if (hasInstructives && hasInstructives !== 'all') {
      filteredWorkStations = filteredWorkStations.filter(ws => {
        const activeCount = ws.instructives.filter(i => i.isActive).length;
        return hasInstructives === 'yes' ? activeCount > 0 : activeCount === 0;
      });
    }

    if (hasMachines && hasMachines !== 'all') {
      filteredWorkStations = filteredWorkStations.filter(ws => {
        return hasMachines === 'yes' ? ws.machines.length > 0 : ws.machines.length === 0;
      });
    }

    // ✅ Transformar respuesta con counts
    const response = filteredWorkStations.map(ws => ({
      ...ws,
      instructivesCount: ws.instructives.filter(i => i.isActive).length,
      machinesCount: ws.machines.length,
      activeWorkOrdersCount: ws._count.workOrders,
      // Solo incluir instructivos activos en la respuesta (para UI)
      instructives: ws.instructives.filter(i => i.isActive)
    }));

    return NextResponse.json({
      workStations: response,
      total: response.length
    });

  } catch (error) {
    console.error('Error obteniendo puestos de trabajo:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ============================================================
// POST /api/work-stations - Crear puesto de trabajo
// ✅ OPTIMIZADO: Validación Zod, código legible, verificación duplicados
// ============================================================
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const token = cookies().get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Validar body
    const body = await request.json();
    const validation = validateSafe(createWorkStationSchema, body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.errors.join(', ') }, { status: 400 });
    }

    const { name, description, sectorId, companyId, status } = validation.data;

    // ✅ Verificar duplicados (nombre único por sector, no por empresa)
    const existingByName = await prisma.workStation.findFirst({
      where: {
        sectorId,
        name: { equals: name, mode: 'insensitive' }
      }
    });

    if (existingByName) {
      return NextResponse.json({
        error: `Ya existe un puesto de trabajo con el nombre "${name}" en este sector`
      }, { status: 400 });
    }

    // ✅ Verificar que el sector pertenezca a la empresa
    const sector = await prisma.sector.findFirst({
      where: {
        id: sectorId,
        companyId
      }
    });

    if (!sector) {
      return NextResponse.json({
        error: 'El sector no pertenece a esta empresa'
      }, { status: 400 });
    }

    // ✅ Generar código legible (PT-001, PT-002, etc.)
    const code = await generateWorkStationCode(companyId);

    // Crear el puesto de trabajo
    const workStation = await prisma.workStation.create({
      data: {
        name,
        description,
        code,
        status: status || 'ACTIVE',
        sectorId,
        companyId
      },
      include: {
        sector: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return NextResponse.json({
      workStation,
      message: 'Puesto de trabajo creado correctamente'
    }, { status: 201 });

  } catch (error) {
    console.error('Error creando puesto de trabajo:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ============================================================
// HELPERS
// ============================================================

function getOrderBy(sortBy?: string) {
  switch (sortBy) {
    case 'name-asc':
      return [{ name: 'asc' as const }];
    case 'name-desc':
      return [{ name: 'desc' as const }];
    case 'date':
      return [{ createdAt: 'desc' as const }];
    default:
      return [{ name: 'asc' as const }];
  }
}

/**
 * Genera código legible para puestos de trabajo
 * Formato: PT-001, PT-002, etc.
 */
async function generateWorkStationCode(companyId: number): Promise<string> {
  const lastWorkStation = await prisma.workStation.findFirst({
    where: { companyId },
    orderBy: { id: 'desc' },
    select: { code: true }
  });

  let nextNumber = 1;

  if (lastWorkStation?.code) {
    // Extraer número del código existente (PT-XXX)
    const match = lastWorkStation.code.match(/PT-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1]) + 1;
    }
  }

  // Formatear con ceros a la izquierda
  return `PT-${nextNumber.toString().padStart(3, '0')}`;
}
