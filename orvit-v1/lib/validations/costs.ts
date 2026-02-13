import { z } from 'zod';

// Enums
export const MeasureKindSchema = z.enum(['UNIT', 'LENGTH', 'AREA', 'VOLUME']);
export const CostMethodSchema = z.enum(['BATCH', 'VOLUMETRIC', 'PER_UNIT_BOM']);
export const IndirectCategorySchema = z.enum(['IMP_SERV', 'SOCIAL', 'VEHICLES', 'MKT', 'OTHER']);
export const RecipeBaseSchema = z.enum(['PER_BATCH', 'PER_M3', 'PER_BANK']);

// Line schemas
export const CreateLineSchema = z.object({
  code: z.string().min(1, 'Código requerido').max(20, 'Código muy largo'),
  name: z.string().min(1, 'Nombre requerido').max(100, 'Nombre muy largo'),
});

export const UpdateLineSchema = CreateLineSchema.partial();

// Product schemas
export const CreateProductSchema = z.object({
  lineId: z.string().uuid('ID de línea inválido'),
  name: z.string().min(1, 'Nombre requerido').max(100, 'Nombre muy largo'),
  measureKind: MeasureKindSchema,
  unitLabel: z.string().min(1, 'Etiqueta de unidad requerida').max(10, 'Etiqueta muy larga'),
  costMethod: CostMethodSchema,
  active: z.boolean().default(true),
  variant: z.object({
    name: z.string().max(100, 'Nombre de variante muy largo').optional(),
  }).optional(),
});

export const UpdateProductSchema = CreateProductSchema.partial();

// Input Item schemas
export const CreateInputItemSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(100, 'Nombre muy largo'),
  unitLabel: z.string().min(1, 'Etiqueta de unidad requerida').max(10, 'Etiqueta muy larga'),
  currentPrice: z.number().positive('Precio debe ser positivo'),
  supplier: z.string().max(100, 'Proveedor muy largo').optional(),
});

export const UpdateInputItemSchema = CreateInputItemSchema.partial();

// Employee schemas
export const CreateEmployeeSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(100, 'Nombre muy largo'),
  role: z.string().min(1, 'Rol requerido').max(50, 'Rol muy largo'),
  grossSalary: z.number().positive('Salario debe ser positivo'),
  payrollTaxes: z.number().min(0, 'Cargas sociales no pueden ser negativas'),
  active: z.boolean().default(true),
});

export const UpdateEmployeeSchema = CreateEmployeeSchema.partial();

// Monthly Indirect schemas
export const CreateMonthlyIndirectSchema = z.object({
  companyId: z.number().int().positive('ID de empresa inválido'),
  category: IndirectCategorySchema,
  label: z.string().min(1, 'Etiqueta requerida').max(100, 'Etiqueta muy larga'),
  amount: z.number().positive('Monto debe ser positivo'),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Formato de mes inválido (YYYY-MM)'),
  itemId: z.string().uuid('ID de ítem inválido').optional(),
});

export const UpdateMonthlyIndirectSchema = CreateMonthlyIndirectSchema.partial();

// Global Allocation schemas
export const CreateGlobalAllocationSchema = z.object({
  category: z.enum(['EMPLEADOS', 'INDIRECTOS']),
  lineId: z.string().uuid('ID de línea inválido'),
  percent: z.number().min(0, 'Porcentaje no puede ser negativo').max(1, 'Porcentaje no puede ser mayor a 1'),
});

export const UpdateGlobalAllocationSchema = CreateGlobalAllocationSchema.partial();

// Validation for allocation percentages sum
export const AllocationsArraySchema = z.array(CreateGlobalAllocationSchema)
  .refine((allocations) => {
    const sum = allocations.reduce((acc, curr) => acc + curr.percent, 0);
    return Math.abs(sum - 1) < 0.0001; // Allow for floating point precision
  }, {
    message: 'La suma de porcentajes debe ser exactamente 100%',
  });

// Recipe schemas
export const CreateRecipeItemSchema = z.object({
  inputId: z.string().uuid('ID de insumo inválido'),
  quantity: z.number().min(0.00001, 'Cantidad debe ser mayor a 0.00001').max(999999, 'Cantidad muy alta'),
  unitLabel: z.string().min(1, 'Etiqueta de unidad requerida').max(10, 'Etiqueta muy larga'),
});

