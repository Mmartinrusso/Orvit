import { z, ZodSchema } from 'zod';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
}

// ─── Helpers de query params ────────────────────────────────────────────────

/**
 * Extrae un parámetro entero de los searchParams.
 * Retorna null si el parámetro no existe, no es un número, o no pasa la validación Zod.
 */
export function getIntParam(
  searchParams: URLSearchParams,
  name: string,
  defaultValue?: number
): number | null {
  const raw = searchParams.get(name);
  if (raw === null || raw === '') return defaultValue ?? null;

  const schema = z.coerce.number().int();
  const result = schema.safeParse(raw);
  return result.success ? result.data : null;
}

/**
 * Extrae un parámetro booleano de los searchParams.
 * Acepta 'true', '1' como true y 'false', '0' como false.
 * Retorna null si el parámetro no existe o no es un booleano válido.
 */
export function getBoolParam(
  searchParams: URLSearchParams,
  name: string,
  defaultValue?: boolean
): boolean | null {
  const raw = searchParams.get(name);
  if (raw === null || raw === '') return defaultValue ?? null;

  const lower = raw.toLowerCase();
  if (lower === 'true' || lower === '1') return true;
  if (lower === 'false' || lower === '0') return false;
  return null;
}

/**
 * Extrae un parámetro enum de los searchParams.
 * Retorna null si el parámetro no existe o no está en la lista de valores válidos.
 */
export function getEnumParam<T extends string>(
  searchParams: URLSearchParams,
  name: string,
  validValues: readonly T[],
  defaultValue?: T
): T | null {
  const raw = searchParams.get(name);
  if (raw === null || raw === '') return defaultValue ?? null;

  if ((validValues as readonly string[]).includes(raw)) {
    return raw as T;
  }
  return null;
}

/**
 * Extrae un parámetro de fecha de los searchParams.
 * Retorna un Date válido o null si el parámetro no existe o no es una fecha parseable.
 */
export function getDateParam(
  searchParams: URLSearchParams,
  name: string,
  defaultValue?: Date
): Date | null {
  const raw = searchParams.get(name);
  if (raw === null || raw === '') return defaultValue ?? null;

  const schema = z.string().refine((val) => !isNaN(Date.parse(val)));
  const result = schema.safeParse(raw);
  return result.success ? new Date(result.data) : null;
}

/**
 * Extrae un parámetro string de los searchParams con trim y longitud máxima opcional.
 * Retorna null si el parámetro no existe o está vacío tras trim.
 */
export function getStringParam(
  searchParams: URLSearchParams,
  name: string,
  options?: { maxLength?: number; defaultValue?: string }
): string | null {
  const raw = searchParams.get(name);
  if (raw === null || raw === '') return options?.defaultValue ?? null;

  let value = raw.trim();
  if (value === '') return options?.defaultValue ?? null;

  if (options?.maxLength && value.length > options.maxLength) {
    value = value.slice(0, options.maxLength);
  }

  return value;
}

/**
 * Extrae parámetros de paginación estándar (page, pageSize) con bounds automáticos.
 * - page: mínimo 1 (default 1)
 * - pageSize: entre 1 y maxPageSize (default defaultPageSize)
 * - skip: calculado automáticamente
 */
export function getPaginationParams(
  searchParams: URLSearchParams,
  options?: {
    defaultPageSize?: number;
    maxPageSize?: number;
    pageSizeParam?: string;
  }
): PaginationParams {
  const defaultPageSize = options?.defaultPageSize ?? 50;
  const maxPageSize = options?.maxPageSize ?? 100;
  const pageSizeParam = options?.pageSizeParam ?? 'pageSize';

  const rawPage = searchParams.get('page');
  const rawPageSize = searchParams.get(pageSizeParam);

  const page = Math.max(1, parseInt(rawPage || '1', 10) || 1);
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, parseInt(rawPageSize || String(defaultPageSize), 10) || defaultPageSize)
  );
  const skip = (page - 1) * pageSize;

  return { page, pageSize, skip };
}

/**
 * Valida múltiples query params de una vez contra un schema Zod.
 * Convierte los searchParams a un objeto plano antes de validar.
 * Retorna los datos parseados o null si la validación falla.
 */
export function validateQueryParams<T extends ZodSchema>(
  searchParams: URLSearchParams,
  schema: T
): { success: true; data: z.infer<T> } | { success: false; errors: string[] } {
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const result = schema.safeParse(params);

  if (!result.success) {
    const errors = result.error.errors.map((err) => {
      const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
      return `${path}${err.message}`;
    });
    return { success: false, errors };
  }

  return { success: true, data: result.data };
}
