/**
 * POST /api/chat/pusher/auth
 *
 * Pusher channel authentication endpoint.
 * Validates that the user is authorized to subscribe to private channels:
 * - private-chat-{conversationId} → must be a member
 * - private-inbox-{userId} → must be the same user
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayload } from "@/lib/chat/auth";
import { authenticateChannel } from "@/lib/chat/pusher";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await getAuthPayload(request);
  if (!auth) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const formData = await request.formData();
  const socketId = formData.get("socket_id") as string;
  const channelName = formData.get("channel_name") as string;

  if (!socketId || !channelName) {
    return NextResponse.json(
      { error: "socket_id y channel_name son requeridos" },
      { status: 400 }
    );
  }

  // Authorize inbox channel: only the user themselves
  if (channelName.startsWith("private-inbox-")) {
    const inboxUserId = parseInt(channelName.replace("private-inbox-", ""), 10);
    if (inboxUserId !== auth.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const authResponse = authenticateChannel(socketId, channelName);
    return NextResponse.json(authResponse);
  }

  // Authorize company channel: must belong to that company
  if (channelName.startsWith("private-company-")) {
    const parts = channelName.split("-"); // private-company-{companyId}-{entity}
    const companyId = parseInt(parts[2], 10);

    if (!auth.companyId || auth.companyId !== companyId) {
      // Check if user belongs to this company
      const membership = await prisma.userOnCompany.findFirst({
        where: { userId: auth.userId, companyId },
        select: { id: true },
      });
      if (!membership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const authResponse = authenticateChannel(socketId, channelName);
    return NextResponse.json(authResponse);
  }

  // Authorize chat channel: must be a member
  if (channelName.startsWith("private-chat-")) {
    const conversationId = channelName.replace("private-chat-", "");

    const member = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: auth.userId,
        },
      },
      select: { leftAt: true },
    });

    if (!member || member.leftAt) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const authResponse = authenticateChannel(socketId, channelName);
    return NextResponse.json(authResponse);
  }

  return NextResponse.json(
    { error: "Canal no reconocido" },
    { status: 400 }
  );
}
