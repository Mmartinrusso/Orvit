/**
 * GET   /api/chat/conversations/:id — Conversation detail + members
 * PATCH /api/chat/conversations/:id — Edit (name, description, archive)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayload } from "@/lib/chat/auth";

export const dynamic = "force-dynamic";

async function verifyMembership(userId: number, conversationId: string) {
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { leftAt: true, role: true },
  });
  return member && !member.leftAt ? member : null;
}

// ── GET — Detail ──────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthPayload(request);
  if (!auth) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const membership = await verifyMembership(auth.userId, id);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      members: {
        where: { leftAt: null },
        select: {
          id: true,
          userId: true,
          role: true,
          unreadCount: true,
          muted: true,
          joinedAt: true,
          user: { select: { id: true, name: true, avatar: true, email: true } },
        },
      },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return NextResponse.json(conversation);
}

// ── PATCH — Edit ──────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthPayload(request);
  if (!auth) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const membership = await verifyMembership(auth.userId, id);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const updateData: Record<string, unknown> = {};

  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.isArchived !== undefined) updateData.isArchived = body.isArchived;

  const updated = await prisma.conversation.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(updated);
}
