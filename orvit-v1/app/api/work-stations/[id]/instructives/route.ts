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

// GET /api/work-stations/[id]/instructives - Obtener instructivos de un puesto de trabajo
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const instructives = await prisma.workStationInstructive.findMany({
      where: {
        workStationId: parseInt(params.id),
        isActive: true
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { createdAt: 'desc' }
      ]
    });

    return NextResponse.json(instructives);
  } catch (error) {
    console.error('Error obteniendo instructivos:', error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// POST /api/work-stations/[id]/instructives - Crear instructivo
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      description,
      fileUrl,
      fileName,
      fileType,
      fileSize,
      scope,
      contentHtml,
      machineIds,
      componentIds
    } = body;

    console.log('📋 [API] Creando instructivo con:', {
      title,
      scope,
      machineIds,
      componentIds,
      workStationId: params.id
    });

    if (!title) {
      return NextResponse.json({
        error: "Título del instructivo es requerido"
      }, { status: 400 });
    }

    // Verificar que el puesto de trabajo existe
    const workStation = await prisma.workStation.findUnique({
      where: {
        id: parseInt(params.id)
      }
    });

    if (!workStation) {
      return NextResponse.json({
        error: "Puesto de trabajo no encontrado"
      }, { status: 404 });
    }

    const instructive = await prisma.workStationInstructive.create({
      data: {
        title,
        description,
        fileUrl,
        fileName,
        fileType,
        fileSize: fileSize ? parseInt(fileSize) : null,
        scope,
        contentHtml,
        machineIds: machineIds ? JSON.stringify(machineIds) : null,
        componentIds: componentIds ? JSON.stringify(componentIds) : null,
        workStationId: parseInt(params.id),
        createdById: user.id
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

    console.log('✅ [API] Instructivo creado:', {
      id: instructive.id,
      title: instructive.title,
      scope: instructive.scope,
      machineIds: instructive.machineIds,
      componentIds: instructive.componentIds
    });

    return NextResponse.json(instructive);
  } catch (error) {
    console.error('❌ [API] Error creando instructivo:', error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
} 