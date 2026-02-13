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

// PUT /api/tasks/[id]/subtasks/[subtaskId] - Actualizar subtarea
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; subtaskId: string } }
) {
  try {
    console.log('🔄 PUT /api/tasks/[id]/subtasks/[subtaskId] - Iniciando...');
    
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const taskId = parseInt(params.id);
    const subtaskId = parseInt(params.subtaskId);
    const data = await request.json();

    if (isNaN(taskId) || isNaN(subtaskId)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    // Verificar que la tarea existe y el usuario es el asignado
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignedTo: true,
        company: true
      }
    });

    if (!task) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    // Solo el usuario asignado puede modificar subtareas
    if (task.assignedToId !== user.id) {
      return NextResponse.json({ 
        error: "Solo el usuario asignado puede modificar las subtareas" 
      }, { status: 403 });
    }

    // Actualizar la subtarea
    const updatedSubtask = await (prisma as any).subtask.update({
      where: { id: subtaskId },
      data: {
        completed: data.completed
      }
    });

    console.log('✅ Subtarea actualizada exitosamente:', subtaskId);
    
    return NextResponse.json({
      id: updatedSubtask.id.toString(),
      title: updatedSubtask.title,
      completed: updatedSubtask.completed
    });

  } catch (error) {
    console.error('❌ Error updating subtask:', error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 