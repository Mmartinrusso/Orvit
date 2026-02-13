import { z } from 'zod';

// ─── Check Permissions ─────────────────────────────────────────────────────

export const CheckPermissionsSchema = z.object({
  permissions: z
    .array(
      z.string().min(1, 'Permiso no puede estar vacío'),
      { required_error: 'Permisos es requerido' }
    )
    .min(1, 'Debe incluir al menos un permiso'),
});

// ─── Types ──────────────────────────────────────────────────────────────────

export type CheckPermissionsInput = z.infer<typeof CheckPermissionsSchema>;
