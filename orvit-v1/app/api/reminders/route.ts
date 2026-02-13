import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { scheduleReminderNotifications } from '@/lib/reminder-scheduler';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';


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

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Usar consulta SQL simple
    const reminders = await prisma.$queryRaw`
      SELECT 
        r.*,
        c.name as contact_name
      FROM "Reminder" r
      LEFT JOIN "Contact" c ON r."contactId" = c.id
      WHERE r."userId" = ${user.id}
      ORDER BY r."dueDate" ASC
    ` as any[];

    // Transformar datos para el frontend
    const transformedReminders = reminders.map((reminder: any) => ({
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
    }));

    return NextResponse.json({
      success: true,
      reminders: transformedReminders,
      count: transformedReminders.length
    });

  } catch (error) {
    console.error('Error obteniendo recordatorios:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      dueDate,
      priority = 'media',
      type = 'GENERAL',
      contactId
    } = body;

    if (!title || !dueDate) {
      return NextResponse.json(
        { error: 'Título y fecha son requeridos' },
        { status: 400 }
      );
    }

    // Mapear prioridad
    const dbPriority = PRIORITY_MAP[priority as keyof typeof PRIORITY_MAP] || 'MEDIUM';

    // Crear recordatorio usando SQL simple
    const newReminderResult = await prisma.$queryRaw`
      INSERT INTO "Reminder" (
        title, description, "dueDate", priority, type, "contactId", "userId", "isCompleted", "createdAt", "updatedAt"
      )
      VALUES (
        ${title}, 
        ${description || null}, 
        ${new Date(dueDate)}, 
        ${dbPriority}::"Priority", 
        ${type}, 
        ${contactId ? parseInt(contactId) : null}, 
        ${user.id}, 
        false, 
        NOW(), 
        NOW()
      )
      RETURNING *
    ` as any[];

    const newReminder = newReminderResult[0];

    // Obtener nombre del contacto si existe
    let contactName = null;
    if (contactId) {
      try {
        const contactResult = await prisma.$queryRaw`
          SELECT name FROM "Contact" WHERE id = ${parseInt(contactId)}
        ` as any[];
        
        if (contactResult.length > 0) {
          contactName = contactResult[0].name;
        }
      } catch (error) {
        // Ignorar error de contacto
      }
    }

    // Transformar para el frontend
    const transformedReminder = {
      id: newReminder.id.toString(),
      title: newReminder.title,
      description: newReminder.description,
      dueDate: new Date(newReminder.dueDate).toISOString(),
      isCompleted: newReminder.isCompleted,
      completedAt: null,
      priority: REVERSE_PRIORITY_MAP[newReminder.priority as keyof typeof REVERSE_PRIORITY_MAP] || 'media',
      type: newReminder.type,
      contactId: newReminder.contactId?.toString(),
      contactName: contactName,
      createdAt: new Date(newReminder.createdAt).toISOString(),
      updatedAt: new Date(newReminder.updatedAt).toISOString()
    };

    // ¡PROGRAMAR NOTIFICACIONES INSTANTÁNEAS!
    try {
      // Obtener companyId del usuario desde sus relaciones
      const userWithCompany = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          companies: {
            include: { company: true }
          },
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
          newReminder.id.toString(),
          user.id,
          companyId,
          newReminder.title,
          new Date(newReminder.dueDate),
          transformedReminder.priority as 'baja' | 'media' | 'alta',
          contactName
        );
        console.log(`🚀 Notificaciones programadas para recordatorio ${newReminder.id}: ${newReminder.title}`);
      } else {
        console.warn(`⚠️ No se pudo obtener companyId para usuario ${user.id}, no se programaron notificaciones`);
      }
    } catch (schedulingError) {
      console.error('Error programando notificaciones para recordatorio:', schedulingError);
      // No fallar la creación del recordatorio si falla la programación
    }

    return NextResponse.json({
      success: true,
      reminder: transformedReminder
    }, { status: 201 });

  } catch (error) {
    console.error('Error creando recordatorio:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 