/**
 * Preference Permission Verification
 * Server-side permission checks
 */

import { prisma } from '@/lib/prisma';
import { hasUserPermission } from '@/lib/permissions-helpers';

// Permission constants (obfuscated names)
export const VIEW_MODE_PERMISSIONS = {
  EXTENDED: 'pref.l2',      // Level 2 access
  CREATE_T2: 'pref.adv',    // Advanced creation
  CONFIG: 'pref.cfg',       // Configuration access
  LOGS: 'pref.aud',         // Audit access (SUPERADMIN only)
} as const;

/**
 * Check if user can activate level 2 mode
 */
export async function canActivateExtended(
  userId: number,
  companyId: number
): Promise<boolean> {
  return hasUserPermission(userId, companyId, VIEW_MODE_PERMISSIONS.EXTENDED);
}

/**
 * Check if user can create advanced documents
 */
export async function canCreateT2(
  userId: number,
  companyId: number
): Promise<boolean> {
  return hasUserPermission(userId, companyId, VIEW_MODE_PERMISSIONS.CREATE_T2);
}

/**
 * Check if user can configure preference settings
 */
export async function canConfigureViewMode(
  userId: number,
  companyId: number
): Promise<boolean> {
  return hasUserPermission(userId, companyId, VIEW_MODE_PERMISSIONS.CONFIG);
}

/**
 * Check if user can view preference audit logs
 */
export async function canViewLogs(
  userId: number,
  companyId: number
): Promise<boolean> {
  return hasUserPermission(userId, companyId, VIEW_MODE_PERMISSIONS.LOGS);
}

/**
 * Get company preference configuration
 * Returns null if not configured or user doesn't have permission
 */
export async function getCompanyViewConfig(
  userId: number,
  companyId: number
): Promise<{
  enabled: boolean;
  hotkey?: string;
  sessionTimeout: number;
} | null> {
  // Check permission first
  const hasPermission = await canActivateExtended(userId, companyId);

  if (!hasPermission) {
    return null;
  }

  const config = await prisma.companyViewConfig.findUnique({
    where: { companyId },
    select: {
      enabled: true,
      hotkey: true,
      sessionTimeout: true,
    },
  });

  if (!config || !config.enabled) {
    return null;
  }

  return {
    enabled: config.enabled,
    hotkey: config.hotkey ?? undefined,
    sessionTimeout: config.sessionTimeout,
  };
}

/**
 * Check if PIN is required for preference activation
 * Returns true if PIN is configured, false if no PIN required
 */
export async function isPinRequired(companyId: number): Promise<boolean> {
  const config = await prisma.companyViewConfig.findUnique({
    where: { companyId },
    select: { pinHash: true, enabled: true },
  });

  // PIN is required only if enabled and pinHash exists
  return !!(config?.enabled && config?.pinHash);
}

/**
 * Verify PIN for preference activation
 * Returns true if PIN matches OR if no PIN is configured
 */
export async function verifyViewModePin(
  companyId: number,
  pin: string | null | undefined
): Promise<boolean> {
  const bcrypt = await import('bcryptjs');

  const config = await prisma.companyViewConfig.findUnique({
    where: { companyId },
    select: { pinHash: true, enabled: true },
  });

  if (!config || !config.enabled) {
    return false;
  }

  // If no PIN is configured, allow access without verification
  if (!config.pinHash) {
    return true;
  }

  // PIN is required but not provided
  if (!pin) {
    return false;
  }

  return bcrypt.compare(pin, config.pinHash);
}

/**
 * Log preference action to audit table
 */
export async function logViewModeAction(
  userId: number,
  companyId: number,
  action: 'ACTIVATE' | 'DEACTIVATE' | 'FAILED_PIN',
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await prisma.viewModeLog.create({
    data: {
      userId,
      companyId,
      action,
      ipAddress,
      userAgent,
    },
  });
}
