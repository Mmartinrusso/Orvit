import { z } from 'zod';
import { boundedString, sanitizedBoundedString, sanitizedOptionalString, optionalTrimmedString } from './helpers';

// ─── Enums ──────────────────────────────────────────────────────────────────

export const ProductCostTypeSchema = z.enum(
  ['MANUAL', 'PRODUCTION', 'PURCHASE'],
  { errorMap: () => ({ message: 'Tipo de costo inválido. Valores permitidos: MANUAL, PRODUCTION, PURCHASE' }) }
);

export const CurrencySchema = z.enum(
  ['ARS', 'USD'],
  { errorMap: () => ({ message: 'Moneda inválida. Valores permitidos: ARS, USD' }) }
);

export const VolumeUnitSchema = z.enum(
  ['metros_lineales', 'metros_cuadrados'],
  { errorMap: () => ({ message: 'Unidad de volumen inválida' }) }
);

// ─── Create ─────────────────────────────────────────────────────────────────

export const CreateProductSchema = z.object({
  name: sanitizedBoundedString('Nombre', 300),
  code: sanitizedBoundedString('Código', 100),
  categoryId: z.union([
    z.number().int().positive('ID de categoría inválido'),
    z.string().min(1, 'ID de categoría es requerido'),
  ]),
  description: sanitizedOptionalString(2000, 'Descripción'),
  unit: z.string().trim().max(50, 'Unidad muy larga').optional(),
  costPrice: z.coerce.number().min(0, 'Precio de costo no puede ser negativo').optional(),
  costCurrency: CurrencySchema.default('ARS'),
  costType: ProductCostTypeSchema.default('MANUAL'),
  recipeId: z.string().optional().nullable(),
  purchaseInputId: z.string().optional().nullable(),
  minStock: z.coerce.number().int().min(0, 'Stock mínimo no puede ser negativo').optional(),
  currentStock: z.coerce.number().int().min(0, 'Stock actual no puede ser negativo').optional(),
  volume: z.coerce.number().min(0, 'Volumen no puede ser negativo').optional(),
  weight: z.coerce.number().min(0, 'Peso no puede ser negativo').optional(),
  location: sanitizedOptionalString(200, 'Ubicación'),
  blocksPerM2: z.coerce.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
  images: z.array(z.string()).optional(),
  files: z.array(z.string()).optional(),
  salePrice: z.coerce.number().min(0, 'Precio de venta no puede ser negativo').nullable().optional(),
  saleCurrency: CurrencySchema.default('ARS'),
  marginMin: z.coerce.number().min(0).nullable().optional(),
  marginMax: z.coerce.number().min(0).nullable().optional(),
  barcode: sanitizedOptionalString(100, 'Código de barras'),
  sku: sanitizedOptionalString(100, 'SKU'),
  trackBatches: z.boolean().default(false),
  trackExpiration: z.boolean().default(false),
  tags: z.array(z.string()).optional(),
  productionSectorId: z.coerce.number().int().positive().nullable().optional(),
  productionWorkCenterId: z.coerce.number().int().positive().nullable().optional(),
  volumeUnit: VolumeUnitSchema.optional(),
}).refine(
  (data) => {
    if (data.costType === 'PRODUCTION' && !data.recipeId) return false;
    return true;
  },
  { message: 'Debe seleccionar una receta para productos de producción', path: ['recipeId'] }
).refine(
  (data) => {
    if (data.costType === 'PURCHASE' && !data.purchaseInputId) return false;
    return true;
  },
  { message: 'Debe seleccionar un insumo de compra', path: ['purchaseInputId'] }
);

// ─── Update ─────────────────────────────────────────────────────────────────

export const UpdateProductSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  name: sanitizedBoundedString('Nombre', 300).optional(),
  code: sanitizedBoundedString('Código', 100).optional(),
  categoryId: z.union([
    z.number().int().positive(),
    z.string().min(1),
  ]).optional(),
  description: sanitizedOptionalString(2000, 'Descripción'),
  unit: z.string().trim().max(50, 'Unidad muy larga').optional(),
  costPrice: z.coerce.number().min(0, 'Precio de costo no puede ser negativo').optional(),
  costCurrency: CurrencySchema.optional(),
  costType: ProductCostTypeSchema.optional(),
  recipeId: z.string().nullable().optional(),
  purchaseInputId: z.string().nullable().optional(),
  minStock: z.coerce.number().int().min(0).optional(),
  currentStock: z.coerce.number().int().min(0).optional(),
  volume: z.coerce.number().min(0).optional(),
  weight: z.coerce.number().min(0).optional(),
  location: sanitizedOptionalString(200, 'Ubicación'),
  blocksPerM2: z.coerce.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  images: z.array(z.string()).optional(),
  files: z.array(z.string()).optional(),
  image: z.string().nullable().optional(),
  salePrice: z.coerce.number().min(0).nullable().optional(),
  saleCurrency: CurrencySchema.optional(),
  marginMin: z.coerce.number().min(0).nullable().optional(),
  marginMax: z.coerce.number().min(0).nullable().optional(),
  barcode: sanitizedOptionalString(100, 'Código de barras'),
  sku: sanitizedOptionalString(100, 'SKU'),
  trackBatches: z.boolean().optional(),
  trackExpiration: z.boolean().optional(),
  alertStockEmail: z.boolean().optional(),
  alertStockDays: z.number().int().min(0).nullable().optional(),
  tags: z.array(z.string()).optional(),
  productionSectorId: z.coerce.number().int().positive().nullable().optional(),
  productionWorkCenterId: z.coerce.number().int().positive().nullable().optional(),
  volumeUnit: VolumeUnitSchema.optional(),
});

// ─── Types ──────────────────────────────────────────────────────────────────

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
