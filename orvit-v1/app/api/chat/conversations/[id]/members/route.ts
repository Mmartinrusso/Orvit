/**
 * GET    /api/chat/conversations/:id/members — List active members (for mentions)
 * POST   /api/chat/conversations/:id/members — Add members to conversation (admin only)
 * DELETE /api/chat/conversations/:id/members — Remove member / leave conversation
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayload } from "@/lib/chat/auth";
import { getPusher, chatChannel } from "@/lib/chat/pusher";

export const dynamic = "force-dynamic";

async function verifyAdmin(userId: number, conversationId: string) {
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { role: true, leftAt: true },
  });
  return member && !member.leftAt && member.role === "admin" ? member : null;
}

async function verifyMembership(userId: number, conversationId: string) {
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { role: true, leftAt: true },
  });
  return member && !member.leftAt ? member : null;
}

// ── GET — List members ──────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthPayload(request);
  if (!auth) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  // Verify caller is a member
  const myMembership = await verifyMembership(auth.userId, conversationId);
  if (!myMembership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const members = await prisma.conversationMember.findMany({
    where: { conversationId, leftAt: null },
    select: {
      userId: true,
      role: true,
      user: {
        select: { id: true, name: true, avatar: true, email: true },
      },
    },
  });

  return NextResponse.json(members);
}

// ── POST — Add members ─────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthPayload(request);
  if (!auth || !auth.companyId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  // Verify caller is admin
  const adminMember = await verifyAdmin(auth.userId, conversationId);
  if (!adminMember) {
    return NextResponse.json(
      { error: "Solo administradores pueden agregar miembros" },
      { status: 403 }
    );
  }

  // Verify conversation type (only CHANNEL or CONTEXTUAL)
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { type: true },
  });

  if (!conversation || conversation.type === "DIRECT") {
    return NextResponse.json(
      { error: "No se pueden agregar miembros a un chat directo" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const userIds: number[] = Array.isArray(body.userIds) ? body.userIds : [];

  if (userIds.length === 0) {
    return NextResponse.json(
      { error: "userIds es requerido" },
      { status: 400 }
    );
  }

  let added = 0;

  for (const userId of userIds) {
    // Upsert: if member existed and left, rejoin; otherwise create
    await prisma.conversationMember.upsert({
      where: { conversationId_userId: { conversationId, userId } },
      update: { leftAt: null },
      create: {
        conversationId,
        userId,
        role: "member",
      },
    });
    added++;

    // Get user name for system message
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    // Create system message
    await prisma.message.create({
      data: {
        conversationId,
        senderId: null,
        companyId: auth.companyId,
        type: "system",
        content: `${user?.name || "Usuario"} fue agregado al grupo`,
      },
    });
  }

  // Broadcast via Pusher (fire-and-forget)
  getPusher()
    .trigger(chatChannel(conversationId), "members:updated", {
      action: "added",
      count: added,
    })
    .catch(() => {});

  return NextResponse.json({ added });
}

// ── PATCH — Update member role ───────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthPayload(request);
  if (!auth || !auth.companyId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  // Verify caller is admin
  const adminMember = await verifyAdmin(auth.userId, conversationId);
  if (!adminMember) {
    return NextResponse.json(
      { error: "Solo administradores pueden cambiar roles" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { userId, role } = body as { userId?: number; role?: string };

  if (!userId || !role || !["admin", "member"].includes(role)) {
    return NextResponse.json(
      { error: "userId y role ('admin' | 'member') son requeridos" },
      { status: 400 }
    );
  }

  // Cannot change own role
  if (userId === auth.userId) {
    return NextResponse.json(
      { error: "No podés cambiar tu propio rol" },
      { status: 400 }
    );
  }

  // Verify target is active member
  const targetMembership = await verifyMembership(userId, conversationId);
  if (!targetMembership) {
    return NextResponse.json(
      { error: "El usuario no es miembro activo" },
      { status: 404 }
    );
  }

  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { role },
  });

  // Get names for system message
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  const newRoleLabel = role === "admin" ? "administrador" : "miembro";
  const systemMessage = `${targetUser?.name || "Usuario"} ahora es ${newRoleLabel}`;

  await prisma.message.create({
    data: {
      conversationId,
      senderId: null,
      companyId: auth.companyId,
      type: "system",
      content: systemMessage,
    },
  });

  // Broadcast via Pusher
  getPusher()
    .trigger(chatChannel(conversationId), "members:updated", {
      action: "role_changed",
      userId,
      role,
    })
    .catch(() => {});

  return NextResponse.json({ ok: true, role });
}

// ── DELETE — Remove member / leave ──────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthPayload(request);
  if (!auth || !auth.companyId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  const { searchParams } = new URL(request.url);
  const targetUserId = parseInt(searchParams.get("userId") || "", 10);

  if (!targetUserId || isNaN(targetUserId)) {
    return NextResponse.json(
      { error: "userId query param es requerido" },
      { status: 400 }
    );
  }

  const isSelf = targetUserId === auth.userId;

  // If removing someone else, caller must be admin
  if (!isSelf) {
    const adminMember = await verifyAdmin(auth.userId, conversationId);
    if (!adminMember) {
      return NextResponse.json(
        { error: "Solo administradores pueden remover miembros" },
        { status: 403 }
      );
    }
  } else {
    // If leaving, caller must be a member
    const membership = await verifyMembership(auth.userId, conversationId);
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Soft delete: set leftAt
  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId: targetUserId } },
    data: { leftAt: new Date() },
  });

  // Get names for system message
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { name: true },
  });

  let systemMessage: string;
  if (isSelf) {
    systemMessage = `${targetUser?.name || "Usuario"} salió del grupo`;
  } else {
    const adminUser = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { name: true },
    });
    systemMessage = `${adminUser?.name || "Admin"} removió a ${targetUser?.name || "Usuario"}`;
  }

  // Create system message
  await prisma.message.create({
    data: {
      conversationId,
      senderId: null,
      companyId: auth.companyId,
      type: "system",
      content: systemMessage,
    },
  });

  // Broadcast via Pusher (fire-and-forget)
  getPusher()
    .trigger(chatChannel(conversationId), "members:updated", {
      action: "removed",
      userId: targetUserId,
    })
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
