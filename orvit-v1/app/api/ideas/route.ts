/**
 * API: /api/ideas
 *
 * GET - Listar ideas
 * POST - Crear nueva idea
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ideas
 * Listar ideas con filtros
 *
 * Query params:
 * - status: filter by status
 * - category: filter by category
 * - machineId: filter by machine
 * - priority: filter by priority
 * - createdById: filter by creator
 * - limit: number of records
 * - offset: pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const userId = payload.userId as number;
    const { searchParams } = request.nextUrl;

    // Build where clause
    const where: any = { companyId };

    const status = searchParams.get('status');
    if (status) where.status = status;

    const category = searchParams.get('category');
    if (category) where.category = category;

    const machineId = searchParams.get('machineId');
    if (machineId) where.machineId = parseInt(machineId);

    const priority = searchParams.get('priority');
    if (priority) where.priority = priority;

    const createdById = searchParams.get('createdById');
    if (createdById) where.createdById = parseInt(createdById);

    // Pagination
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const [ideas, total] = await Promise.all([
      prisma.idea.findMany({
        where,
        include: {
          machine: {
            select: { id: true, name: true }
          },
          createdBy: {
            select: { id: true, name: true, email: true, avatar: true }
          },
          reviewedBy: {
            select: { id: true, name: true }
          },
          implementedBy: {
            select: { id: true, name: true }
          },
          _count: {
            select: {
              votes: true,
              comments: true
            }
          },
          votes: {
            where: { userId },
            select: { id: true }
          }
        },
        orderBy: [
          { status: 'asc' },
          { priority: 'desc' },
          { createdAt: 'desc' }
        ],
        take: limit,
        skip: offset
      }),
      prisma.idea.count({ where })
    ]);

    // Transform to include vote count and user's vote status
    const ideasWithVoteInfo = ideas.map(idea => ({
      ...idea,
      voteCount: idea._count.votes,
      commentCount: idea._count.comments,
      hasVoted: idea.votes.length > 0,
      votes: undefined, // Remove raw votes array
      _count: undefined // Remove _count
    }));

    return NextResponse.json({
      ideas: ideasWithVoteInfo,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + ideas.length < total
      }
    });
  } catch (error) {
    console.error('Error en GET /api/ideas:', error);
    return NextResponse.json(
      { error: 'Error al obtener ideas' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ideas
 * Crear nueva idea
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const userId = payload.userId as number;

    const body = await request.json();
    const {
      title,
      description,
      category,
      priority,
      machineId,
      componentId,
      failureOccurrenceId,
      workOrderId,
      tags,
      attachments
    } = body;

    // Validations
    if (!title || !description || !category) {
      return NextResponse.json(
        { error: 'Título, descripción y categoría son requeridos' },
        { status: 400 }
      );
    }

    // Valid categories
    const validCategories = [
      'SOLUCION_FALLA',
      'MEJORA_PROCESO',
      'MEJORA_EQUIPO',
      'SEGURIDAD',
      'AHORRO_COSTOS',
      'CALIDAD',
      'OTRO'
    ];

    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Categoría inválida. Válidas: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate priority
    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const resolvedPriority = priority || 'MEDIUM';
    if (!validPriorities.includes(resolvedPriority)) {
      return NextResponse.json(
        { error: `Prioridad inválida. Válidas: ${validPriorities.join(', ')}` },
        { status: 400 }
      );
    }

    const idea = await prisma.idea.create({
      data: {
        companyId,
        title,
        description,
        category,
        priority: resolvedPriority,
        machineId: machineId ? parseInt(machineId) : null,
        componentId: componentId ? parseInt(componentId) : null,
        failureOccurrenceId: failureOccurrenceId ? parseInt(failureOccurrenceId) : null,
        workOrderId: workOrderId ? parseInt(workOrderId) : null,
        tags: tags || null,
        attachments: attachments || null,
        createdById: userId,
        status: 'NEW'
      },
      include: {
        machine: {
          select: { id: true, name: true }
        },
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Notify supervisors about new idea (optional)
    try {
      // TODO: Implement notification to supervisors
    } catch (notifyError) {
      console.error('Error notifying supervisors:', notifyError);
    }

    return NextResponse.json(idea, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/ideas:', error);
    return NextResponse.json(
      { error: 'Error al crear idea' },
      { status: 500 }
    );
  }
}
