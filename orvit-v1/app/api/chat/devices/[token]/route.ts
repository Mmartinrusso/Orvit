/**
 * DELETE /api/chat/devices/:token — Unregister push token
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayload } from "@/lib/chat/auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const auth = await getAuthPayload(request);
  if (!auth) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { token } = await params;

  await prisma.userDevice.updateMany({
    where: {
      userId: auth.userId,
      pushToken: decodeURIComponent(token),
    },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}
