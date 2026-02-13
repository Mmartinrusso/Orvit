import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

/**
 * ✨ ENDPOINT OPTIMIZADO: Bootstrap de agenda
 * Reemplaza múltiples requests individuales con una sola llamada
 * Usa Promise.all para ejecutar queries en paralelo
 * 
 * ANTES: ~5-8 requests (tasks, contacts, reminders, history, filters)
 * DESPUÉS: 1 request
 */
export async function GET(request: NextRequest) {
  try {
    // Obtener usuario actual
    const token = cookies().get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    const userId = payload.userId as number;

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    const companyIdNum = parseInt(companyId);

    // ✨ OPTIMIZACIÓN: Ejecutar todas las queries en paralelo con Promise.all
    const [
      tasks,
      contacts,
      reminders
    ] = await Promise.all([
      // 1. Tareas del usuario (limitadas a las más recientes)
      getTasks(userId, companyIdNum),
      
      // 2. Contactos
      getContacts(companyIdNum),
      
      // 3. Recordatorios activos
      getReminders(userId, companyIdNum)
    ]);

    // ✨ Respuesta unificada
    return NextResponse.json({
      tasks: tasks,
      contacts: contacts,
      reminders: reminders,
      metadata: {
        userId: userId,
        companyId: companyIdNum,
        timestamp: new Date().toISOString(),
        counts: {
          tasks: tasks.length,
          contacts: contacts.length,
          reminders: reminders.length
        }
      }
    });

  } catch (error) {
    console.error('❌ Error en bootstrap de agenda:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// ============================================================================
// FUNCIONES HELPER
// ============================================================================

/**
 * Obtener tareas del usuario
 */
async function getTasks(userId: number, companyId: number) {
  try {
    // Obtener tareas activas y recientes (últimos 30 días o futuras)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const tasks = await prisma.task.findMany({
      where: {
        OR: [
          { assignedToId: userId },
          { createdById: userId }
        ],
        status: {
          in: ['PENDING', 'IN_PROGRESS']
        },
        OR: [
          { dueDate: { gte: thirtyDaysAgo } },
          { dueDate: null }
        ]
      },
      take: 100,
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' }
      ],
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        completedAt: true,
        createdAt: true,
        assignedToId: true,
        createdById: true
      }
    });

    return tasks;
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }
}

/**
 * Obtener contactos
 */
async function getContacts(companyId: number) {
  try {
    const contacts = await prisma.contact.findMany({
      where: {
        companyId: companyId,
        isActive: true
      },
      orderBy: {
        name: 'asc'
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        position: true,
        notes: true,
        isActive: true
      },
      take: 200
    });

    return contacts;
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return [];
  }
}

/**
 * Obtener recordatorios activos
 */
async function getReminders(userId: number, companyId: number) {
  try {
    const now = new Date();

    const reminders = await prisma.reminder.findMany({
      where: {
        userId: userId,
        isActive: true,
        reminderDate: {
          gte: now
        }
      },
      orderBy: {
        reminderDate: 'asc'
      },
      select: {
        id: true,
        title: true,
        description: true,
        reminderDate: true,
        isActive: true,
        createdAt: true
      },
      take: 50
    });

    return reminders;
  } catch (error) {
    console.error('Error fetching reminders:', error);
    return [];
  }
}

