import { z } from 'zod';
import { boundedString, coercePositiveInt, optionalUrl } from './helpers';

// ─── Create ─────────────────────────────────────────────────────────────────

export const CreateSectorSchema = z.object({
  name: boundedString('Nombre', 200),
  description: z.string().trim().max(2000, 'Descripción muy larga').optional(),
  areaId: coercePositiveInt('ID de área'),
  imageUrl: z.string().url('URL de imagen inválida').optional().or(z.literal('')),
});

// ─── Types ──────────────────────────────────────────────────────────────────

export type CreateSectorInput = z.infer<typeof CreateSectorSchema>;
