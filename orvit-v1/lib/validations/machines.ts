import { z } from 'zod';
import { boundedString, optionalTrimmedString, isoDateString, coercePositiveInt } from './helpers';

// ─── Enums ──────────────────────────────────────────────────────────────────

export const MachineStatusSchema = z.enum(
  ['OPERATIONAL', 'MAINTENANCE', 'OUT_OF_SERVICE'],
  { errorMap: () => ({ message: 'Estado inválido. Valores permitidos: OPERATIONAL, MAINTENANCE, OUT_OF_SERVICE' }) }
);

// ─── Create ─────────────────────────────────────────────────────────────────

export const CreateMachineSchema = z.object({
  name: boundedString('Nombre', 200),
  nickname: z.string().trim().max(200, 'Apodo muy largo').optional(),
  aliases: z.string().trim().max(500, 'Alias muy largo').nullable().optional(),
  type: boundedString('Tipo', 100),
  description: z.string().trim().max(2000, 'Descripción muy larga').optional(),
  brand: boundedString('Marca', 100),
  model: z.string().trim().max(100, 'Modelo muy largo').optional(),
  serialNumber: z.string().trim().max(100, 'Número de serie muy largo').optional(),
  status: MachineStatusSchema,
  acquisitionDate: isoDateString('Fecha de adquisición'),
  companyId: coercePositiveInt('ID de empresa'),
  sectorId: coercePositiveInt('ID de sector'),
  photo: z.string().url('URL de foto inválida').optional().or(z.literal('')).or(z.null()),
  logo: z.string().url('URL de logo inválida').optional().or(z.literal('')).or(z.null()),
});

// ─── Update ─────────────────────────────────────────────────────────────────

export const UpdateMachineSchema = CreateMachineSchema.partial();

// ─── Types ──────────────────────────────────────────────────────────────────

export type CreateMachineInput = z.infer<typeof CreateMachineSchema>;
export type UpdateMachineInput = z.infer<typeof UpdateMachineSchema>;
