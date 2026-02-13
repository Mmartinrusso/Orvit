import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { hasPermission } from '@/lib/permissions';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Mapeo de frecuencias entre frontend y base de datos
const FREQUENCY_MAP = {
  'diaria': 'DAILY',
  'semanal': 'WEEKLY', 
  'quincenal': 'BIWEEKLY',
  'mensual': 'MONTHLY',
  'trimestral': 'QUARTERLY',
  'semestral': 'SEMIANNUAL',
  'anual': 'ANNUAL'
} as const;

const REVERSE_FREQUENCY_MAP = {
  'DAILY': 'diaria',
  'WEEKLY': 'semanal',
  'BIWEEKLY': 'quincenal', 
  'MONTHLY': 'mensual',
  'QUARTERLY': 'trimestral',
  'SEMIANNUAL': 'semestral',
  'ANNUAL': 'anual'
} as const;

// Mapeo de prioridades entre frontend y base de datos
const PRIORITY_MAP = {
  'baja': 'LOW',
  'media': 'MEDIUM',
  'alta': 'HIGH'
} as const;

const REVERSE_PRIORITY_MAP = {
  'LOW': 'baja',
  'MEDIUM': 'media',
  'HIGH': 'alta'
} as const;

// Helper para obtener el usuario actual
async function getCurrentUser() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number }
    });

    return user;
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    return null;
  }
}

