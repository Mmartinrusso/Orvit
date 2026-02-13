import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';


const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper function para obtener usuario desde JWT
async function getUserFromToken(request: NextRequest) {
  try {
    const token = cookies().get('token')?.value;
    
    if (!token) {
      console.log('❌ No hay token JWT');
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: {
            company: true
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

// Helper para obtener companyId del usuario
function getUserCompanyId(user: any): number | null {
  if (user.ownedCompanies && user.ownedCompanies.length > 0) {
    return user.ownedCompanies[0].id;
  } else if (user.companies && user.companies.length > 0) {
    return user.companies[0].companyId;
  }
  return null;
}

// GET /api/tasks/history - Obtener historial de tareas eliminadas
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const companyId = getUserCompanyId(user);
    if (!companyId) {
      return NextResponse.json({ error: "Usuario sin empresa" }, { status: 401 });
    }

    // Buscar historial de tareas eliminadas en la tabla Document
    const historyRecords = await prisma.document.findMany({
      where: {
        fileName: 'TASK_HISTORY',
        companyId: companyId
      },
      orderBy: {
        uploadDate: 'desc'
      }
    });

    // Parsear datos del historial
    const filteredHistory = historyRecords
      .map(record => {
        try {
          const taskData = JSON.parse(record.url);
          return {
            id: record.id,
            task: taskData,
            deletedAt: record.uploadDate,
            deletedBy: taskData.deletedBy
          };
        } catch (error) {
          console.error('Error parseando historial:', error);
          return null;
        }
      })
      .filter(item => item !== null);

    return NextResponse.json({
      success: true,
      history: filteredHistory
    });

  } catch (error) {
    console.error('Error obteniendo historial:', error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST /api/tasks/history - Agregar tarea al historial
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { taskData } = body;

    if (!taskData) {
      return NextResponse.json({ error: "Datos de tarea requeridos" }, { status: 400 });
    }

    // Crear registro de historial
    const historyRecord = await prisma.document.create({
      data: {
        name: `Tarea eliminada: ${taskData.title}`,
        fileName: 'TASK_HISTORY',
        url: JSON.stringify({
          ...taskData,
          deletedBy: {
            id: user.id,
            name: user.name,
            email: user.email
          },
          deletedAt: new Date().toISOString()
        }),
        companyId: getUserCompanyId(user),
        uploadedById: user.id
      }
    });

    console.log('✅ Tarea guardada en historial:', taskData.title);

    return NextResponse.json({
      success: true,
      historyId: historyRecord.id,
      message: 'Tarea guardada en historial'
    });

  } catch (error) {
    console.error('Error guardando en historial:', error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/history - Eliminar permanentemente del historial
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const companyId = getUserCompanyId(user);
    if (!companyId) {
      return NextResponse.json({ error: "Usuario sin empresa" }, { status: 401 });
    }

    const body = await request.json();
    const { historyId } = body;

    if (!historyId) {
      return NextResponse.json({ error: "ID de historial requerido" }, { status: 400 });
    }

    // Verificar que el registro pertenece a la empresa del usuario
    const historyRecord = await prisma.document.findFirst({
      where: {
        id: historyId,
        fileName: 'TASK_HISTORY',
        companyId: companyId
      }
    });

    if (!historyRecord) {
      return NextResponse.json({ error: "Registro de historial no encontrado" }, { status: 404 });
    }

    // Eliminar permanentemente del historial
    await prisma.document.delete({
      where: {
        id: historyId
      }
    });

    console.log('✅ Tarea eliminada permanentemente del historial:', historyId);

    return NextResponse.json({
      success: true,
      message: 'Tarea eliminada permanentemente del historial'
    });

  } catch (error) {
    console.error('Error eliminando del historial:', error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 