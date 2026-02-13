import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Función para obtener el usuario desde el token
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
            company: true,
            role: true
          }
        },
        ownedCompanies: true
      }
    });

    return user;
  } catch (error) {
    console.error('Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

// PUT /api/work-stations/[id]/instructives/[instructiveId] - Actualizar instructivo
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; instructiveId: string } }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, fileUrl, fileName, fileType, fileSize, isActive } = body;

    if (!title) {
      return NextResponse.json({ 
        error: "Título del instructivo es requerido" 
      }, { status: 400 });
    }

    // Verificar que el instructivo existe
    const existingInstructive = await prisma.workStationInstructive.findUnique({
      where: {
        id: parseInt(params.instructiveId)
      }
    });

    if (!existingInstructive) {
      return NextResponse.json({ 
        error: "Instructivo no encontrado" 
      }, { status: 404 });
    }

    const instructive = await prisma.workStationInstructive.update({
      where: {
        id: parseInt(params.instructiveId)
      },
      data: {
        title,
        description,
        fileUrl,
        fileName,
        fileType,
        fileSize: fileSize ? parseInt(fileSize) : null,
        isActive: isActive !== undefined ? isActive : true
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return NextResponse.json(instructive);
  } catch (error) {
    console.error('Error actualizando instructivo:', error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// DELETE /api/work-stations/[id]/instructives/[instructiveId] - Eliminar instructivo
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; instructiveId: string } }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Verificar que el instructivo existe
    const existingInstructive = await prisma.workStationInstructive.findUnique({
      where: {
        id: parseInt(params.instructiveId)
      }
    });

    if (!existingInstructive) {
      return NextResponse.json({ 
        error: "Instructivo no encontrado" 
      }, { status: 404 });
    }

    // Eliminar el instructivo
    await prisma.workStationInstructive.delete({
      where: {
        id: parseInt(params.instructiveId)
      }
    });

    return NextResponse.json({ message: "Instructivo eliminado correctamente" });
  } catch (error) {
    console.error('Error eliminando instructivo:', error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
} 