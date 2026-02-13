import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { updateWorkStationSchema, validateSafe } from '@/lib/work-stations/validations';

// ============================================================
// GET /api/work-stations/[id] - Obtener puesto de trabajo específico
// ============================================================
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const workStation = await prisma.workStation.findUnique({
      where: { id },
      include: {
        sector: {
          select: {
            id: true,
            name: true
          }
        },
        // ✅ Incluir TODOS los instructivos (para poder gestionar inactivos)
        instructives: {
          include: {
            createdBy: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: [
            { isActive: 'desc' }, // Activos primero
            { createdAt: 'desc' }
          ]
        },
        machines: {
          include: {
            machine: {
              select: {
                id: true,
                name: true,
                nickname: true,
                type: true,
                brand: true,
                model: true,
                status: true,
                photo: true,
                logo: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        components: {
          include: {
            component: {
              select: {
                id: true,
                name: true,
                description: true
              }
            }
          }
        },
        _count: {
          select: {
            workOrders: {
              where: {
                status: { in: ['PENDING', 'IN_PROGRESS'] }
              }
            }
          }
        }
      }
    });

    if (!workStation) {
      return NextResponse.json({ error: 'Puesto de trabajo no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      ...workStation,
      activeWorkOrdersCount: workStation._count.workOrders,
      instructivesCount: workStation.instructives.filter(i => i.isActive).length,
      machinesCount: workStation.machines.length
    });

  } catch (error) {
    console.error('Error obteniendo puesto de trabajo:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ============================================================
// PUT /api/work-stations/[id] - Actualizar puesto de trabajo
// ✅ OPTIMIZADO: Validación Zod, verificación duplicados
// ============================================================
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Validar body
    const body = await request.json();
    const validation = validateSafe(updateWorkStationSchema, body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.errors.join(', ') }, { status: 400 });
    }

    const { name, description, sectorId, status } = validation.data;

    // ✅ OPTIMIZADO: Una sola query para verificar existencia y obtener datos
    const existingWorkStation = await prisma.workStation.findUnique({
      where: { id },
      select: { id: true, companyId: true, name: true, sectorId: true }
    });

    if (!existingWorkStation) {
      return NextResponse.json({ error: 'Puesto de trabajo no encontrado' }, { status: 404 });
    }

    // ✅ Verificar sector si se quiere cambiar
    if (sectorId) {
      const sector = await prisma.sector.findFirst({
        where: {
          id: sectorId,
          companyId: existingWorkStation.companyId
        }
      });

      if (!sector) {
        return NextResponse.json({
          error: 'El sector no pertenece a esta empresa'
        }, { status: 400 });
      }
    }

    // ✅ Verificar duplicado de nombre dentro del sector (excluyendo el actual)
    // Usa el nuevo sectorId si se está cambiando, sino el actual
    const targetSectorId = sectorId || existingWorkStation.sectorId;
    const targetName = name || existingWorkStation.name;

    if (name !== existingWorkStation.name || sectorId !== existingWorkStation.sectorId) {
      const duplicateName = await prisma.workStation.findFirst({
        where: {
          sectorId: targetSectorId,
          name: { equals: targetName, mode: 'insensitive' },
          id: { not: id }
        }
      });

      if (duplicateName) {
        return NextResponse.json({
          error: `Ya existe un puesto de trabajo con el nombre "${targetName}" en este sector`
        }, { status: 400 });
      }
    }

    // Actualizar
    const workStation = await prisma.workStation.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(sectorId && { sectorId }),
        ...(status && { status })
      },
      include: {
        sector: {
          select: {
            id: true,
            name: true
          }
        },
        instructives: {
          where: { isActive: true },
          select: { id: true, title: true }
        },
        machines: {
          include: {
            machine: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    return NextResponse.json({
      workStation,
      message: 'Puesto de trabajo actualizado correctamente'
    });

  } catch (error) {
    console.error('Error actualizando puesto de trabajo:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ============================================================
// DELETE /api/work-stations/[id] - Eliminar puesto de trabajo
// ✅ OPTIMIZADO: Verificación de OTs activas
// ============================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar existencia y OTs activas en una sola query
    const workStation = await prisma.workStation.findUnique({
      where: { id },
      include: {
        workOrders: {
          where: {
            status: { in: ['PENDING', 'IN_PROGRESS'] }
          },
          select: { id: true }
        },
        _count: {
          select: {
            instructives: true,
            machines: true
          }
        }
      }
    });

    if (!workStation) {
      return NextResponse.json({ error: 'Puesto de trabajo no encontrado' }, { status: 404 });
    }

    // Verificar que no tenga órdenes de trabajo activas
    if (workStation.workOrders.length > 0) {
      return NextResponse.json({
        error: `No se puede eliminar. Tiene ${workStation.workOrders.length} orden(es) de trabajo activa(s).`
      }, { status: 400 });
    }

    // ✅ Usar transacción para eliminar todo
    await prisma.$transaction([
      // Eliminar instructivos
      prisma.workStationInstructive.deleteMany({
        where: { workStationId: id }
      }),
      // Eliminar máquinas asignadas
      prisma.workStationMachine.deleteMany({
        where: { workStationId: id }
      }),
      // Eliminar componentes asignados
      prisma.workStationComponent.deleteMany({
        where: { workStationId: id }
      }),
      // Eliminar el puesto
      prisma.workStation.delete({
        where: { id }
      })
    ]);

    return NextResponse.json({
      message: 'Puesto de trabajo eliminado correctamente',
      deletedItems: {
        instructives: workStation._count.instructives,
        machines: workStation._count.machines
      }
    });

  } catch (error) {
    console.error('Error eliminando puesto de trabajo:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
