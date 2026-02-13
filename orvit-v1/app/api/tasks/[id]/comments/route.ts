import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { createAndSendInstantNotification } from '@/lib/instant-notifications';
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

// GET /api/tasks/[id]/comments - Obtener comentarios de la tarea
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('💬 GET /api/tasks/[id]/comments - Iniciando...');
    
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const taskId = parseInt(params.id);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: "ID de tarea inválido" }, { status: 400 });
    }

    // Verificar que la tarea existe y el usuario tiene acceso
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        company: true
      }
    });

    if (!task) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
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

    // Obtener comentarios de la tarea
    const comments = await (prisma as any).taskComment.findMany({
      where: { taskId: taskId },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const formattedComments = comments.map((comment: any) => ({
      id: comment.id.toString(),
      content: comment.content,
      userId: comment.user.id.toString(),
      userName: comment.user.name,
      userEmail: comment.user.email,
      createdAt: comment.createdAt.toISOString()
    }));

    return NextResponse.json(formattedComments);

  } catch (error) {
    console.error('❌ Error getting comments:', error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST /api/tasks/[id]/comments - Crear nuevo comentario
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('💬 POST /api/tasks/[id]/comments - Iniciando...');
    
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const taskId = parseInt(params.id);
    const data = await request.json();

    if (isNaN(taskId)) {
      return NextResponse.json({ error: "ID de tarea inválido" }, { status: 400 });
    }

    if (!data.content || !data.content.trim()) {
      return NextResponse.json({ error: "El contenido es requerido" }, { status: 400 });
    }

    // Verificar que la tarea existe y el usuario tiene acceso
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        company: true
      }
    });

    if (!task) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    // Verificar acceso a la empresa
    const userCompanyIds = [
      ...(user.ownedCompanies?.map(c => c.id) || []),
      ...(user.companies?.map(c => c.company.id) || [])
    ];

    if (!userCompanyIds.includes(task.companyId)) {
      return NextResponse.json({ 
        error: "No tienes acceso a esta tarea" 
      }, { status: 403 });
    }

    // Crear el comentario
    const newComment = await (prisma as any).taskComment.create({
      data: {
        content: data.content.trim(),
        taskId: taskId,
        userId: user.id,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    console.log('✅ Comentario creado exitosamente:', newComment.id);

    // Crear notificaciones para solicitante y asignado
    const usersToNotify: number[] = [];
    
    // Agregar asignado (si no es quien comentó)
    if (task.assignedToId && task.assignedToId !== user.id) {
      usersToNotify.push(task.assignedToId);
    }
    
    // Agregar solicitante/creador (si no es quien comentó)
    if (task.createdById && task.createdById !== user.id && !usersToNotify.includes(task.createdById)) {
      usersToNotify.push(task.createdById);
    }

    // Enviar notificaciones instantáneas
    for (const userId of usersToNotify) {
      const isAssignee = userId === task.assignedToId;
      const isCreator = userId === task.createdById;
      
      let role = '';
      if (isAssignee && isCreator) {
        role = 'solicitante y asignado';
      } else if (isAssignee) {
        role = 'asignado';
      } else if (isCreator) {
        role = 'solicitante';
      }

      // Enviar notificación instantánea via SSE + guardar en BD
      await createAndSendInstantNotification(
        'TASK_COMMENTED',
        userId,
        task.companyId,
        taskId,
        null, // no es reminder
        'Nuevo comentario en tarea',
        `${user.name} comentó en la tarea "${task.title}" donde eres ${role}`,
        'medium', // prioridad
        {
          commentedBy: user.name,
          commentedById: user.id,
          taskTitle: task.title,
          userRole: role,
          commentContent: data.content.trim()
        }
      );
    }
    
    return NextResponse.json({
      id: newComment.id.toString(),
      content: newComment.content,
      userId: newComment.user.id.toString(),
      userName: newComment.user.name,
      userEmail: newComment.user.email,
      createdAt: newComment.createdAt.toISOString()
    });

  } catch (error) {
    console.error('❌ Error creating comment:', error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 