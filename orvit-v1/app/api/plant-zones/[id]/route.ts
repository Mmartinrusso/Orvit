import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

// Helper: Obtener todos los descendientes de una zona
async function getAllDescendantIds(zoneId: number): Promise<number[]> {
  const descendants: number[] = [];
  const queue = [zoneId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = await prisma.plantZone.findMany({
      where: { parentId: currentId },
      select: { id: true }
    });
    for (const child of children) {
      descendants.push(child.id);
      queue.push(child.id);
    }
    if (descendants.length > 1000) break;
  }
  return descendants;
}

// Helper: Obtener profundidad de una zona
async function getZoneDepth(zoneId: number): Promise<number> {
  let depth = 0;
  let currentId: number | null = zoneId;

  while (currentId) {
    const zoneData: { parentId: number | null } | null = await prisma.plantZone.findUnique({
      where: { id: currentId },
      select: { parentId: true }
    });
    if (!zoneData || !zoneData.parentId) break;
    currentId = zoneData.parentId;
    depth++;
    if (depth > 50) break;
  }
  return depth;
}

// Helper: Obtener breadcrumb de una zona
async function getZoneBreadcrumb(zoneId: number): Promise<string[]> {
  const path: string[] = [];
  let currentId: number | null = zoneId;

  while (currentId) {
    const zoneData: { name: string; parentId: number | null } | null = await prisma.plantZone.findUnique({
      where: { id: currentId },
      select: { name: true, parentId: true }
    });
    if (!zoneData) break;
    path.unshift(zoneData.name);
    currentId = zoneData.parentId;
    if (path.length > 50) break;
  }
  return path;
}

// GET: Detalle de una zona con hijos y máquinas
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const zoneId = Number(params.id);

    const zone = await prisma.plantZone.findUnique({
      where: { id: zoneId },
      include: {
        sector: {
          select: { id: true, name: true }
        },
        parent: {
          select: { id: true, name: true }
        },
        children: {
          include: {
            children: true,
            machines: {
              select: {
                id: true,
                name: true,
                nickname: true,
                logo: true,
                status: true
              }
            },
            _count: {
              select: {
                children: true,
                machines: true
              }
            }
          },
          orderBy: [{ order: 'asc' }, { name: 'asc' }]
        },
        machines: {
          select: {
            id: true,
            name: true,
            nickname: true,
            logo: true,
            photo: true,
            status: true,
            brand: true,
            model: true,
            type: true,
            serialNumber: true
          },
          orderBy: { name: 'asc' }
        },
        _count: {
          select: {
            children: true,
            machines: true
          }
        }
      }
    });

    if (!zone) {
      return NextResponse.json({ error: 'Zona no encontrada' }, { status: 404 });
    }

    // Obtener breadcrumb y depth
    const breadcrumb = await getZoneBreadcrumb(zoneId);
    const depth = await getZoneDepth(zoneId);

    // Agregar breadcrumb y depth a los hijos también
    const childrenWithHierarchy = await Promise.all(
      zone.children.map(async (child) => ({
        ...child,
        breadcrumb: [...breadcrumb, child.name],
        depth: depth + 1
      }))
    );

    return NextResponse.json({
      ...zone,
      children: childrenWithHierarchy,
      breadcrumb,
      depth
    });
  } catch (error) {
    console.error('Error al obtener zona:', error);
    return NextResponse.json({ error: 'Error al obtener zona' }, { status: 500 });
  }
}

// PATCH: Actualizar zona
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const zoneId = Number(params.id);
    const body = await request.json();
    const { name, description, logo, photo, color, order, parentId } = body;

    // Verificar que la zona existe
    const currentZone = await prisma.plantZone.findUnique({
      where: { id: zoneId },
      select: { id: true, sectorId: true, parentId: true }
    });

    if (!currentZone) {
      return NextResponse.json({ error: 'Zona no encontrada' }, { status: 404 });
    }

    // Si se cambia el padre, validar
    if (parentId !== undefined) {
      const newParentId = parentId === null || parentId === '' ? null : Number(parentId);

      if (newParentId !== null) {
        // No puede ser su propio padre
        if (newParentId === zoneId) {
          return NextResponse.json({
            error: 'Una zona no puede ser su propio padre'
          }, { status: 400 });
        }

        // Verificar que el nuevo padre existe
        const newParent = await prisma.plantZone.findUnique({
          where: { id: newParentId },
          select: { id: true, name: true, sectorId: true }
        });

        if (!newParent) {
          return NextResponse.json({
            error: `Zona padre con ID ${newParentId} no encontrada`
          }, { status: 404 });
        }

        // Debe pertenecer al mismo sector
        if (newParent.sectorId !== currentZone.sectorId) {
          return NextResponse.json({
            error: 'La zona padre debe pertenecer al mismo sector'
          }, { status: 400 });
        }

        // Prevenir referencias circulares
        const descendants = await getAllDescendantIds(zoneId);
        if (descendants.includes(newParentId)) {
          return NextResponse.json({
            error: 'No se puede mover una zona debajo de uno de sus propios hijos',
            circularReference: true
          }, { status: 400 });
        }
      }
    }

    // Preparar datos para actualizar
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (logo !== undefined) updateData.logo = logo;
    if (photo !== undefined) updateData.photo = photo;
    if (color !== undefined) updateData.color = color;
    if (order !== undefined) updateData.order = Number(order);
    if (parentId !== undefined) {
      updateData.parentId = parentId === null || parentId === '' ? null : Number(parentId);
    }

    const updatedZone = await prisma.plantZone.update({
      where: { id: zoneId },
      data: updateData,
      include: {
        sector: { select: { id: true, name: true } },
        parent: { select: { id: true, name: true } },
        _count: { select: { children: true, machines: true } }
      }
    });

    // Obtener breadcrumb y depth actualizados
    const breadcrumb = await getZoneBreadcrumb(zoneId);
    const depth = await getZoneDepth(zoneId);

    return NextResponse.json({
      ...updatedZone,
      breadcrumb,
      depth
    });
  } catch (error) {
    console.error('Error al actualizar zona:', error);
    return NextResponse.json({ error: 'Error al actualizar zona' }, { status: 500 });
  }
}

// DELETE: Eliminar zona
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const zoneId = Number(params.id);

    // Verificar que la zona existe
    const zone = await prisma.plantZone.findUnique({
      where: { id: zoneId },
      include: {
        _count: {
          select: {
            children: true,
            machines: true
          }
        }
      }
    });

    if (!zone) {
      return NextResponse.json({ error: 'Zona no encontrada' }, { status: 404 });
    }

    // Verificar si tiene hijos o máquinas
    if (zone._count.children > 0) {
      return NextResponse.json({
        error: 'No se puede eliminar una zona que tiene sub-zonas',
        hint: `Esta zona tiene ${zone._count.children} sub-zona(s). Elimínalas primero.`
      }, { status: 400 });
    }

    if (zone._count.machines > 0) {
      return NextResponse.json({
        error: 'No se puede eliminar una zona que tiene máquinas',
        hint: `Esta zona tiene ${zone._count.machines} máquina(s). Muévelas a otra zona o elimínalas primero.`
      }, { status: 400 });
    }

    // Eliminar la zona
    await prisma.plantZone.delete({
      where: { id: zoneId }
    });

    return NextResponse.json({
      message: 'Zona eliminada correctamente',
      deletedId: zoneId
    });
  } catch (error) {
    console.error('Error al eliminar zona:', error);
    return NextResponse.json({ error: 'Error al eliminar zona' }, { status: 500 });
  }
}
