import { z } from 'zod';
import { coercePositiveInt } from './helpers';

// ─── Enums ──────────────────────────────────────────────────────────────────

export const AllowedAreaNameSchema = z.enum(
  ['Administración', 'Mantenimiento', 'Producción'],
  { errorMap: () => ({ message: 'Área inválida. Valores permitidos: Administración, Mantenimiento, Producción' }) }
);

// ─── Create ─────────────────────────────────────────────────────────────────

export const CreateAreaSchema = z.object({
  name: AllowedAreaNameSchema,
  companyId: coercePositiveInt('ID de empresa'),
  icon: z.string().trim().max(50, 'Ícono muy largo').optional(),
  logo: z.string().url('URL de logo inválida').nullable().optional().or(z.literal('')),
});

// ─── Types ──────────────────────────────────────────────────────────────────

export type CreateAreaInput = z.infer<typeof CreateAreaSchema>;
