import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromToken, getUserCompanyId } from "@/lib/admin-auth";
import { validateRequest } from '@/lib/validations/helpers';
import { CreateFeedbackSchema } from '@/lib/validations/feedback';

export const dynamic = 'force-dynamic';

/**
 * GET /api/feedback
 * Lista los feedbacks de la empresa (solo para admins)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const companyId = getUserCompanyId(user);
    if (!companyId) {
      return NextResponse.json({ error: "Sin empresa asociada" }, { status: 400 });
    }

    const feedbacks = await prisma.feedback.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true }
        }
      }
    });

    const unreadCount = feedbacks.filter(f => !f.read).length;

    return NextResponse.json({ feedbacks, total: feedbacks.length, unreadCount });
  } catch (error) {
    console.error('Error listando feedback:', error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * POST /api/feedback
 * Crea un nuevo feedback
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const companyId = getUserCompanyId(user);
    if (!companyId) {
      return NextResponse.json({ error: "Sin empresa asociada" }, { status: 400 });
    }

    const body = await request.json();
    const validation = validateRequest(CreateFeedbackSchema, body);
    if (!validation.success) return validation.response;

    const { type, priority, title, description } = validation.data;

    const feedback = await prisma.feedback.create({
      data: {
        type,
        priority,
        title,
        description,
        userId: user.id,
        companyId,
      }
    });

    return NextResponse.json({ success: true, feedback }, { status: 201 });
  } catch (error) {
    console.error('Error creando feedback:', error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
