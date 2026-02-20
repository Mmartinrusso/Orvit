import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, getUserCompanyId } from '@/lib/tasks/auth-helper';

export const dynamic = 'force-dynamic';

/**
 * POST /api/dev/seed-demo
 * Crea datos de demostración para probar la feature de grupos.
 * Solo funciona en desarrollo (NODE_ENV !== 'production').
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'No disponible en producción' }, { status: 403 });
  }

  try {
    const user = await getUserFromToken();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const companyId = getUserCompanyId(user);
    if (!companyId) return NextResponse.json({ error: 'Usuario sin empresa' }, { status: 400 });

    const results: Record<string, any> = { groups: [], agendaTasks: [] };

    // ─── Grupos de demo ──────────────────────────────────────────────────────────

    const demoGroups = [
      { name: 'Estudio Contable', color: '#6366f1', icon: 'Briefcase', description: 'Tareas del estudio contable principal' },
      { name: 'Proyecto Alpha', color: '#10b981', icon: 'Star', description: 'Desarrollo del proyecto Alpha' },
      { name: 'Marketing Digital', color: '#ec4899', icon: 'Globe', description: 'Campañas y contenido digital' },
    ];

    const createdGroups: any[] = [];
    for (const groupData of demoGroups) {
      // Verificar si ya existe un grupo con ese nombre en la empresa
      const existing = await (prisma as any).taskGroup.findFirst({
        where: { companyId, name: groupData.name },
      });
      if (existing) {
        createdGroups.push(existing);
        results.groups.push({ ...existing, skipped: true });
        continue;
      }

      const group = await (prisma as any).taskGroup.create({
        data: {
          name: groupData.name,
          color: groupData.color,
          icon: groupData.icon,
          description: groupData.description,
          companyId,
          createdById: user.id,
        },
      });
      createdGroups.push(group);
      results.groups.push(group);
    }

    // ─── AgendaTasks de demo ─────────────────────────────────────────────────────

    const now = new Date();

    const demoTasks = [
      // Grupo 0: Estudio Contable
      { title: 'Presentar declaración mensual IVA', priority: 'HIGH', dueDate: addDays(now, 3), groupIndex: 0 },
      { title: 'Revisar balances trimestrales', priority: 'MEDIUM', dueDate: addDays(now, 7), groupIndex: 0 },
      { title: 'Coordinar auditoría interna', priority: 'URGENT', dueDate: addDays(now, 1), groupIndex: 0 },
      // Grupo 1: Proyecto Alpha
      { title: 'Definir arquitectura del módulo de pagos', priority: 'HIGH', dueDate: addDays(now, 5), groupIndex: 1 },
      { title: 'Escribir tests unitarios del API', priority: 'MEDIUM', dueDate: addDays(now, 10), groupIndex: 1 },
      { title: 'Deploy a staging environment', priority: 'LOW', dueDate: addDays(now, 14), groupIndex: 1 },
      // Grupo 2: Marketing Digital
      { title: 'Publicar post de blog semanal', priority: 'MEDIUM', dueDate: addDays(now, 2), groupIndex: 2 },
      { title: 'Analizar métricas de campaña Q1', priority: 'HIGH', dueDate: addDays(now, 4), groupIndex: 2 },
      { title: 'Preparar newsletter mensual', priority: 'LOW', dueDate: addDays(now, 6), groupIndex: 2 },
    ];

    for (const taskData of demoTasks) {
      const group = createdGroups[taskData.groupIndex];
      if (!group) continue;

      try {
        const task = await (prisma as any).agendaTask.create({
          data: {
            title: taskData.title,
            priority: taskData.priority,
            status: 'PENDING',
            dueDate: taskData.dueDate,
            groupId: group.id,
            companyId,
            createdById: user.id,
            assignedToUserId: user.id,
            assignedToName: user.name,
          },
        });
        results.agendaTasks.push({ id: task.id, title: task.title, groupName: group.name });
      } catch (err) {
        // Si ya existe (título duplicado por segunda ejecución), lo ignoramos
        console.warn('[seed-demo] AgendaTask skip:', (err as Error).message?.slice(0, 80));
      }
    }

    return NextResponse.json({
      success: true,
      message: `Datos de demo creados para "${user.name}" (empresa ${companyId})`,
      summary: {
        groups: results.groups.length,
        agendaTasks: results.agendaTasks.length,
      },
      details: results,
    });
  } catch (error) {
    console.error('[seed-demo] Error:', error);
    return NextResponse.json({ error: 'Error al crear datos de demo' }, { status: 500 });
  }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
