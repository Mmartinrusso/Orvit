/**
 * GET  /api/chat/conversations/:id/messages — Paginated messages (cursor-based)
 * POST /api/chat/conversations/:id/messages — Send message (text, audio, image, file + replies + mentions)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayload } from "@/lib/chat/auth";
import { triggerNewMessage, triggerInboxUpdate } from "@/lib/chat/pusher";
import { sendChatPushNotifications } from "@/lib/chat/push-notifications";

export const dynamic = "force-dynamic";

async function verifyMembership(userId: number, conversationId: string) {
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { leftAt: true, conversationId: true },
  });
  return member && !member.leftAt ? member : null;
}

// Shared include for messages
const messageInclude = {
  sender: {
    select: { id: true, name: true, avatar: true },
  },
  replyTo: {
    select: {
      id: true,
      content: true,
      type: true,
      senderId: true,
      sender: { select: { id: true, name: true } },
    },
  },
  reactions: {
    select: {
      id: true,
      emoji: true,
      userId: true,
      user: { select: { id: true, name: true } },
    },
  },
} as const;

// ── GET — List messages ───────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthPayload(request);
  if (!auth) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  const membership = await verifyMembership(auth.userId, conversationId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const cursor = searchParams.get("cursor"); // ISO date string

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: messageInclude,
  });

  // Group reactions by emoji for each message
  const enriched = messages.map((msg) => ({
    ...msg,
    reactions: groupReactions(msg.reactions),
  }));

  return NextResponse.json(enriched);
}

function groupReactions(
  reactions: { id: string; emoji: string; userId: number; user: { id: number; name: string } }[]
) {
  const grouped: Record<string, { emoji: string; count: number; users: { id: number; name: string }[] }> = {};
  for (const r of reactions) {
    if (!grouped[r.emoji]) {
      grouped[r.emoji] = { emoji: r.emoji, count: 0, users: [] };
    }
    grouped[r.emoji].count++;
    grouped[r.emoji].users.push(r.user);
  }
  return Object.values(grouped);
}

// ── POST — Send message ──────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthPayload(request);
  if (!auth || !auth.companyId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  const membership = await verifyMembership(auth.userId, conversationId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const content = (body.content || "").trim();
  const type: string = body.type || "text";
  const fileUrl: string | undefined = body.fileUrl;
  const fileName: string | undefined = body.fileName;
  const fileSize: number | undefined = body.fileSize;
  const fileDuration: number | undefined = body.fileDuration;
  const replyToId: string | undefined = body.replyToId;
  const mentions: number[] = Array.isArray(body.mentions) ? body.mentions : [];

  // Content is required for text, optional for audio/image/file
  if (type === "text" && (!content || content.length > 4000)) {
    return NextResponse.json(
      { error: "content debe tener entre 1 y 4000 caracteres" },
      { status: 400 }
    );
  }

  if (["audio", "image", "file"].includes(type) && !fileUrl) {
    return NextResponse.json(
      { error: "fileUrl es requerido para audio/image/file" },
      { status: 400 }
    );
  }

  // Get sender name for denormalized fields
  const sender = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { name: true, avatar: true },
  });

  // Build preview text for inbox
  const previewMap: Record<string, string> = {
    audio: "🎤 Audio",
    image: "📷 Imagen",
    file: `📎 ${fileName || "Archivo"}`,
  };
  const preview = previewMap[type] || content.slice(0, 100);
  const now = new Date();

  // Transaction: create message + update conversation + increment unread
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId,
        senderId: auth.userId,
        companyId: auth.companyId,
        content: content || preview,
        type,
        fileUrl,
        fileName,
        fileSize,
        fileDuration,
        replyToId,
        mentions,
      },
      include: messageInclude,
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: now,
        lastMessageText: preview,
        lastMessageBy: sender?.name || "Unknown",
      },
    }),
    prisma.conversationMember.updateMany({
      where: {
        conversationId,
        userId: { not: auth.userId },
        leftAt: null,
      },
      data: { unreadCount: { increment: 1 } },
    }),
  ]);

  // Enrich reactions for response
  const enrichedMessage = {
    ...message,
    reactions: groupReactions(message.reactions),
  };

  // Pusher: broadcast to conversation channel (fire-and-forget)
  triggerNewMessage(
    conversationId,
    enrichedMessage as unknown as Record<string, unknown>
  ).catch(() => {});

  // Pusher: update inbox for each member (fire-and-forget)
  prisma.conversationMember
    .findMany({
      where: { conversationId, leftAt: null, userId: { not: auth.userId } },
      select: { userId: true, unreadCount: true },
    })
    .then((members) => {
      for (const m of members) {
        triggerInboxUpdate(m.userId, {
          conversationId,
          lastMessageText: preview,
          unreadCount: m.unreadCount,
        }).catch(() => {});
      }
    })
    .catch(() => {});

  // Push notifications (fire-and-forget)
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { name: true, type: true },
  });

  sendChatPushNotifications({
    conversationId,
    conversationName: conversation?.name || sender?.name || "Chat",
    senderName: sender?.name || "Unknown",
    content: preview,
    senderId: auth.userId,
  }).catch(() => {});

  // Special push for mentions (even if muted)
  if (mentions.length > 0) {
    // TODO: Send mention-specific push notifications that bypass mute
  }

  return NextResponse.json(enrichedMessage, { status: 201 });
}