export const CreateRecipeSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(100, 'Nombre muy largo'),
  base: RecipeBaseSchema,
  scopeType: z.enum(['LINE', 'PRODUCT']),
  scopeId: z.string().uuid('ID de scope inválido'),
  version: z.number().int().positive('Versión debe ser un entero positivo'),
  description: z.string().max(500, 'Descripción muy larga').optional(),
  createdBy: z.string().max(100, 'Creador muy largo').optional(),
  items: z.array(CreateRecipeItemSchema).min(1, 'Al menos un item requerido'),
  // Nuevos campos para rendimiento
  outputQuantity: z.number().min(0.00001, 'Cantidad de productos debe ser mayor a 0.00001').max(999999, 'Cantidad muy alta').optional(),
  outputUnitLabel: z.string().min(1, 'Etiqueta de producto requerida').max(20, 'Etiqueta muy larga').optional(),
  intermediateQuantity: z.number().min(0.00001, 'Cantidad de placas debe ser mayor a 0.00001').max(999999, 'Cantidad muy alta').optional(),
  intermediateUnitLabel: z.string().min(1, 'Nombre de unidad intermedia requerido').max(20, 'Nombre muy largo').optional(),
});

export const UpdateRecipeSchema = CreateRecipeSchema.partial().extend({
  items: z.array(CreateRecipeItemSchema).min(1, 'Al menos un item requerido').optional(),
  outputQuantity: z.number().min(0.00001, 'Cantidad de productos debe ser mayor a 0.00001').max(999999, 'Cantidad muy alta').optional(),
  outputUnitLabel: z.string().min(1, 'Etiqueta de producto requerida').max(20, 'Etiqueta muy larga').optional(),
  intermediateQuantity: z.number().min(0.00001, 'Cantidad de placas debe ser mayor a 0.00001').max(999999, 'Cantidad muy alta').optional(),
  intermediateUnitLabel: z.string().min(1, 'Nombre de unidad intermedia requerido').max(20, 'Nombre muy largo').optional(),
});

export const ActivateRecipeSchema = z.object({
  recipeId: z.string().uuid('ID de receta inválido'),
});

// Yield Config schemas
export const CreateYieldConfigSchema = z.object({
  productId: z.string().uuid('ID de producto inválido'),
  usesIntermediate: z.boolean().default(false),
  // Encadenado (Batch→Intermedio→Salida)
  intermediatesPerBatch: z.number().positive().optional(),
  outputsPerIntermediate: z.number().positive().optional(),
  scrapA: z.number().min(0).max(1).optional(),
  scrapB: z.number().min(0).max(1).optional(),
  // Directo (Batch→Salida)
  outputsPerBatch: z.number().positive().optional(),
  scrapGlobal: z.number().min(0).max(1).optional(),
  // Si receta base es PER_M3
  m3PerBatch: z.number().positive().optional(),
}).refine((data) => {
  if (data.usesIntermediate) {
    return data.intermediatesPerBatch && data.outputsPerIntermediate;
  } else {
    return data.outputsPerBatch;
  }
}, {
  message: 'Debe completar campos según el modo seleccionado',
});

export const UpdateYieldConfigSchema = z.object({
  productId: z.string().uuid('ID de producto inválido').optional(),
  usesIntermediate: z.boolean().optional(),
  // Encadenado (Batch→Intermedio→Salida)
  intermediatesPerBatch: z.number().positive().optional(),
  outputsPerIntermediate: z.number().positive().optional(),
  scrapA: z.number().min(0).max(1).optional(),
  scrapB: z.number().min(0).max(1).optional(),
  // Directo (Batch→Salida)
  outputsPerBatch: z.number().positive().optional(),
  scrapGlobal: z.number().min(0).max(1).optional(),
  // Si receta base es PER_M3
  m3PerBatch: z.number().positive().optional(),
}).refine((data) => {
  if (data.usesIntermediate === true) {
    return data.intermediatesPerBatch && data.outputsPerIntermediate;
  } else if (data.usesIntermediate === false) {
    return data.outputsPerBatch;
  }
  return true; // Si usesIntermediate no está definido, no validar
}, {
  message: 'Debe completar campos según el modo seleccionado',
});

// Per Unit BOM schemas
export const CreatePerUnitBOMItemSchema = z.object({
  inputId: z.string().uuid('ID de insumo inválido'),
  qtyPerOut: z.number().positive('Cantidad por salida debe ser positiva'),
  unitLabel: z.string().min(1, 'Etiqueta de unidad requerida').max(10, 'Etiqueta muy larga'),
});

