import { z } from 'zod';
import { boundedString, coercePositiveInt } from './helpers';

// ─── Dashboard Config ───────────────────────────────────────────────────────

export const SaveDashboardConfigSchema = z.object({
  userId: coercePositiveInt('ID de usuario'),
  companyId: coercePositiveInt('ID de empresa'),
  name: z.string().trim().max(100, 'Nombre del dashboard muy largo').optional().default('Mi Dashboard'),
  layout: z.object({
    widgets: z.array(z.any()).optional().default([]),
    columns: z.number().int().min(1).max(12).optional().default(4),
  }).passthrough().optional().default({ widgets: [], columns: 4 }),
  isDefault: z.boolean().optional().default(true),
});

// ─── Types ──────────────────────────────────────────────────────────────────

export type SaveDashboardConfigInput = z.infer<typeof SaveDashboardConfigSchema>;
