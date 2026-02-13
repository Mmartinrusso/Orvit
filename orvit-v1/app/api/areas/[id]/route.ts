import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { deleteS3File } from '@/lib/s3-utils';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromRequest() {
  const cookieStore = cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return payload;
  } catch {
    return null;
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest();
  if (!user) return new NextResponse('No autorizado', { status: 401 });

  try {
    // Verificar si es un área del sistema
    const existingArea = await prisma.area.findUnique({
      where: { id: parseInt(params.id) },
    });
    
    if (!existingArea) {
      return new NextResponse('Área no encontrada', { status: 404 });
    }
    
    const SYSTEM_AREAS = ['Mantenimiento', 'Administración', 'Producción'];
    if (SYSTEM_AREAS.includes(existingArea.name)) {
      return new NextResponse('No se pueden editar las áreas del sistema', { status: 403 });
    }
    
    const body = await request.json();
    const { name, icon, logo } = body;
    if (!name || !icon) {
      return new NextResponse('Nombre e icono requeridos', { status: 400 });
    }
    
    // Obtener el logo anterior si se está actualizando el logo
    let oldLogo: string | null = null;
    if (logo !== undefined) {
      oldLogo = existingArea.logo || null;
    }
    
    const updateData: any = { name, icon };
    if (logo !== undefined) {
      updateData.logo = logo;
    }
    
    const area = await prisma.area.update({
      where: { id: parseInt(params.id) },
      data: updateData,
    });
    
    // Eliminar logo anterior de S3 si se eliminó o reemplazó
    if (oldLogo !== null && logo !== undefined) {
      const isDeleting = logo === null || logo === '';
      const isReplacing = !isDeleting && logo !== oldLogo;
      
      if (isDeleting || isReplacing) {
        try {
          await deleteS3File(oldLogo);
          console.log(`✅ Logo anterior de área eliminado de S3: ${oldLogo}`);
        } catch (error) {
          console.error('⚠️ Error eliminando logo anterior de área de S3:', error);
          // No fallar la operación si falla la eliminación de S3
        }
      }
    }
    
    return NextResponse.json(area);
  } catch (error) {
    console.error('Error al actualizar área:', error);
    return new NextResponse('Error interno del servidor', { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest();
  if (!user) return new NextResponse('No autorizado', { status: 401 });

  try {
    // Verificar si es un área del sistema
    const existingArea = await prisma.area.findUnique({
      where: { id: parseInt(params.id) },
    });
    
    if (!existingArea) {
      return new NextResponse('Área no encontrada', { status: 404 });
    }
    
    const SYSTEM_AREAS = ['Mantenimiento', 'Administración', 'Producción'];
    if (SYSTEM_AREAS.includes(existingArea.name)) {
      return new NextResponse('No se pueden eliminar las áreas del sistema', { status: 403 });
    }
    
    // Eliminar logo de S3 si existe
    if (existingArea.logo) {
      try {
        await deleteS3File(existingArea.logo);
        console.log(`✅ Logo de área eliminado de S3: ${existingArea.logo}`);
      } catch (error) {
        console.error('⚠️ Error eliminando logo de área de S3:', error);
        // Continuar con la eliminación aunque falle S3
      }
    }
    
    await prisma.area.delete({
      where: { id: parseInt(params.id) },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error al eliminar área:', error);
    return new NextResponse('Error interno del servidor', { status: 500 });
  }
} 