import { z } from 'zod';
import { boundedString } from './helpers';

// ─── Enums ──────────────────────────────────────────────────────────────────

export const FeedbackTypeSchema = z.enum(
  ['problema', 'mejora', 'nueva-idea'],
  { errorMap: () => ({ message: 'Tipo inválido. Valores permitidos: problema, mejora, nueva-idea' }) }
);

export const FeedbackPrioritySchema = z.enum(
  ['baja', 'media', 'alta'],
  { errorMap: () => ({ message: 'Prioridad inválida. Valores permitidos: baja, media, alta' }) }
);

// ─── Create ─────────────────────────────────────────────────────────────────

export const CreateFeedbackSchema = z.object({
  type: FeedbackTypeSchema,
  priority: FeedbackPrioritySchema.default('media'),
  title: boundedString('Título', 200),
  description: boundedString('Descripción', 5000),
});

// ─── Types ──────────────────────────────────────────────────────────────────

export type CreateFeedbackInput = z.infer<typeof CreateFeedbackSchema>;
