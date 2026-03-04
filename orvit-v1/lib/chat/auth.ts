/**
 * Chat auth helpers — supports both cookie (web) and Bearer token (mobile).
 */

import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { JWT_SECRET } from "@/lib/auth";

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

interface TokenPayload {
  userId: number;
  email: string;
  role: string;
  companyId?: number;
  sessionId?: string;
}

/**
 * Extract and verify JWT from cookies or Authorization header.
 * Returns the decoded payload or null if invalid.
 */
export async function getAuthPayload(
  request: NextRequest
): Promise<TokenPayload | null> {
  let token: string | undefined;

  // Try Bearer header first (mobile)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }

  // Fall back to cookies (web)
  if (!token) {
    try {
      const cookieStore = await cookies();
      token =
        cookieStore.get("accessToken")?.value ||
        cookieStore.get("token")?.value;
    } catch {
      // cookies() can throw outside request context
    }
  }

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    const userId = payload.userId as number;
    if (!userId) return null;

    return {
      userId,
      email: payload.email as string,
      role: payload.role as string,
      companyId: payload.companyId as number | undefined,
      sessionId: payload.sessionId as string | undefined,
    };
  } catch {
    return null;
  }
}
