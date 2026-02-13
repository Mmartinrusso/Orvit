import { z } from 'zod';
import { coercePositiveInt, coerceOptionalPositiveInt } from './helpers';

// ─── Enums ──────────────────────────────────────────────────────────────────

export const SessionStatusSchema = z.enum(
  ['DRAFT', 'SUBMITTED', 'APPROVED', 'LOCKED'],
  { errorMap: () => ({ message: 'Estado inválido. Valores permitidos: DRAFT, SUBMITTED, APPROVED, LOCKED' }) }
);

// ─── Create ─────────────────────────────────────────────────────────────────

export const CreateDailySessionSchema = z.object({
  sectorId: coercePositiveInt('ID de sector'),
  productionDate: z.string({ required_error: 'Fecha de producción es requerida' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe tener formato YYYY-MM-DD'),
  shiftId: coerceOptionalPositiveInt,
  notes: z.string().trim().max(5000, 'Notas muy largas').optional(),
});

// ─── Update ─────────────────────────────────────────────────────────────────

export const UpdateDailySessionSchema = z.object({
  status: SessionStatusSchema.optional(),
  notes: z.string().trim().max(5000, 'Notas muy largas').optional(),
});

// ─── Types ──────────────────────────────────────────────────────────────────

export type CreateDailySessionInput = z.infer<typeof CreateDailySessionSchema>;
export type UpdateDailySessionInput = z.infer<typeof UpdateDailySessionSchema>;
