/**
 * GET /api/chat/bot-conversation — Get or auto-create the Orvit AI bot conversation for the current user
 *
 * Every user gets a unique DIRECT-like conversation with the Orvit bot.
 * The conversation has isSystemBot=true and is auto-created on first access.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayload } from "@/lib/chat/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await getAuthPayload(request);
  if (!auth || !auth.companyId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Check if bot conversation already exists for this user
  const existing = await prisma.conversation.findFirst({
    where: {
      companyId: auth.companyId,
      isSystemBot: true,
      members: {
        some: { userId: auth.userId, leftAt: null },
      },
    },
    include: {
      members: {
        where: { leftAt: null },
        select: {
          userId: true,
          unreadCount: true,
          muted: true,
          role: true,
          user: { select: { id: true, name: true, avatar: true } },
        },
      },
    },
  });

  if (existing) {
    return NextResponse.json(existing);
  }

  // Auto-create bot conversation
  const conversation = await prisma.conversation.create({
    data: {
      companyId: auth.companyId,
      type: "DIRECT",
      name: "ORVIT",
      description: "Asistente inteligente de ORVIT. Enviá mensajes de texto o audio para hacer consultas, crear tareas, reportar fallas y más.",
      isSystemBot: true,
      iconName: "sparkles",
      retentionDays: 365,
      createdBy: auth.userId,
      members: {
        create: [{ userId: auth.userId, role: "admin" }],
      },
    },
    include: {
      members: {
        where: { leftAt: null },
        select: {
          userId: true,
          unreadCount: true,
          muted: true,
          role: true,
          user: { select: { id: true, name: true, avatar: true } },
        },
      },
    },
  });

  // Send welcome message
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: null,
      companyId: auth.companyId,
      type: "system",
      content:
        "¡Hola! Soy ORVIT, tu asistente inteligente. Podés enviarme mensajes de texto o audio para:\n\n• Consultar información de máquinas y equipos\n• Reportar fallas o incidentes\n• Crear órdenes de trabajo\n• Ver el estado de tareas pendientes\n• Analizar tendencias de mantenimiento\n\n¿En qué te puedo ayudar?",
    },
  });

  // Update lastMessage fields
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      lastMessageText: "¡Hola! Soy ORVIT, tu asistente inteligente.",
      lastMessageBy: "ORVIT",
    },
  });

  return NextResponse.json(conversation, { status: 201 });
}
