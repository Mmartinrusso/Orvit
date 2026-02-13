import { z, ZodSchema, ZodError } from 'zod';
import { NextResponse } from 'next/server';

/**
 * Valida los datos de una request contra un schema Zod.
 * Retorna los datos parseados si son válidos, o un NextResponse con error 400.
 */
export function validateRequest<T extends ZodSchema>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = formatZodErrors(result.error);
    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'Datos de entrada inválidos',
          details: errors,
        },
        { status: 400 }
      ),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Formatea errores de Zod en mensajes legibles en español.
 */
function formatZodErrors(error: ZodError): string[] {
  return error.errors.map((err) => {
    const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
    return `${path}${err.message}`;
  });
}

// ─── Schemas reutilizables ──────────────────────────────────────────────────

/** String que se sanitiza (trim) y no puede estar vacío */
export const trimmedString = (fieldName: string) =>
  z.string({ required_error: `${fieldName} es requerido` })
    .trim()
    .min(1, `${fieldName} es requerido`);

/** String opcional que se sanitiza (trim) */
export const optionalTrimmedString = z.string().trim().optional();

/** String con longitud máxima */
export const boundedString = (fieldName: string, max: number, min = 1) =>
  z.string({ required_error: `${fieldName} es requerido` })
    .trim()
    .min(min, `${fieldName} debe tener al menos ${min} caracteres`)
    .max(max, `${fieldName} no puede superar los ${max} caracteres`);

/** Email validado y normalizado */
export const emailSchema = z
  .string({ required_error: 'Email es requerido' })
  .trim()
  .toLowerCase()
  .email('Email inválido');

/** ID numérico positivo */
export const positiveInt = (fieldName: string) =>
  z.number({ required_error: `${fieldName} es requerido` })
    .int(`${fieldName} debe ser un número entero`)
    .positive(`${fieldName} debe ser mayor a 0`);

/** ID numérico positivo opcional (acepta null) */
export const optionalPositiveInt = z.number().int().positive().nullable().optional();

/** Número positivo (acepta decimales) */
export const positiveNumber = (fieldName: string) =>
  z.number({ required_error: `${fieldName} es requerido` })
    .positive(`${fieldName} debe ser mayor a 0`);

/** Número no negativo (>= 0) */
export const nonNegativeNumber = (fieldName: string) =>
  z.number({ required_error: `${fieldName} es requerido` })
    .min(0, `${fieldName} no puede ser negativo`);

/** Fecha ISO string */
export const isoDateString = (fieldName: string) =>
  z.string({ required_error: `${fieldName} es requerido` })
    .refine(
      (val) => !isNaN(Date.parse(val)),
      `${fieldName} debe ser una fecha válida`
    );

/** Fecha ISO string opcional */
export const optionalIsoDateString = z
  .string()
  .refine((val) => !val || !isNaN(Date.parse(val)), 'Fecha inválida')
  .nullable()
  .optional();

/** Coerce a número desde string (útil para query params y body mixtos) */
export const coercePositiveInt = (fieldName: string) =>
  z.coerce
    .number({ invalid_type_error: `${fieldName} debe ser un número` })
    .int(`${fieldName} debe ser un número entero`)
    .positive(`${fieldName} debe ser mayor a 0`);

/** Coerce a número opcional */
export const coerceOptionalPositiveInt = z.coerce
  .number()
  .int()
  .positive()
  .nullable()
  .optional();

/** Coerce a número no negativo opcional */
export const coerceOptionalNonNegative = z.coerce
  .number()
  .min(0)
  .nullable()
  .optional();

/** Porcentaje 0-100 */
export const percentageSchema = (fieldName: string) =>
  z.number()
    .min(0, `${fieldName} no puede ser negativo`)
    .max(100, `${fieldName} no puede superar 100`);

/** URL válida opcional */
export const optionalUrl = z
  .string()
  .url('URL inválida')
  .optional()
  .or(z.literal(''));

/** Mes en formato YYYY-MM */
export const monthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'Formato de mes inválido (esperado: YYYY-MM)');
