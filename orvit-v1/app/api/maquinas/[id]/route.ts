import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deleteEntityFiles, deleteMultipleEntityFiles, deleteS3File } from '@/lib/s3-utils';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const machine = await prisma.machine.findUnique({ where: { id: Number(id) } });
  if (!machine) {
    return NextResponse.json({ error: "Máquina no encontrada." }, { status: 404 });
  }
  // (Opcional) Si se desean adjuntos, se pueden cargar (por ejemplo, desde un modelo Attachment) y agregar a la respuesta.
  // Por ahora, se devuelve la máquina sin attachments.
  return NextResponse.json(machine);
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ error: 'ID de máquina inválido' }, { status: 400 });
  }
  const body = await request.json();
  console.log('PUT /api/maquinas/[slug] - body recibido:', body);
  
  // Validaciones
  if (!body.name || !body.type || !body.brand || !body.status || !body.acquisitionDate || !body.companyId || !body.sectorId) {
    return NextResponse.json({ error: 'Campos requeridos: name, type, brand, status, acquisitionDate, companyId, sectorId' }, { status: 400 });
  }
  const parsedDate = new Date(body.acquisitionDate);
  console.log('PUT /api/maquinas/[slug] - acquisitionDate recibido:', body.acquisitionDate, 'parsedDate:', parsedDate);
  if (isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: 'La fecha de alta es inválida' }, { status: 400 });
  }
  if (isNaN(Number(body.companyId)) || isNaN(Number(body.sectorId))) {
    return NextResponse.json({ error: 'Empresa y sector deben ser números válidos' }, { status: 400 });
  }
  
  try {
    // Obtener la máquina actual para verificar cambios
    const currentMachine = await prisma.machine.findUnique({
      where: { id: Number(id) },
      select: {
        logo: true,
        name: true,
        nickname: true,
        aliases: true
      }
    });

    if (!currentMachine) {
      return NextResponse.json({ error: 'Máquina no encontrada' }, { status: 404 });
    }

    // Si se proporciona plantZoneId, validar que existe y pertenece al sector
    if (body.plantZoneId !== undefined && body.plantZoneId !== null && body.plantZoneId !== '') {
      const zone = await prisma.plantZone.findFirst({
        where: {
          id: Number(body.plantZoneId),
          sectorId: Number(body.sectorId),
          companyId: Number(body.companyId)
        }
      });
      if (!zone) {
        return NextResponse.json({
          error: 'La zona de planta no existe o no pertenece al sector especificado'
        }, { status: 400 });
      }
    }

    // Actualizar la máquina
    const updated = await prisma.machine.update({
      where: { id: Number(id) },
      data: {
        name: body.name,
        nickname: body.nickname,
        aliases: body.aliases !== undefined ? (body.aliases || null) : undefined,
        type: body.type,
        brand: body.brand,
        model: body.model,
        serialNumber: body.serialNumber,
        status: body.status,
        acquisitionDate: parsedDate,
        companyId: Number(body.companyId),
        sectorId: Number(body.sectorId),
        plantZoneId: body.plantZoneId !== undefined
          ? (body.plantZoneId === null || body.plantZoneId === '' ? null : Number(body.plantZoneId))
          : undefined,
        logo: body.logo,
      },
      include: {
        plantZone: {
          select: {
            id: true,
            name: true,
            color: true
          }
        }
      }
    });

    // Eliminar logo anterior de S3 si se eliminó o reemplazó
    if (currentMachine.logo && body.logo !== undefined) {
      const isDeleting = body.logo === null || body.logo === '';
      const isReplacing = !isDeleting && body.logo !== currentMachine.logo;
      
      if (isDeleting || isReplacing) {
        try {
          await deleteS3File(currentMachine.logo);
          console.log(`✅ Logo anterior eliminado de S3: ${currentMachine.logo}`);
        } catch (error) {
          console.error('⚠️ Error eliminando logo anterior de S3:', error);
          // No fallar la operación si falla la eliminación de S3
        }
      }
    }

    console.log('PUT /api/maquinas/[slug] - máquina actualizada:', updated);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT /api/maquinas/[slug] - error:', error);
    return NextResponse.json({ error: 'Error al actualizar máquina', details: error }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const machineId = Number(id);

  if (isNaN(machineId)) {
    return NextResponse.json({ error: 'ID de máquina inválido' }, { status: 400 });
  }

  try {
    // ✅ OPTIMIZADO: Query simple en lugar de includes anidados de 4 niveles
    // Verificar máquina y obtener IDs de componentes en paralelo
    const [machine, componentIds] = await Promise.all([
      prisma.machine.findUnique({
        where: { id: machineId },
        select: { id: true }
      }),
      // Obtener TODOS los IDs de componentes de la máquina (query plana, sin recursión)
      prisma.component.findMany({
        where: { machineId },
        select: { id: true }
      })
    ]);

    if (!machine) {
      return NextResponse.json({ error: "Máquina no encontrada." }, { status: 404 });
    }

    const allComponentIds = componentIds.map(c => c.id);
    console.log(`Eliminando máquina ${id} con ${allComponentIds.length} componentes`);

    // Preparar entidades para eliminar archivos de S3
    const entitiesToDelete = [
      { type: 'machine', id: id },
      ...allComponentIds.map(componentId => ({ type: 'component', id: componentId.toString() }))
    ];

    // Eliminar archivos de S3 en paralelo con la eliminación de la base de datos
    const [dbResult, s3Result] = await Promise.allSettled([
      // Eliminar de la base de datos (cascada automática)
      prisma.machine.delete({ where: { id: machineId } }),
      // Eliminar archivos de S3
      deleteMultipleEntityFiles(entitiesToDelete)
    ]);

    if (dbResult.status === 'rejected') {
      console.error('Error eliminando máquina de la base de datos:', dbResult.reason);
      return NextResponse.json({
        error: "Error al eliminar máquina de la base de datos",
        details: dbResult.reason
      }, { status: 500 });
    }

    if (s3Result.status === 'rejected') {
      console.error('Error eliminando archivos de S3:', s3Result.reason);
      // No fallar la operación por errores de S3, solo logear
    }

    console.log(`Máquina ${id} eliminada exitosamente`);
    return new NextResponse(null, { status: 204 });

  } catch (error) {
    console.error('Error eliminando máquina:', error);
    return NextResponse.json({
      error: "Error al eliminar máquina",
      details: error
    }, { status: 500 });
  }
} 