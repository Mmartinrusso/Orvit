import { prisma } from '@/lib/prisma';

/**
 * Registra una métrica de negocio en la base de datos.
 * Patrón fire-and-forget: nunca afecta la operación principal.
 */
export async function trackMetric(
  name: string,
  value: number,
  companyId: number,
  options?: {
    unit?: string;
    tags?: Record<string, unknown>;
    userId?: number;
  }
): Promise<void> {
  try {
    await prisma.businessMetric.create({
      data: {
        name,
        value,
        unit: options?.unit ?? null,
        tags: options?.tags ?? undefined,
        companyId,
        userId: options?.userId ?? null,
      },
    });
  } catch (error) {
    console.error(`[metrics] Error tracking "${name}":`, error);
  }
}

/**
 * Registra un evento de conteo (value=1).
 * Uso: trackCount('work_orders_created', companyId, { tags: { type: 'CORRECTIVE' } })
 */
export async function trackCount(
  name: string,
  companyId: number,
  options?: {
    tags?: Record<string, unknown>;
    userId?: number;
  }
): Promise<void> {
  return trackMetric(name, 1, companyId, { unit: 'count', ...options });
}

/**
 * Registra una duración en milisegundos.
 * Uso: trackDuration('resolution_time', durationMs, companyId)
 */
export async function trackDuration(
  name: string,
  durationMs: number,
  companyId: number,
  options?: {
    tags?: Record<string, unknown>;
    userId?: number;
  }
): Promise<void> {
  return trackMetric(name, durationMs, companyId, { unit: 'ms', ...options });
}
