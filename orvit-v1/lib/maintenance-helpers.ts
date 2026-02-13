/**
 * Shared helpers for maintenance-related database operations
 * These are server-side only utilities for API routes
 */

import { prisma } from '@/lib/prisma';

/**
 * Get user name by ID - cached per request
 * @param userId - User ID (string or number)
 * @returns User name or null if not found
 */
export async function getUserName(userId: string | number): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { name: true }
    });
    return user?.name || null;
  } catch (error) {
    console.error('Error getting user name:', error);
    return null;
  }
}

/**
 * Get multiple user names by IDs - batch query
 * @param userIds - Array of user IDs
 * @returns Map of userId to name
 */
export async function getUserNames(userIds: number[]): Promise<Map<number, string>> {
  if (!userIds || userIds.length === 0) return new Map();

  try {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true }
    });
    return new Map(users.map(u => [u.id, u.name || `Usuario ${u.id}`]));
  } catch (error) {
    console.error('Error getting user names:', error);
    return new Map();
  }
}

/**
 * Get component names by IDs - batch query
 * @param componentIds - Array of component IDs
 * @returns Array of names in the same order as input IDs
 */
export async function getComponentNames(componentIds: number[]): Promise<string[]> {
  if (!componentIds || componentIds.length === 0) return [];

  try {
    const components = await prisma.component.findMany({
      where: { id: { in: componentIds } },
      select: { id: true, name: true }
    });

    // Maintain order of input IDs
    return componentIds.map(id => {
      const comp = components.find(c => c.id === id);
      return comp?.name || `Componente ${id}`;
    });
  } catch (error) {
    console.error('Error getting component names:', error);
    return [];
  }
}

/**
 * Get machine name by ID
 * @param machineId - Machine ID
 * @returns Machine name or null if not found
 */
export async function getMachineName(machineId: number): Promise<string | null> {
  try {
    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
      select: { name: true }
    });
    return machine?.name || null;
  } catch (error) {
    console.error('Error getting machine name:', error);
    return null;
  }
}

/**
 * Calculate next maintenance date considering weekdays only
 * @param fromDate - Starting date
 * @param frequencyDays - Days to add
 * @param weekdaysOnly - Whether to skip weekends (default: true)
 * @returns Next maintenance date adjusted to weekday
 */
export function calculateNextMaintenanceDate(
  fromDate: Date,
  frequencyDays: number,
  weekdaysOnly: boolean = true
): Date {
  const nextDate = new Date(fromDate);
  nextDate.setDate(nextDate.getDate() + frequencyDays);

  if (weekdaysOnly) {
    const dayOfWeek = nextDate.getDay();
    if (dayOfWeek === 0) { // Sunday -> Monday
      nextDate.setDate(nextDate.getDate() + 1);
    } else if (dayOfWeek === 6) { // Saturday -> Monday
      nextDate.setDate(nextDate.getDate() + 2);
    }
  }

  return nextDate;
}

/**
 * Calculate maintenance metrics
 * @param actualDuration - Actual duration in hours
 * @param estimatedDuration - Estimated duration in hours (optional)
 * @param actualValue - Actual value/quantity
 * @param estimatedValue - Estimated value/quantity
 * @returns Metrics object
 */
export function calculateMaintenanceMetrics(
  actualDuration: number,
  estimatedDuration?: number | null,
  actualValue?: number | null,
  estimatedValue?: number | null
): {
  mttr: number;
  cost: number;
  variance: number | null;
} {
  const averageHourlyRate = 25; // USD/hour - could be from config

  return {
    mttr: actualDuration,
    cost: actualDuration * averageHourlyRate,
    variance: estimatedValue && actualValue
      ? Math.round(((actualValue - estimatedValue) / estimatedValue) * 100)
      : null
  };
}
