/**
 * GET /api/chat/users — List company users for chat (no special permission required)
 *
 * Returns minimal user data (id, name, email, role, isActive, avatar) for
 * creating conversations and adding members. Uses Bearer token auth (mobile)
 * or cookies (web).
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

  try {
    const userCompanies = await prisma.userOnCompany.findMany({
      where: { companyId: auth.companyId, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            avatar: true,
          },
        },
        role: { select: { name: true, displayName: true } },
      },
    });

    const users = userCompanies
      .filter((uc) => uc.user.isActive && uc.user.role !== "SUPERADMIN")
      .map((uc) => ({
        id: uc.user.id,
        name: uc.user.name,
        email: uc.user.email,
        role: uc.role?.displayName || uc.role?.name || uc.user.role || "User",
        isActive: uc.user.isActive,
        avatar: uc.user.avatar,
      }));

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error in GET /api/chat/users:", error);
    return NextResponse.json([], { status: 200 });
  }
}
