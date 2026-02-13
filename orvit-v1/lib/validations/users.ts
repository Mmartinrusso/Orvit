import { z } from 'zod';
import { boundedString, emailSchema, optionalTrimmedString } from './helpers';

// ─── Create ─────────────────────────────────────────────────────────────────

export const CreateUserSchema = z.object({
  name: boundedString('Nombre', 200),
  email: emailSchema,
  password: z.string({ required_error: 'Contraseña es requerida' })
    .min(6, 'La contraseña debe tener al menos 6 caracteres')
    .max(128, 'La contraseña no puede superar los 128 caracteres'),
  role: z.string().trim().max(50, 'Rol muy largo').optional(),
  isActive: z.boolean().default(true),
  companyId: z.coerce.number().int().positive().nullable().optional(),
});

// ─── Update ─────────────────────────────────────────────────────────────────

export const UpdateUserSchema = z.object({
  name: boundedString('Nombre', 200).optional(),
  email: emailSchema.optional(),
  role: z.string().trim().max(50, 'Rol muy largo').optional(),
  isActive: z.boolean().optional(),
  avatar: z.string().url('URL de avatar inválida').nullable().optional().or(z.literal('')),
  phone: z.string().trim().max(30, 'Teléfono muy largo').optional(),
  newPassword: z.string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres')
    .max(128, 'La contraseña no puede superar los 128 caracteres')
    .optional(),
});

// ─── Types ──────────────────────────────────────────────────────────────────

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