export const CreatePerUnitBOMSchema = z.object({
  productId: z.string().uuid('ID de producto inválido'),
  items: z.array(CreatePerUnitBOMItemSchema).min(1, 'Al menos un item requerido'),
});

// Volumetric Param schemas
export const CreateVolumetricParamSchema = z.object({
  productId: z.string().uuid('ID de producto inválido'),
  m3PerOutput: z.number().positive('m³ por salida debe ser positivo'),
});

export const UpdateVolumetricParamSchema = CreateVolumetricParamSchema.partial();

// Batch Run schemas
export const CreateBatchRunSchema = z.object({
  date: z.string().datetime('Fecha inválida'),
  recipeId: z.string().uuid('ID de receta inválido'),
  batches: z.number().positive('Batches debe ser positivo'),
  intermediates: z.number().positive().optional(),
  outputs: z.number().positive().optional(),
  note: z.string().max(500, 'Nota muy larga').optional(),
});

// Monthly Production schemas
export const CreateMonthlyProductionSchema = z.object({
  productId: z.string().uuid('ID de producto inválido'),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Formato de mes inválido (YYYY-MM)'),
  producedQuantity: z.number().positive('Cantidad producida debe ser positiva'),
});

export const UpdateMonthlyProductionSchema = CreateMonthlyProductionSchema.partial();

// Product Cost History schemas
export const CreateProductCostHistorySchema = z.object({
  productId: z.string().uuid('ID de producto inválido'),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Formato de mes inválido (YYYY-MM)'),
  directPerOutput: z.number().min(0, 'Costo directo no puede ser negativo'),
  indirectPerOutput: z.number().min(0, 'Costo indirecto no puede ser negativo'),
  employeesPerOutput: z.number().min(0, 'Costo de empleados no puede ser negativo'),
  totalPerOutput: z.number().min(0, 'Costo total no puede ser negativo'),
  manualOverride: z.boolean().default(false),
});



// Recalculate costs schema
export const RecalculateCostsSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Formato de mes inválido (YYYY-MM)'),
});

// Query schemas
export const MonthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Formato de mes inválido (YYYY-MM)'),
});

export const ScopeQuerySchema = z.object({
  scopeType: z.enum(['LINE', 'PRODUCT']).optional(),
  scopeId: z.string().uuid().optional(),
});

export const AllocationCategoryQuerySchema = z.object({
  category: z.enum(['EMPLEADOS', 'INDIRECTOS']),
});

// Type exports
export type CreateLineInput = z.infer<typeof CreateLineSchema>;
export type UpdateLineInput = z.infer<typeof UpdateLineSchema>;
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type CreateInputItemInput = z.infer<typeof CreateInputItemSchema>;
export type UpdateInputItemInput = z.infer<typeof UpdateInputItemSchema>;
export type CreateEmployeeInput = z.infer<typeof CreateEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeSchema>;
export type CreateMonthlyIndirectInput = z.infer<typeof CreateMonthlyIndirectSchema>;
export type UpdateMonthlyIndirectInput = z.infer<typeof UpdateMonthlyIndirectSchema>;
export type CreateGlobalAllocationInput = z.infer<typeof CreateGlobalAllocationSchema>;
export type UpdateGlobalAllocationInput = z.infer<typeof UpdateGlobalAllocationSchema>;
export type CreateRecipeInput = z.infer<typeof CreateRecipeSchema>;
export type UpdateRecipeInput = z.infer<typeof UpdateRecipeSchema>;
export type CreateYieldConfigInput = z.infer<typeof CreateYieldConfigSchema>;
export type UpdateYieldConfigInput = z.infer<typeof UpdateYieldConfigSchema>;
export type CreatePerUnitBOMInput = z.infer<typeof CreatePerUnitBOMSchema>;
export type CreateVolumetricParamInput = z.infer<typeof CreateVolumetricParamSchema>;
export type UpdateVolumetricParamInput = z.infer<typeof UpdateVolumetricParamSchema>;
export type CreateBatchRunInput = z.infer<typeof CreateBatchRunSchema>;
export type CreateMonthlyProductionInput = z.infer<typeof CreateMonthlyProductionSchema>;
export type UpdateMonthlyProductionInput = z.infer<typeof UpdateMonthlyProductionSchema>;
export type RecalculateCostsInput = z.infer<typeof RecalculateCostsSchema>;
