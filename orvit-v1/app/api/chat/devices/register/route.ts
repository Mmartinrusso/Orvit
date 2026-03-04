/**
 * POST /api/chat/devices/register — Register push token
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayload } from "@/lib/chat/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await getAuthPayload(request);
  if (!auth || !auth.companyId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const { pushToken, platform, deviceName } = body;

  if (!pushToken || !platform) {
    return NextResponse.json(
      { error: "pushToken y platform son requeridos" },
      { status: 400 }
    );
  }

  if (!["ios", "android"].includes(platform)) {
    return NextResponse.json(
      { error: "platform debe ser ios o android" },
      { status: 400 }
    );
  }

  // Upsert: if this user+token combo already exists, just update lastUsedAt
  await prisma.userDevice.upsert({
    where: {
      userId_pushToken: {
        userId: auth.userId,
        pushToken,
      },
    },
    update: {
      isActive: true,
      lastUsedAt: new Date(),
      platform,
      deviceName,
    },
    create: {
      userId: auth.userId,
      companyId: auth.companyId,
      pushToken,
      platform,
      deviceName,
    },
  });

  return NextResponse.json({ ok: true });
}
