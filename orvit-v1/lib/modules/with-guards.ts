/**
 * API Guard Middleware
 * Higher-order function to wrap API handlers with module and ViewMode protection
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { getViewMode, ViewMode } from '@/lib/view-mode';
import {
  checkModulesEnabled,
  createModuleDisabledResponse,
  getRouteModules,
} from './api-guard';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// API handler type
type ApiHandler = (
  request: NextRequest,
  context?: { params?: Record<string, string> }
) => Promise<NextResponse>;

// Extended request with auth context
export interface AuthContext {
  userId: number;
  companyId: number;
  role: string;
  viewMode: ViewMode;
}

interface GuardOptions {
  modules?: string[];           // Required modules (overrides auto-detection)
  skipModuleCheck?: boolean;    // Skip module verification
  requireAuth?: boolean;        // Require authentication (default: true)
}

/**
 * Get auth context from request
 */
async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    const userId = payload.userId as number;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        companies: {
          select: {
            companyId: true,
            role: { select: { name: true } }
          },
          take: 1
        }
      }
    });

    if (!user || !user.companies?.[0]) return null;

    const viewMode = getViewMode(request);

    return {
      userId: user.id,
      companyId: user.companies[0].companyId,
      role: String(user.role || user.companies[0].role?.name || 'USER'),
      viewMode,
    };
  } catch (error) {
    console.error('[WithGuards] Auth error:', error);
    return null;
  }
}

/**
 * Create unauthorized response
 */
function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: 'No autorizado', code: 'UNAUTHORIZED' },
    { status: 401 }
  );
}

/**
 * Check if user is SUPERADMIN
 */
function isSuperAdmin(role: string): boolean {
  return role.toUpperCase() === 'SUPERADMIN';
}

/**
 * Higher-order function to wrap API handlers with guards
 *
 * @example
 * // With explicit modules
 * export const GET = withGuards(async (request) => {
 *   // handler logic
 * }, { modules: ['purchases_core', 'stock_management'] });
 *
 * @example
 * // With auto-detection from route
 * export const GET = withGuards(async (request) => {
 *   // modules auto-detected from API_ROUTE_MODULES
 * });
 */
export function withGuards(
  handler: ApiHandler,
  options: GuardOptions = {}
): ApiHandler {
  const { modules, skipModuleCheck = false, requireAuth = true } = options;

  return async (request: NextRequest, context?: { params?: Record<string, string> }) => {
    try {
      const auth = await getAuthContext(request);

      if (requireAuth && !auth) {
        return unauthorized();
      }

      // SUPERADMIN bypasses all checks
      if (auth && isSuperAdmin(auth.role)) {
        return handler(request, context);
      }

      // Module verification (if not skipped and user is authenticated)
      if (!skipModuleCheck && auth) {
        let requiredModules = modules;

        if (!requiredModules) {
          const pathname = new URL(request.url).pathname;
          requiredModules = getRouteModules(pathname);
        }

        if (requiredModules && requiredModules.length > 0) {
          const { allowed, missing } = await checkModulesEnabled(
            auth.companyId,
            requiredModules
          );

          if (!allowed) {
            return createModuleDisabledResponse(missing, auth.companyId);
          }
        }
      }

      return handler(request, context);
    } catch (error) {
      return NextResponse.json(
        { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
        { status: 500 }
      );
    }
  };
}

/**
 * Convenience wrapper for Compras APIs
 */
export function withComprasGuards(
  handler: ApiHandler,
  additionalModules: string[] = []
): ApiHandler {
  return withGuards(handler, {
    modules: ['purchases_core', ...additionalModules],
  });
}

/**
 * Convenience wrapper for Ventas APIs
 */
export function withVentasGuards(
  handler: ApiHandler,
  additionalModules: string[] = []
): ApiHandler {
  return withGuards(handler, {
    modules: ['sales_core', ...additionalModules],
  });
}

/**
 * Convenience wrapper for Stock APIs
 */
export function withStockGuards(
  handler: ApiHandler,
  additionalModules: string[] = []
): ApiHandler {
  return withGuards(handler, {
    modules: ['purchases_core', 'stock_management', ...additionalModules],
  });
}

/**
 * Convenience wrapper for Tesoreria APIs
 */
export function withTesoreriaGuards(handler: ApiHandler): ApiHandler {
  return withGuards(handler, {
    modules: ['tesoreria'],
  });
}

/**
 * Convenience wrapper for Maintenance APIs
 */
export function withMaintenanceGuards(
  handler: ApiHandler,
  additionalModules: string[] = []
): ApiHandler {
  return withGuards(handler, {
    modules: ['maintenance_core', ...additionalModules],
  });
}
