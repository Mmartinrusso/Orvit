import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { batchUpdateSchema, batchDeleteSchema, validateSafe } from '@/lib/work-stations/validations';

// ============================================================
// PUT /api/work-stations/batch - Actualizar múltiples puestos
// ============================================================
export async function PUT(request: NextRequest) {
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
    const validation = validateSafe(batchUpdateSchema, body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.errors.join(', ') }, { status: 400 });
    }

    const { ids, data } = validation.data;

    // Verificar que todos los puestos existen
    const existingCount = await prisma.workStation.count({
      where: { id: { in: ids } }
    });

    if (existingCount !== ids.length) {
      return NextResponse.json({
        error: `Solo se encontraron ${existingCount} de ${ids.length} puestos`
      }, { status: 400 });
    }

    // Si se quiere cambiar el sector, verificar que pertenezca a la empresa
    if (data.sectorId) {
      // Obtener la empresa del primer puesto
      const firstWorkStation = await prisma.workStation.findFirst({
        where: { id: { in: ids } },
        select: { companyId: true }
      });

      if (firstWorkStation) {
        const sector = await prisma.sector.findFirst({
          where: {
            id: data.sectorId,
            companyId: firstWorkStation.companyId
          }
        });

        if (!sector) {
          return NextResponse.json({
            error: 'El sector no pertenece a esta empresa'
          }, { status: 400 });
        }
      }
    }

    // Actualizar todos
    const result = await prisma.workStation.updateMany({
      where: { id: { in: ids } },
      data: {
        ...(data.status && { status: data.status }),
        ...(data.sectorId && { sectorId: data.sectorId })
      }
    });

    return NextResponse.json({
      message: `${result.count} puesto(s) actualizado(s) correctamente`,
      updated: result.count
    });

  } catch (error) {
    console.error('Error en batch update:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ============================================================
// DELETE /api/work-stations/batch - Eliminar múltiples puestos
// ============================================================
export async function DELETE(request: NextRequest) {
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
    const validation = validateSafe(batchDeleteSchema, body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.errors.join(', ') }, { status: 400 });
    }

    const { ids } = validation.data;

    // Verificar que ninguno tenga OTs activas
    const withActiveOrders = await prisma.workStation.findMany({
      where: {
        id: { in: ids },
        workOrders: {
          some: {
            status: { in: ['PENDING', 'IN_PROGRESS'] }
          }
        }
      },
      select: { id: true, name: true }
    });

    if (withActiveOrders.length > 0) {
      const names = withActiveOrders.map(ws => ws.name).join(', ');
      return NextResponse.json({
        error: `No se pueden eliminar los siguientes puestos porque tienen OTs activas: ${names}`,
        blocked: withActiveOrders.map(ws => ws.id)
      }, { status: 400 });
    }

    // Eliminar en transacción
    const result = await prisma.$transaction([
      // Eliminar instructivos
      prisma.workStationInstructive.deleteMany({
        where: { workStationId: { in: ids } }
      }),
      // Eliminar máquinas asignadas
      prisma.workStationMachine.deleteMany({
        where: { workStationId: { in: ids } }
      }),
      // Eliminar componentes asignados
      prisma.workStationComponent.deleteMany({
        where: { workStationId: { in: ids } }
      }),
      // Eliminar puestos
      prisma.workStation.deleteMany({
        where: { id: { in: ids } }
      })
    ]);

    return NextResponse.json({
      message: `${result[3].count} puesto(s) eliminado(s) correctamente`,
      deleted: result[3].count,
      deletedInstructives: result[0].count,
      deletedMachines: result[1].count
    });

  } catch (error) {
    console.error('Error en batch delete:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
