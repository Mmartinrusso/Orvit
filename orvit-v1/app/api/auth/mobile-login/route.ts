/**
 * POST /api/auth/mobile-login
 *
 * Login endpoint for React Native app.
 * Returns tokens in JSON body (not cookies) for Bearer auth.
 * Refresh token expiry: 30 days (extended vs 1 day web).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as bcrypt from "bcryptjs";
import { loggers } from "@/lib/logger";
import { getUserPermissions } from "@/lib/permissions-helpers";
import { generateTokenPair } from "@/lib/auth/tokens";
import { createSession, DeviceInfo } from "@/lib/auth/sessions";
import {
  checkRateLimit,
  incrementRateLimit,
  resetRateLimit,
  getClientIdentifier,
} from "@/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

// Mobile refresh token: 30 days (vs 1 day web)
const MOBILE_REFRESH_EXPIRES_MS = 30 * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const ipAddress = getClientIdentifier(request);
  const userAgent = request.headers.get("user-agent");

  try {
    const body = await request.json();
    const email = (body.email || "").trim();
    const password = body.password || "";
    const deviceInfo: {
      platform?: string;
      deviceName?: string;
    } = body.deviceInfo || {};

    // Validate
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y contraseña son requeridos" },
        { status: 400 }
      );
    }

    // Rate limit by IP
    const rateLimitResult = await checkRateLimit(ipAddress, "login");
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: "Demasiados intentos. Intentá de nuevo más tarde.",
          retryAfter: rateLimitResult.retryAfter,
        },
        { status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfter || 60) } }
      );
    }

    // Rate limit by email
    const emailNormalized = email.toLowerCase();
    const emailRateLimit = await checkRateLimit(emailNormalized, "loginByEmail");
    if (!emailRateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Demasiados intentos para esta cuenta. Intentá de nuevo más tarde.",
          retryAfter: emailRateLimit.retryAfter,
        },
        { status: 429, headers: { "Retry-After": String(emailRateLimit.retryAfter || 60) } }
      );
    }

    // Find user
    const user = await prisma.user.findFirst({
      where: { OR: [{ email }, { name: email }] },
      include: {
        companies: { include: { company: true, role: true } },
        ownedCompanies: true,
      },
    });

    if (!user || !user.isActive || !user.password) {
      await incrementRateLimit(ipAddress, "login");
      await incrementRateLimit(emailNormalized, "loginByEmail");
      loggers.auth.warn({ ip: ipAddress, email, source: "mobile" }, "Mobile login failed");
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      await incrementRateLimit(ipAddress, "login");
      await incrementRateLimit(emailNormalized, "loginByEmail");
      loggers.auth.warn({ ip: ipAddress, email, userId: user.id, source: "mobile" }, "Mobile login: invalid password");
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    // === LOGIN SUCCESS ===
    await resetRateLimit(ipAddress, "login");
    await resetRateLimit(emailNormalized, "loginByEmail");

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Resolve company and role
    let companyId: number | undefined;
    let userRoleInCompany = user.role || "USER";
    let userSectorId: number | null = null;
    let companyName = "";

    if (user.ownedCompanies?.length) {
      companyId = user.ownedCompanies[0].id;
      companyName = user.ownedCompanies[0].name;
    } else if (user.companies?.length) {
      const uc = user.companies[0];
      companyId = uc.company.id;
      companyName = uc.company.name;
      if (uc.role) {
        userRoleInCompany = uc.role.name;
        if (uc.role.sectorId) userSectorId = uc.role.sectorId;
      }
    }

    // Create session
    const sessionDeviceInfo: DeviceInfo = {
      deviceName: deviceInfo.deviceName || `Mobile (${deviceInfo.platform || "unknown"})`,
      deviceType: "mobile",
      os: deviceInfo.platform === "ios" ? "iOS" : deviceInfo.platform === "android" ? "Android" : "Unknown",
      browser: "Orvit Mobile",
      ipAddress,
      userAgent: userAgent || undefined,
    };
    const sessionId = await createSession(user.id, sessionDeviceInfo);

    // Generate tokens
    const tokens = await generateTokenPair(
      user.id,
      user.email,
      userRoleInCompany,
      sessionId,
      companyId
    );

    // Get permissions
    const permissions = await getUserPermissions(
      user.id,
      userRoleInCompany,
      companyId || 1
    );

    loggers.auth.info(
      { userId: user.id, email: user.email, sessionId, source: "mobile" },
      "Mobile login successful"
    );

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: userRoleInCompany,
        systemRole: user.role,
        sectorId: userSectorId,
        avatar: user.avatar,
        companyId,
        companyName,
        permissions,
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessExpiresAt: tokens.accessTokenExpires.toISOString(),
        refreshExpiresAt: tokens.refreshTokenExpires.toISOString(),
      },
      sessionId,
    });
  } catch (error) {
    console.error("[MOBILE-LOGIN] Error:", error);
    loggers.auth.error({ err: error, source: "mobile" }, "Mobile login error");
    return NextResponse.json(
      { error: "Error al iniciar sesión" },
      { status: 500 }
    );
  }
}
