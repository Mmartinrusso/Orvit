/**
 * PATCH  /api/chat/messages/:id — Edit message (sender only, 15min window)
 * DELETE /api/chat/messages/:id — Soft delete message (sender only)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayload } from "@/lib/chat/auth";
import { getPusher, chatChannel, triggerMessageDeleted } from "@/lib/chat/pusher";
import { deleteS3File } from "@/lib/s3-utils";

export const dynamic = "force-dynamic";

const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

async function getOwnMessage(userId: number, messageId: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, conversationId: true, senderId: true, createdAt: true, type: true, fileUrl: true, fileSize: true, companyId: true },
  });
  if (!message || message.senderId !== userId) return null;
  return message;
}

// ── PATCH — Edit message ────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthPayload(request);
  if (!auth) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: messageId } = await params;

  const message = await getOwnMessage(auth.userId, messageId);
  if (!message) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Only text messages can be edited
  if (message.type !== "text") {
    return NextResponse.json(
      { error: "Solo se pueden editar mensajes de texto" },
      { status: 400 }
    );
  }

  // Check 15-minute edit window
  const elapsed = Date.now() - message.createdAt.getTime();
  if (elapsed > EDIT_WINDOW_MS) {
    return NextResponse.json(
      { error: "Tiempo de edición expirado" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const content = (body.content || "").trim();

  if (!content || content.length > 4000) {
    return NextResponse.json(
      { error: "content debe tener entre 1 y 4000 caracteres" },
      { status: 400 }
    );
  }

  const editedAt = new Date();

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { content, editedAt },
  });

  // Broadcast edit via Pusher (fire-and-forget)
  getPusher()
    .trigger(chatChannel(message.conversationId), "message:edited", {
      messageId,
      content,
      editedAt,
    })
    .catch(() => {});

  return NextResponse.json(updated);
}

// ── DELETE — Soft delete message ────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthPayload(request);
  if (!auth) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: messageId } = await params;

  const message = await getOwnMessage(auth.userId, messageId);
  if (!message) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.message.update({
    where: { id: messageId },
    data: { isDeleted: true, content: "", fileUrl: null, fileName: null, fileSize: null, fileDuration: null },
  });

  // Delete S3 file if message had an attachment (fire-and-forget)
  if (message.fileUrl) {
    deleteS3File(message.fileUrl).catch(() => {});
    // Decrement company storage usage
    if (message.fileSize && message.companyId) {
      prisma.chatStorageUsage.upsert({
        where: { companyId: message.companyId },
        create: { companyId: message.companyId, usedBytes: BigInt(0) },
        update: { usedBytes: { decrement: BigInt(message.fileSize) } },
      }).catch(() => {});
    }
  }

  // Broadcast deletion via Pusher (fire-and-forget)
  triggerMessageDeleted(message.conversationId, messageId).catch(() => {});

  return NextResponse.json({ ok: true });
}
