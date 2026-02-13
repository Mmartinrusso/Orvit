import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { scheduleReminderNotifications, cancelScheduledReminder } from '@/lib/reminder-scheduler';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper function para obtener usuario desde JWT
async function getUserFromToken(request: NextRequest) {
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
    console.error('Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const reminderId = parseInt(params.id);

    if (isNaN(reminderId)) {
      return NextResponse.json(
        { error: 'ID de recordatorio inválido' },
        { status: 400 }
      );
    }

    console.log('🔍 [API] Obteniendo recordatorio ID:', reminderId);

    // Verificar si la tabla Reminder existe
    const reminderTableExists = await prisma.$queryRaw`
      SELECT COUNT(*) FROM information_schema.tables 
      WHERE table_name = 'Reminder'
    ` as any[];

    if (!reminderTableExists[0] || reminderTableExists[0].count == 0) {
      return NextResponse.json(
        { error: 'Sistema de recordatorios no configurado' },
        { status: 503 }
      );
    }

    const reminderResult = await prisma.$queryRaw`
      SELECT 
        r.*,
        c.name as contact_name
      FROM "Reminder" r
      LEFT JOIN "Contact" c ON r."contactId" = c.id
      WHERE r.id = ${reminderId} AND r."userId" = ${user.id}
    ` as any[];

    if (reminderResult.length === 0) {
      return NextResponse.json(
        { error: 'Recordatorio no encontrado' },
        { status: 404 }
      );
    }

    const reminder = reminderResult[0];

    // Transformar para el frontend
    const transformedReminder = {
      id: reminder.id.toString(),
      title: reminder.title,
      description: reminder.description,
      dueDate: new Date(reminder.dueDate).toISOString(),
      isCompleted: reminder.isCompleted,
      completedAt: reminder.completedAt ? new Date(reminder.completedAt).toISOString() : null,
      priority: REVERSE_PRIORITY_MAP[reminder.priority as keyof typeof REVERSE_PRIORITY_MAP] || 'media',
      type: reminder.type,
      contactId: reminder.contactId?.toString(),
      contactName: reminder.contact_name,
      createdAt: new Date(reminder.createdAt).toISOString(),
      updatedAt: new Date(reminder.updatedAt).toISOString()
    };

    console.log('✅ [API] Recordatorio encontrado:', reminder.id);

    return NextResponse.json({
      success: true,
      reminder: transformedReminder
    });

  } catch (error) {
    console.error('❌ [API] Error obteniendo recordatorio:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const reminderId = parseInt(params.id);

    if (isNaN(reminderId)) {
      return NextResponse.json(
        { error: 'ID de recordatorio inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      dueDate,
      priority,
      type,
      contactId,
      isCompleted
    } = body;

    console.log('✏️ [API] Actualizando recordatorio ID:', reminderId);

    // Verificar si la tabla Reminder existe
    const reminderTableExists = await prisma.$queryRaw`
      SELECT COUNT(*) FROM information_schema.tables 
      WHERE table_name = 'Reminder'
    ` as any[];

    if (!reminderTableExists[0] || reminderTableExists[0].count == 0) {
      return NextResponse.json(
        { error: 'Sistema de recordatorios no configurado' },
        { status: 503 }
      );
    }

    // Verificar que el recordatorio existe y pertenece al usuario
    const existingReminderResult = await prisma.$queryRaw`
      SELECT id FROM "Reminder" 
      WHERE id = ${reminderId} AND "userId" = ${user.id}
    ` as any[];

    if (existingReminderResult.length === 0) {
      return NextResponse.json(
        { error: 'Recordatorio no encontrado' },
        { status: 404 }
      );
    }

    // Construir la actualización SQL dinámicamente
    let updateFields: string[] = [];
    let sqlParams: any[] = [];

    if (title !== undefined) {
      updateFields.push('title = $' + (sqlParams.length + 1));
      sqlParams.push(title);
    }

    if (description !== undefined) {
      updateFields.push('description = $' + (sqlParams.length + 1));
      sqlParams.push(description || null);
    }

    if (dueDate !== undefined) {
      updateFields.push('"dueDate" = $' + (sqlParams.length + 1));
      sqlParams.push(new Date(dueDate));
    }

    if (priority !== undefined) {
      const dbPriority = PRIORITY_MAP[priority as keyof typeof PRIORITY_MAP] || 'MEDIUM';
      updateFields.push('priority = $' + (sqlParams.length + 1) + '::"Priority"');
      sqlParams.push(dbPriority);
    }

    if (type !== undefined) {
      updateFields.push('type = $' + (sqlParams.length + 1));
      sqlParams.push(type);
    }

    if (contactId !== undefined) {
      updateFields.push('"contactId" = $' + (sqlParams.length + 1));
      sqlParams.push(contactId ? parseInt(contactId) : null);
    }

    if (isCompleted !== undefined) {
      updateFields.push('"isCompleted" = $' + (sqlParams.length + 1));
      sqlParams.push(isCompleted);
      
      if (isCompleted) {
        updateFields.push('"completedAt" = NOW()');
      } else {
        updateFields.push('"completedAt" = NULL');
      }
    }

    updateFields.push('"updatedAt" = NOW()');

    if (updateFields.length === 1) { // Solo updatedAt
      return NextResponse.json(
        { error: 'No hay campos para actualizar' },
        { status: 400 }
      );
    }

    // Ejecutar actualización
    const updateQuery = `
      UPDATE "Reminder" 
      SET ${updateFields.join(', ')}
      WHERE id = ${reminderId} AND "userId" = ${user.id}
      RETURNING *
    `;

    const updatedReminderResult = await prisma.$queryRawUnsafe(updateQuery, ...sqlParams) as any[];
    const updatedReminder = updatedReminderResult[0];

    // Obtener nombre del contacto si existe
    let contactName = null;
    if (updatedReminder.contactId) {
      try {
        const contactResult = await prisma.$queryRaw`
          SELECT name FROM "Contact" WHERE id = ${updatedReminder.contactId}
        ` as any[];
        
        if (contactResult.length > 0) {
          contactName = contactResult[0].name;
        }
      } catch (error) {
        console.log('No se pudo obtener el nombre del contacto');
      }
    }

    // Transformar para el frontend
    const transformedReminder = {
      id: updatedReminder.id.toString(),
      title: updatedReminder.title,
      description: updatedReminder.description,
      dueDate: new Date(updatedReminder.dueDate).toISOString(),
      isCompleted: updatedReminder.isCompleted,
      completedAt: updatedReminder.completedAt ? new Date(updatedReminder.completedAt).toISOString() : null,
      priority: REVERSE_PRIORITY_MAP[updatedReminder.priority as keyof typeof REVERSE_PRIORITY_MAP] || 'media',
      type: updatedReminder.type,
      contactId: updatedReminder.contactId?.toString(),
      contactName: contactName,
      createdAt: new Date(updatedReminder.createdAt).toISOString(),
      updatedAt: new Date(updatedReminder.updatedAt).toISOString()
    };

    console.log('✅ [API] Recordatorio actualizado exitosamente:', updatedReminder.id);

    // ¡REPROGRAMAR NOTIFICACIONES INSTANTÁNEAS!
    try {
      // Si se actualizó la fecha, completado, o se cambió significativamente, reprogramar
      const needsRescheduling = dueDate !== undefined || isCompleted !== undefined || title !== undefined;
      
      if (needsRescheduling) {
        // Primero cancelar las notificaciones existentes
        cancelScheduledReminder(updatedReminder.id.toString());

        // Si no está completado, programar nuevas notificaciones
        if (!updatedReminder.isCompleted) {
          // Obtener companyId del usuario
          const userWithCompany = await prisma.user.findUnique({
            where: { id: user.id },
            include: {
              companies: { include: { company: true } },
              ownedCompanies: true
            }
          });

          let companyId: number | null = null;
          if (userWithCompany?.ownedCompanies?.[0]) {
            companyId = userWithCompany.ownedCompanies[0].id;
          } else if (userWithCompany?.companies?.[0]) {
            companyId = userWithCompany.companies[0].company.id;
          }

          if (companyId) {
            scheduleReminderNotifications(
              updatedReminder.id.toString(),
              user.id,
              companyId,
              updatedReminder.title,
              new Date(updatedReminder.dueDate),
              transformedReminder.priority as 'baja' | 'media' | 'alta',
              contactName
            );
            console.log(`🔄 Notificaciones reprogramadas para recordatorio ${updatedReminder.id}`);
          }
        } else {
          // console.log(`✅ Recordatorio ${updatedReminder.id} completado, notificaciones canceladas`) // Log reducido;
        }
      }
    } catch (schedulingError) {
      console.error('Error reprogramando notificaciones:', schedulingError);
      // No fallar la actualización si falla la reprogramación
    }

    return NextResponse.json({
      success: true,
      reminder: transformedReminder
    });

  } catch (error) {
    console.error('❌ [API] Error actualizando recordatorio:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const reminderId = parseInt(params.id);

    if (isNaN(reminderId)) {
      return NextResponse.json(
        { error: 'ID de recordatorio inválido' },
        { status: 400 }
      );
    }

    console.log('🗑️ [API] Eliminando recordatorio ID:', reminderId);

    // Verificar si la tabla Reminder existe
    const reminderTableExists = await prisma.$queryRaw`
      SELECT COUNT(*) FROM information_schema.tables 
      WHERE table_name = 'Reminder'
    ` as any[];

    if (!reminderTableExists[0] || reminderTableExists[0].count == 0) {
      return NextResponse.json(
        { error: 'Sistema de recordatorios no configurado' },
        { status: 503 }
      );
    }

    // Verificar que el recordatorio existe y pertenece al usuario
    const existingReminderResult = await prisma.$queryRaw`
      SELECT id FROM "Reminder" 
      WHERE id = ${reminderId} AND "userId" = ${user.id}
    ` as any[];

    if (existingReminderResult.length === 0) {
      return NextResponse.json(
        { error: 'Recordatorio no encontrado' },
        { status: 404 }
      );
    }

    // Eliminar recordatorio
    await prisma.$queryRaw`
      DELETE FROM "Reminder" 
      WHERE id = ${reminderId} AND "userId" = ${user.id}
    `;

    // ¡CANCELAR NOTIFICACIONES PROGRAMADAS!
    try {
      const canceledJobs = cancelScheduledReminder(reminderId.toString());
      console.log(`🚫 Canceladas ${canceledJobs} notificaciones programadas para recordatorio ${reminderId}`);
    } catch (cancelError) {
      console.error('Error cancelando notificaciones programadas:', cancelError);
      // No fallar la eliminación si falla la cancelación
    }

    console.log('✅ [API] Recordatorio eliminado exitosamente:', reminderId);

    return NextResponse.json({
      success: true,
      message: 'Recordatorio eliminado exitosamente'
    });

  } catch (error) {
    console.error('❌ [API] Error eliminando recordatorio:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 