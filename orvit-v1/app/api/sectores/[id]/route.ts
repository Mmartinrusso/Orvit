import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { deleteS3File } from '@/lib/s3-utils';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret
import { requirePermission } from '@/lib/auth/shared-helpers';

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

// PUT /api/sectores/[id]
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar permiso sectors.edit
    const { user: authUser, error: authError } = await requirePermission('sectors.edit');
    if (authError) return authError;

    const userId = await getUserIdFromToken();
    const body = await request.json();
    const {
      name,
      description,
      imageUrl,
      enabledForProduction,
      // Discord webhooks
      discordFallasWebhook,
      discordPreventivosWebhook,
      discordOrdenesTrabajoWebhook,
      discordResumenDiaWebhook
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'El nombre del sector es requerido' },
        { status: 400 }
      );
    }

    // Verificar si el sector existe y pertenece a una empresa del usuario
    const existingSector = await prisma.sector.findFirst({
      where: { 
        id: Number(params.id),
        area: {
          company: {
            users: {
              some: {
                userId: userId
              }
            }
          }
        }
      },
      include: {
        area: {
          include: {
            company: true
          }
        }
      }
    });

    if (!existingSector) {
      return NextResponse.json(
        { error: 'Sector no encontrado o no tienes permisos para editarlo' },
        { status: 404 }
      );
    }

    // Obtener la URL anterior para eliminarla de S3 si es necesario
    let oldImageUrl: string | null = null;
    if (imageUrl !== undefined) {
      try {
        const oldSector = await prisma.$queryRaw<Array<{ imageUrl: string | null }>>`
          SELECT "imageUrl" FROM "Sector" WHERE id = ${Number(params.id)}
        `;
        oldImageUrl = oldSector[0]?.imageUrl || null;
      } catch (e) {
        console.error('Error obteniendo imageUrl anterior:', e);
      }
    }

    const updatedSector = await prisma.sector.update({
      where: { id: Number(params.id) },
      data: {
        name,
        description: description || null,
        imageUrl: imageUrl !== undefined ? (imageUrl || null) : undefined,
        enabledForProduction: enabledForProduction !== undefined ? enabledForProduction : undefined,
        // Discord webhooks
        discordFallasWebhook: discordFallasWebhook !== undefined ? (discordFallasWebhook || null) : undefined,
        discordPreventivosWebhook: discordPreventivosWebhook !== undefined ? (discordPreventivosWebhook || null) : undefined,
        discordOrdenesTrabajoWebhook: discordOrdenesTrabajoWebhook !== undefined ? (discordOrdenesTrabajoWebhook || null) : undefined,
        discordResumenDiaWebhook: discordResumenDiaWebhook !== undefined ? (discordResumenDiaWebhook || null) : undefined,
      },
      include: {
        area: {
          include: {
            company: true
          }
        }
      }
    });

    // Eliminar la foto anterior de S3 si:
    // 1. Se está eliminando la foto (imageUrl es null o vacío) Y había una foto anterior
    // 2. Se está reemplazando la foto (imageUrl tiene un valor nuevo) Y había una foto anterior diferente
    if (oldImageUrl && imageUrl !== undefined) {
      const isDeleting = imageUrl === null || imageUrl === '';
      const isReplacing = !isDeleting && imageUrl !== oldImageUrl;
      
      if (isDeleting || isReplacing) {
        try {
          await deleteS3File(oldImageUrl);
          console.log(`✅ Foto anterior eliminada de S3: ${oldImageUrl}`);
        } catch (error) {
          console.error('⚠️ Error eliminando foto anterior de S3:', error);
          // No fallar la operación si falla la eliminación de S3
        }
      }
    }
    
    return NextResponse.json(updatedSector);
  } catch (error) {
    console.error('Error al actualizar sector:', error);
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: 'Error al actualizar el sector' },
      { status: 500 }
    );
  }
}

// DELETE /api/sectores/[id]
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar permiso sectors.delete
    const { user: authUser, error: authError } = await requirePermission('sectors.delete');
    if (authError) return authError;

    const userId = await getUserIdFromToken();

    // Verificar si el sector existe y pertenece a una empresa del usuario
    const existingSector = await prisma.sector.findFirst({
      where: { 
        id: Number(params.id),
        area: {
          company: {
            users: {
              some: {
                userId: userId
              }
            }
          }
        }
      }
    });

    if (!existingSector) {
      return NextResponse.json(
        { error: 'Sector no encontrado o no tienes permisos para eliminarlo' },
        { status: 404 }
      );
    }

    // Primero verificar si hay máquinas asociadas
    const machinesCount = await prisma.machine.count({
      where: { sectorId: Number(params.id) },
    });

    if (machinesCount > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar el sector porque tiene máquinas asociadas' },
        { status: 400 }
      );
    }

    // Obtener imageUrl antes de eliminar
    let sectorImageUrl: string | null = null;
    try {
      const imageUrlResult = await prisma.$queryRaw<Array<{ imageUrl: string | null }>>`
        SELECT "imageUrl" FROM "Sector" WHERE id = ${Number(params.id)}
      `;
      sectorImageUrl = imageUrlResult[0]?.imageUrl || null;
    } catch (e) {
      console.error('Error obteniendo imageUrl del sector:', e);
    }

    // Eliminar imagen de S3 si existe
    if (sectorImageUrl) {
      try {
        await deleteS3File(sectorImageUrl);
        console.log(`✅ Imagen de sector eliminada de S3: ${sectorImageUrl}`);
      } catch (error) {
        console.error('⚠️ Error eliminando imagen de sector de S3:', error);
        // Continuar con la eliminación aunque falle S3
      }
    }

    await prisma.sector.delete({
      where: { id: Number(params.id) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar sector:', error);
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: 'Error al eliminar el sector' },
      { status: 500 }
    );
  }
} 