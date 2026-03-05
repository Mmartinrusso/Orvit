/**
 * GET /api/chat/export?conversationId=xxx
 *
 * Exports all messages from a conversation as a JSON download.
 * Only members of the conversation can export.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayload } from "@/lib/chat/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await getAuthPayload(request);
  if (!auth) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const conversationId = request.nextUrl.searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json(
      { error: "conversationId requerido" },
      { status: 400 }
    );
  }

  // Verify user is a member
  const membership = await prisma.conversationMember.findFirst({
    where: { conversationId, userId: auth.userId },
  });
  if (!membership) {
    return NextResponse.json({ error: "No sos miembro de esta conversacion" }, { status: 403 });
  }

  // Get conversation info
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, name: true, type: true, createdAt: true },
  });

  // Get all non-deleted messages
  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      isDeleted: false,
    },
    select: {
      id: true,
      type: true,
      content: true,
      fileUrl: true,
      fileName: true,
      fileSize: true,
      fileDuration: true,
      createdAt: true,
      editedAt: true,
      sender: { select: { id: true, name: true, email: true } },
      replyToId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const exportData = {
    exportedAt: new Date().toISOString(),
    exportedBy: { id: auth.userId },
    conversation,
    messageCount: messages.length,
    messages: messages.map((m) => ({
      id: m.id,
      type: m.type,
      content: m.content,
      fileUrl: m.fileUrl,
      fileName: m.fileName,
      fileSize: m.fileSize,
      fileDuration: m.fileDuration,
      sender: m.sender ? { name: m.sender.name, email: m.sender.email } : null,
      replyToId: m.replyToId,
      createdAt: m.createdAt,
      editedAt: m.editedAt,
    })),
  };

  const json = JSON.stringify(exportData, null, 2);
  const safeName = (conversation?.name || "chat").replace(/[^a-zA-Z0-9]/g, "_");
  const fileName = `chat_backup_${safeName}_${new Date().toISOString().split("T")[0]}.json`;

  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
