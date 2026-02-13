import { z } from 'zod';
import { boundedString, optionalTrimmedString, optionalUrl } from './helpers';

// ─── Enums ──────────────────────────────────────────────────────────────────

export const ContactCategorySchema = z.enum(
  ['Personal', 'Proveedor', 'Cliente', 'Empleado', 'Servicio Técnico', 'Otro'],
  { errorMap: () => ({ message: 'Categoría de contacto inválida. Valores: Personal, Proveedor, Cliente, Empleado, Servicio Técnico, Otro' }) }
);

// ─── Contact Email (optional, nullable, or valid email) ─────────────────────

const optionalEmail = z.union([
  z.string().trim().toLowerCase().email('Email inválido'),
  z.literal(''),
  z.null(),
]).optional();

// ─── Create Contact ─────────────────────────────────────────────────────────

export const CreateContactSchema = z.object({
  name: boundedString('Nombre', 200),
  email: optionalEmail,
  phone: z.string().trim().max(50, 'Teléfono muy largo').optional().or(z.literal('')).or(z.null()),
  company: z.string().trim().max(200, 'Nombre de empresa muy largo').optional().or(z.literal('')).or(z.null()),
  position: z.string().trim().max(200, 'Cargo muy largo').optional().or(z.literal('')).or(z.null()),
  notes: z.string().trim().max(5000, 'Notas muy largas').optional().or(z.literal('')).or(z.null()),
  avatar: optionalUrl.or(z.null()),
  category: ContactCategorySchema.default('Personal'),
  tags: z.array(
    z.string().trim().max(50, 'Tag muy largo')
  ).max(20, 'Máximo 20 tags').optional().default([]),
});

// ─── Update Contact (same required fields as Create per API behavior) ───────

export const UpdateContactSchema = CreateContactSchema;

// ─── Types ──────────────────────────────────────────────────────────────────

export type CreateContactInput = z.infer<typeof CreateContactSchema>;
export type UpdateContactInput = z.infer<typeof UpdateContactSchema>;
