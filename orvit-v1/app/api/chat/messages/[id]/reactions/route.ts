/**
 * POST   /api/chat/messages/:id/reactions — Add reaction
 * DELETE /api/chat/messages/:id/reactions — Remove reaction
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayload } from "@/lib/chat/auth";
import { getPusher } from "@/lib/chat/pusher";

export const dynamic = "force-dynamic";

async function verifyMessageAccess(userId: number, messageId: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { conversationId: true },
  });
  if (!message) return null;

  const member = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId: message.conversationId,
        userId,
      },
    },
    select: { leftAt: true },
  });

  if (!member || member.leftAt) return null;
  return message;
}

// ── POST — Add reaction ──────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthPayload(request);
  if (!auth) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: messageId } = await params;
  const body = await request.json();
  const emoji = (body.emoji || "").trim();

  if (!emoji || emoji.length > 10) {
    return NextResponse.json({ error: "emoji es requerido" }, { status: 400 });
  }

  const message = await verifyMessageAccess(auth.userId, messageId);
  if (!message) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Upsert — idempotent
  const reaction = await prisma.messageReaction.upsert({
    where: {
      messageId_userId_emoji: { messageId, userId: auth.userId, emoji },
    },
    update: {},
    create: { messageId, userId: auth.userId, emoji },
  });

  // Broadcast reaction via Pusher
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { name: true },
  });

  getPusher()
    .trigger(`private-chat-${message.conversationId}`, "reaction:added", {
      messageId,
      emoji,
      userId: auth.userId,
      userName: user?.name,
    })
    .catch(() => {});

  return NextResponse.json(reaction, { status: 201 });
}

// ── DELETE — Remove reaction ─────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthPayload(request);
  if (!auth) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: messageId } = await params;
  const { searchParams } = new URL(request.url);
  const emoji = searchParams.get("emoji");

  if (!emoji) {
    return NextResponse.json({ error: "emoji query param requerido" }, { status: 400 });
  }

  const message = await verifyMessageAccess(auth.userId, messageId);
  if (!message) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.messageReaction.deleteMany({
    where: { messageId, userId: auth.userId, emoji },
  });

  // Broadcast removal via Pusher
  getPusher()
    .trigger(`private-chat-${message.conversationId}`, "reaction:removed", {
      messageId,
      emoji,
      userId: auth.userId,
    })
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
