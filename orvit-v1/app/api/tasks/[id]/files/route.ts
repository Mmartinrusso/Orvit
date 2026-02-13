import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

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

// GET /api/tasks/[id]/files - Obtener archivos de la tarea
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(request);
    
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const taskId = parseInt(params.id);
    
    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'ID de tarea inválido' }, { status: 400 });
    }

    // Verificar que la tarea existe y el usuario tiene acceso
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        company: true
      }
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    // Verificar que el usuario tenga acceso a la tarea (misma empresa)
    const userCompanyIds = [
      ...(user.ownedCompanies?.map(c => c.id) || []),
      ...(user.companies?.map(c => c.company.id) || [])
    ];

    if (!userCompanyIds.includes(task.companyId)) {
      return NextResponse.json({ 
        error: "No tienes acceso a esta tarea" 
      }, { status: 403 });
    }

    // Por ahora, retornar un array vacío ya que no hay sistema de archivos implementado
    // En el futuro, aquí se implementaría la lógica para obtener archivos reales
    return NextResponse.json({
      success: true,
      files: []
    });

  } catch (error) {
    console.error('Error obteniendo archivos de tarea:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/tasks/[id]/files - Subir archivo a la tarea
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(request);
    
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const taskId = parseInt(params.id);
    
    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'ID de tarea inválido' }, { status: 400 });
    }

    // Verificar que la tarea existe
    const task = await prisma.task.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    // Por ahora, retornar error ya que no hay sistema de archivos implementado
    return NextResponse.json(
      { error: 'Sistema de archivos no implementado aún' },
      { status: 501 }
    );

  } catch (error) {
    console.error('Error subiendo archivo a tarea:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 