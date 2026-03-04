/**
 * POST /api/chat/conversations — Create conversation
 * GET  /api/chat/conversations — Inbox (user's active conversations)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayload } from "@/lib/chat/auth";

export const dynamic = "force-dynamic";

const RETENTION_DEFAULTS: Record<string, number> = {
  DIRECT: 365,
  CHANNEL: 365,
  CONTEXTUAL: 730,
};

// ── GET — Inbox ───────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await getAuthPayload(request);
  if (!auth || !auth.companyId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const archived = searchParams.get("archived") === "true";
  const limit = Math.min(parseInt(searchParams.get("limit") || "30", 10), 50);
  const cursor = searchParams.get("cursor"); // ISO date string

  const conversations = await prisma.conversation.findMany({
    where: {
      companyId: auth.companyId,
      isArchived: archived,
      members: {
        some: {
          userId: auth.userId,
          leftAt: null,
        },
      },
      ...(cursor ? { lastMessageAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { lastMessageAt: { sort: "desc", nulls: "last" } },
    take: limit,
    include: {
      members: {
        where: { leftAt: null },
        select: {
          userId: true,
          unreadCount: true,
          muted: true,
          role: true,
          user: {
            select: { id: true, name: true, avatar: true },
          },
        },
      },
    },
  });

  // Attach unreadCount and muted from the current user's membership
  const enriched = conversations.map((c) => {
    const myMembership = c.members.find((m) => m.userId === auth.userId);
    return {
      ...c,
      unreadCount: myMembership?.unreadCount ?? 0,
      muted: myMembership?.muted ?? false,
    };
  });

  const nextCursor =
    conversations.length === limit
      ? conversations[conversations.length - 1].lastMessageAt?.toISOString()
      : undefined;

  return NextResponse.json({ conversations: enriched, nextCursor });
}

// ── POST — Create conversation ────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = await getAuthPayload(request);
  if (!auth || !auth.companyId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const { type, name, description, memberIds, entityType, entityId } = body;

  if (!type || !["DIRECT", "CHANNEL", "CONTEXTUAL"].includes(type)) {
    return NextResponse.json(
      { error: "type debe ser DIRECT, CHANNEL o CONTEXTUAL" },
      { status: 400 }
    );
  }

  if (type !== "DIRECT" && !name) {
    return NextResponse.json(
      { error: "name es requerido para CHANNEL y CONTEXTUAL" },
      { status: 400 }
    );
  }

  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return NextResponse.json(
      { error: "memberIds es requerido" },
      { status: 400 }
    );
  }

  // === DIRECT: ensure uniqueness ===
  if (type === "DIRECT") {
    if (memberIds.length !== 1) {
      return NextResponse.json(
        { error: "DIRECT requiere exactamente 1 memberIds (el otro participante)" },
        { status: 400 }
      );
    }

    const targetId = memberIds[0];
    const directUserAId = Math.min(auth.userId, targetId);
    const directUserBId = Math.max(auth.userId, targetId);

    // Check if already exists
    const existing = await prisma.conversation.findUnique({
      where: {
        companyId_directUserAId_directUserBId: {
          companyId: auth.companyId,
          directUserAId,
          directUserBId,
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

    // Create new DIRECT
    const conversation = await prisma.conversation.create({
      data: {
        companyId: auth.companyId,
        type: "DIRECT",
        directUserAId,
        directUserBId,
        retentionDays: RETENTION_DEFAULTS.DIRECT,
        createdBy: auth.userId,
        members: {
          create: [
            { userId: auth.userId, role: "admin" },
            { userId: targetId, role: "member" },
          ],
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

    return NextResponse.json(conversation, { status: 201 });
  }

  // === CHANNEL or CONTEXTUAL ===
  const allMemberIds = Array.from(new Set([auth.userId, ...memberIds]));

  const conversation = await prisma.conversation.create({
    data: {
      companyId: auth.companyId,
      type: type as "CHANNEL" | "CONTEXTUAL",
      name,
      description,
      entityType: type === "CONTEXTUAL" ? entityType : undefined,
      entityId: type === "CONTEXTUAL" ? entityId : undefined,
      retentionDays: RETENTION_DEFAULTS[type],
      createdBy: auth.userId,
      members: {
        create: allMemberIds.map((uid) => ({
          userId: uid,
          role: uid === auth.userId ? "admin" : "member",
        })),
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

  return NextResponse.json(conversation, { status: 201 });
}
