import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/tasks/auth-helper';

export const dynamic = 'force-dynamic';

// GET /api/agenda/assignees - Buscar usuarios y contactos para asignar
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = parseInt(searchParams.get('companyId') || '0');
    const search = searchParams.get('search') || '';

    if (!companyId) {
      return NextResponse.json({ error: 'CompanyId requerido' }, { status: 400 });
    }

    // Buscar usuarios de la empresa
    const usersPromise = prisma.user.findMany({
      where: {
        companies: {
          some: { companyId },
        },
        isActive: true,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }),
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        email: true,
      },
      take: 20,
      orderBy: { name: 'asc' },
    });

    // Buscar contactos del usuario
    const contactsPromise = prisma.contact.findMany({
      where: {
        userId: user.id,
        isActive: true,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { company: { contains: search, mode: 'insensitive' as const } },
          ],
        }),
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        email: true,
      },
      take: 20,
      orderBy: { name: 'asc' },
    });

    const [users, contacts] = await Promise.all([usersPromise, contactsPromise]);

    // Combinar y formatear resultados
    const assignees = [
      ...users.map((u) => ({
        id: u.id,
        name: u.name,
        avatar: u.avatar,
        email: u.email,
        type: 'user' as const,
      })),
      ...contacts.map((c) => ({
        id: c.id,
        name: c.name,
        avatar: c.avatar,
        email: c.email,
        type: 'contact' as const,
      })),
    ];

    // Ordenar por nombre
    assignees.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(assignees);
  } catch (error) {
    console.error('[API] Error fetching assignees:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
