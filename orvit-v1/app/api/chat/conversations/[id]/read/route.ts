/**
 * PATCH /api/chat/conversations/:id/read — Mark conversation as read
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayload } from "@/lib/chat/auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthPayload(request);
  if (!auth) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: conversationId } = await params;
  const body = await request.json().catch(() => ({}));

  await prisma.conversationMember.update({
    where: {
      conversationId_userId: {
        conversationId,
        userId: auth.userId,
      },
    },
    data: {
      lastReadAt: new Date(),
      lastReadMessageId: body.messageId ?? undefined,
      unreadCount: 0,
    },
  });

  return NextResponse.json({ ok: true });
}
