/**
 * POST /api/chat/conversations/:id/typing — Broadcast typing indicator
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayload } from "@/lib/chat/auth";
import { getPusher, chatChannel } from "@/lib/chat/pusher";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthPayload(request);
  if (!auth) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  // Verify caller is a member of the conversation
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: auth.userId } },
    select: { leftAt: true },
  });

  if (!membership || membership.leftAt) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get user name for the typing indicator
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { name: true },
  });

  // Broadcast typing event (fire-and-forget)
  getPusher()
    .trigger(chatChannel(conversationId), "typing", {
      userId: auth.userId,
      userName: user?.name || "Unknown",
    })
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
