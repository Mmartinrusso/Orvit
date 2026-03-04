/**
 * GET /api/chat/conversations/:id/ancestors — Breadcrumb chain from root to current
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayload } from "@/lib/chat/auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthPayload(request);
  if (!auth) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  // Walk up the hierarchy (max 5 levels)
  const ancestors: { id: string; name: string | null; iconName: string | null; depth: number }[] = [];
  let currentId: string | null = id;

  for (let i = 0; i < 5 && currentId; i++) {
    const conv = await prisma.conversation.findUnique({
      where: { id: currentId },
      select: { id: true, name: true, iconName: true, depth: true, parentId: true },
    });
    if (!conv) break;
    ancestors.unshift({ id: conv.id, name: conv.name, iconName: conv.iconName, depth: conv.depth });
    currentId = conv.parentId;
  }

  return NextResponse.json({ ancestors });
}