// PUT /api/fixed-tasks/[id] - Actualizar tarea fija
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('📝 [API] PUT /api/fixed-tasks/[id] iniciado');
    
    const taskId = parseInt(params.id);
    const body = await request.json();
    console.log('📋 [API] Actualizando tarea:', taskId);
    console.log('📋 [API] Datos recibidos:', JSON.stringify(body, null, 2));

    const { 
      title, 
      description, 
      frequency, 
      assignedTo, 
      department, 
      instructives, 
      estimatedTime, 
      priority, 
      isActive, 
      nextExecution,
      isCompleted,
      completedAt
    } = body;

    // Mapear frecuencia al enum de la base de datos
    const dbFrequency = FREQUENCY_MAP[frequency as keyof typeof FREQUENCY_MAP];
    if (!dbFrequency) {
      console.log('❌ [API] Frecuencia inválida:', frequency);
      return NextResponse.json({ error: 'Frecuencia inválida' }, { status: 400 });
    }

    // Mapear prioridad al enum de la base de datos
    const dbPriority = priority ? PRIORITY_MAP[priority as keyof typeof PRIORITY_MAP] : 'MEDIUM';
    if (priority && !dbPriority) {
      console.log('❌ [API] Prioridad inválida:', priority);
      return NextResponse.json({ error: 'Prioridad inválida' }, { status: 400 });
    }
    
    console.log('🔧 [API] Prioridad mapeada:', priority, '->', dbPriority);

    // Determinar si es usuario o worker
    let assignedToId = null;
    let assignedWorkerId = null;
    
    console.log('👤 [API] Procesando assignedTo:', assignedTo);
    
    if (assignedTo?.id) {
      console.log('👤 [API] AssignedTo.id recibido:', assignedTo.id);
      
      let userId = assignedTo.id;
      let userType = 'USER'; // Default
      
      // Si el ID tiene formato "USER-1" o "WORKER-2", parsearlo
      if (assignedTo.id.includes('-')) {
        const parts = assignedTo.id.split('-');
        userType = parts[0];
        userId = parts[1];
        console.log('👤 [API] Parseado - Tipo:', userType, 'ID:', userId);
      }
      
      const parsedId = parseInt(userId);
      if (isNaN(parsedId)) {
        console.log('❌ [API] ID inválido:', assignedTo.id);
        return NextResponse.json({ error: 'ID de usuario inválido' }, { status: 400 });
      }
      
      if (userType === 'USER') {
        // Verificar si es un usuario del sistema
        const userCheck = await prisma.user.findUnique({
          where: { id: parsedId }
        });
        
        if (userCheck) {
          assignedToId = userCheck.id;
          console.log('✅ [API] Usuario encontrado:', userCheck.name);
        } else {
          console.log('❌ [API] Usuario no encontrado con ID:', parsedId);
        }
      } else if (userType === 'WORKER') {
        // Verificar si es un worker
        const worker = await prisma.worker.findUnique({
          where: { id: parsedId }
        });
        if (worker) {
          assignedWorkerId = worker.id;
          console.log('✅ [API] Worker encontrado:', worker.name);
        } else {
          console.log('❌ [API] Worker no encontrado con ID:', parsedId);
        }
      }
    }
    
    console.log('👤 [API] Resultado final - assignedToId:', assignedToId, 'assignedWorkerId:', assignedWorkerId);

    // Preparar datos para la actualización
    const updateData = {
      title,
      description: description || null,
      frequency: dbFrequency,
      priority: dbPriority,
      estimatedTime: estimatedTime || 30,
      isActive: isActive !== undefined ? isActive : true,
      assignedToId,
      assignedWorkerId,
      department: department || 'General',
      nextExecution: nextExecution ? new Date(nextExecution) : null,
      isCompleted: isCompleted || false,
      completedAt: completedAt ? new Date(completedAt) : null
    };
    
    console.log('🔧 [API] Datos preparados para actualización:', updateData);
    
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    if (!hasPermission('fixed_tasks.edit', { userId: user.id, userRole: user.role })) {
      return NextResponse.json({ error: 'No tienes permiso para editar tareas fijas' }, { status: 403 });
    }

    try {
      // Actualizar la tarea fija usando SQL directo
      await prisma.$queryRaw`
        UPDATE "FixedTask" 
        SET 
          title = ${title}, 
          description = ${description || null}, 
          frequency = ${dbFrequency}::"TaskFrequency", 
          priority = ${dbPriority}::"Priority",
          "estimatedTime" = ${estimatedTime || 30}, 
          "isActive" = ${isActive !== undefined ? isActive : true}, 
          "assignedToId" = ${assignedToId}, 
          "assignedWorkerId" = ${assignedWorkerId}, 
          department = ${department || 'General'}, 
          "nextExecution" = ${updateData.nextExecution}, 
          "isCompleted" = ${isCompleted || false},
          "completedAt" = ${updateData.completedAt},
          "updatedAt" = NOW()
        WHERE id = ${taskId}
      `;
      // console.log('✅ [API] Tarea actualizada exitosamente') // Log reducido;
    } catch (updateError) {
      console.error('❌ [API] Error en UPDATE de FixedTask:', updateError);
      throw updateError;
    }

    try {
      // Eliminar instructivos existentes
      console.log('🗑️ [API] Eliminando instructivos existentes para tarea:', taskId);
      await prisma.$queryRaw`
        DELETE FROM "FixedTaskInstructive" WHERE "fixedTaskId" = ${taskId}
      `;
      // console.log('✅ [API] Instructivos eliminados') // Log reducido;
    } catch (deleteError) {
      console.error('❌ [API] Error eliminando instructivos:', deleteError);
      throw deleteError;
    }

    // Crear nuevos instructivos si existen
    if (instructives && instructives.length > 0) {
      console.log(`📚 [API] Creando ${instructives.length} nuevos instructivos...`);
      
      for (let i = 0; i < instructives.length; i++) {
        const inst = instructives[i];
        console.log(`📝 [API] Creando instructivo ${i + 1}:`, {
          title: inst.title,
          content: inst.content?.substring(0, 50) + '...',
          attachments: inst.attachments?.length || 0
        });
        
        try {
          // Preparar attachments como JSONB
          const attachmentsJson = inst.attachments ? JSON.stringify(inst.attachments) : null;
          
          await prisma.$queryRaw`
            INSERT INTO "FixedTaskInstructive" (
              title, content, attachments, "fixedTaskId", "order", "createdAt", "updatedAt"
            )
            VALUES (
              ${inst.title}, 
              ${inst.content}, 
              ${attachmentsJson}::jsonb, 
              ${taskId}, 
              ${i}, 
              NOW(), 
              NOW()
            )
          `;
          // console.log(`✅ [API] Instructivo ${i + 1} creado exitosamente`) // Log reducido;
        } catch (instError) {
          console.error(`❌ [API] Error creando instructivo ${i + 1}:`, instError);
          throw instError;
        }
      }
    } else {
      console.log('📚 [API] No hay instructivos para crear');
    }

    // Obtener la tarea actualizada
    const updatedTaskResult = await prisma.$queryRaw`
      SELECT 
        ft.*,
        u.name as "assignedUserName",
        u.email as "assignedUserEmail",
        w.name as "assignedWorkerName",
        w.specialty as "assignedWorkerSpecialty"
      FROM "FixedTask" ft
      LEFT JOIN "User" u ON ft."assignedToId" = u.id
      LEFT JOIN "Worker" w ON ft."assignedWorkerId" = w.id
      WHERE ft.id = ${taskId}
    ` as any[];

    if (updatedTaskResult.length === 0) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    const updatedTask = updatedTaskResult[0];

    // Obtener instructivos
    const instructivesResult = await prisma.$queryRaw`
      SELECT * FROM "FixedTaskInstructive" 
      WHERE "fixedTaskId" = ${taskId}
      ORDER BY "order" ASC
    ` as any[];

    // Transformar para el frontend
    const transformedTask = {
      id: updatedTask.id.toString(),
      title: updatedTask.title,
      description: updatedTask.description || '',
      frequency: REVERSE_FREQUENCY_MAP[updatedTask.frequency as keyof typeof REVERSE_FREQUENCY_MAP] || 'mensual',
      assignedTo: {
        id: (updatedTask.assignedToId || updatedTask.assignedWorkerId)?.toString() || '',
        name: updatedTask.assignedUserName || updatedTask.assignedWorkerName || 'Sin asignar'
      },
      department: updatedTask.department || 'General',
      instructives: instructivesResult.map((inst: any) => ({
        id: inst.id.toString(),
        title: inst.title,
        content: inst.content,
        attachments: inst.attachments || []
      })),
      estimatedTime: updatedTask.estimatedTime || 30,
      priority: REVERSE_PRIORITY_MAP[updatedTask.priority as keyof typeof REVERSE_PRIORITY_MAP] || 'media',
      isActive: updatedTask.isActive,
      lastExecuted: updatedTask.lastExecuted?.toISOString(),
      nextExecution: updatedTask.nextExecution.toISOString(),
      createdAt: updatedTask.createdAt.toISOString(),
      completedAt: updatedTask.completedAt?.toISOString(),
      isCompleted: updatedTask.isCompleted
    };

    console.log('✅ [API] Tarea fija actualizada exitosamente:', taskId);

    return NextResponse.json({
      success: true,
      task: transformedTask
    });

  } catch (error) {
    console.error('❌ [API] Error en PUT /api/fixed-tasks/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/fixed-tasks/[id] - Eliminar tarea fija
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // console.log('🗑️ [API] DELETE /api/fixed-tasks/[id] iniciado') // Log reducido;
    
    const taskId = parseInt(params.id);
    console.log('📋 [API] Eliminando tarea:', taskId);

    // Verificar que la tarea existe
    const taskExists = await prisma.$queryRaw`
      SELECT id FROM "FixedTask" WHERE id = ${taskId}
    ` as any[];

    if (taskExists.length === 0) {
      console.log('❌ [API] Tarea no encontrada');
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    // Eliminar instructivos primero (por foreign key)
    await prisma.$queryRaw`
      DELETE FROM "FixedTaskInstructive" WHERE "fixedTaskId" = ${taskId}
    `;

    // **ELIMINAR NOTIFICACIONES RELACIONADAS CON LA TAREA FIJA**
    try {
      await prisma.$queryRaw`
        DELETE FROM "Notification" 
        WHERE "metadata"->>'taskId' = ${taskId.toString()}
          OR "type" = 'TASK_AUTO_RESET' AND "metadata"->>'fixedTaskId' = ${taskId.toString()}
      `;
      console.log('✅ Notificaciones relacionadas con la tarea fija eliminadas');
    } catch (error) {
      console.error('⚠️ Error eliminando notificaciones de la tarea fija:', error);
      // Continuar con la eliminación aunque falle la limpieza de notificaciones
    }

    // Eliminar la tarea
    await prisma.$queryRaw`
      DELETE FROM "FixedTask" WHERE id = ${taskId}
    `;

    console.log('✅ [API] Tarea fija eliminada exitosamente:', taskId);

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    if (!hasPermission('fixed_tasks.delete', { userId: user.id, userRole: user.role })) {
      return NextResponse.json({ error: 'No tienes permiso para eliminar tareas fijas' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      message: 'Tarea eliminada exitosamente'
    });

  } catch (error) {
    console.error('❌ [API] Error en DELETE /api/fixed-tasks/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 