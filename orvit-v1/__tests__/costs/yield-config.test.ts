import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Schema actualizado de YieldConfig
const UpdateYieldConfigSchema = z.object({
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

describe('YieldConfig Validation Tests', () => {
  describe('Intermediate Mode Configuration', () => {
    it('should validate complete intermediate mode configuration', () => {
      const validConfig = {
        usesIntermediate: true,
        intermediatesPerBatch: 10,
        outputsPerIntermediate: 5,
        scrapA: 0.05, // 5% scrap batch→intermediate
        scrapB: 0.03, // 3% scrap intermediate→output
      };

      const result = UpdateYieldConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should reject intermediate mode without required fields', () => {
      const invalidConfig = {
        usesIntermediate: true,
        intermediatesPerBatch: 10,
        // Missing outputsPerIntermediate
        scrapA: 0.05,
      };

      const result = UpdateYieldConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain('Debe completar campos según el modo seleccionado');
    });

    it('should reject intermediate mode with missing intermediatesPerBatch', () => {
      const invalidConfig = {
        usesIntermediate: true,
        // Missing intermediatesPerBatch
        outputsPerIntermediate: 5,
        scrapA: 0.05,
      };

      const result = UpdateYieldConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });

  describe('Direct Mode Configuration', () => {
    it('should validate complete direct mode configuration', () => {
      const validConfig = {
        usesIntermediate: false,
        outputsPerBatch: 50,
        scrapGlobal: 0.04, // 4% global scrap
      };

      const result = UpdateYieldConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should reject direct mode without outputsPerBatch', () => {
      const invalidConfig = {
        usesIntermediate: false,
        // Missing outputsPerBatch
        scrapGlobal: 0.04,
      };

      const result = UpdateYieldConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain('Debe completar campos según el modo seleccionado');
    });
  });

  describe('Scrap Percentage Validation', () => {
    it('should accept valid scrap percentages (0-1 range)', () => {
      const validConfig = {
        usesIntermediate: true,
        intermediatesPerBatch: 10,
        outputsPerIntermediate: 5,
        scrapA: 0.0, // 0% - minimum valid
        scrapB: 1.0, // 100% - maximum valid
      };

      const result = UpdateYieldConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should reject scrap percentages below 0', () => {
      const invalidConfig = {
        usesIntermediate: true,
        intermediatesPerBatch: 10,
        outputsPerIntermediate: 5,
        scrapA: -0.1, // Invalid negative
      };

      const result = UpdateYieldConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject scrap percentages above 1', () => {
      const invalidConfig = {
        usesIntermediate: false,
        outputsPerBatch: 50,
        scrapGlobal: 1.5, // Invalid > 100%
      };

      const result = UpdateYieldConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });

  describe('Per M3 Configuration', () => {
    it('should accept m3PerBatch for volumetric recipes', () => {
      const validConfig = {
        usesIntermediate: false,
        outputsPerBatch: 100,
        m3PerBatch: 2.5, // 2.5 m³ per batch
      };

      const result = UpdateYieldConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should reject negative m3PerBatch', () => {
      const invalidConfig = {
        usesIntermediate: false,
        outputsPerBatch: 100,
        m3PerBatch: -1.0, // Invalid negative
      };

      const result = UpdateYieldConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject zero m3PerBatch', () => {
      const invalidConfig = {
        usesIntermediate: false,
        outputsPerBatch: 100,
        m3PerBatch: 0, // Invalid zero
      };

      const result = UpdateYieldConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });

  describe('Undefined Mode (Partial Updates)', () => {
    it('should allow partial updates without usesIntermediate', () => {
      const partialConfig = {
        scrapGlobal: 0.05, // Only updating scrap percentage
      };

      const result = UpdateYieldConfigSchema.safeParse(partialConfig);
      expect(result.success).toBe(true);
    });

    it('should allow partial updates with some fields', () => {
      const partialConfig = {
        outputsPerBatch: 75,
        m3PerBatch: 3.0,
      };

      const result = UpdateYieldConfigSchema.safeParse(partialConfig);
      expect(result.success).toBe(true);
    });
  });

  describe('Production Calculation Examples', () => {
    it('should calculate intermediate mode production correctly', () => {
      const config = {
        usesIntermediate: true,
        intermediatesPerBatch: 20, // 20 placas per batea
        outputsPerIntermediate: 4, // 4 units per placa
        scrapA: 0.05, // 5% loss batea→placa
        scrapB: 0.02, // 2% loss placa→unit
      };

      const result = UpdateYieldConfigSchema.safeParse(config);
      expect(result.success).toBe(true);

      // Calculation: 1 batea → 20 placas → 80 units
      // With scrap: 20 * (1-0.05) * 4 * (1-0.02) = 19 * 4 * 0.98 = 74.48 units
      const effectiveIntermediates = config.intermediatesPerBatch * (1 - config.scrapA);
      const finalOutputs = effectiveIntermediates * config.outputsPerIntermediate * (1 - config.scrapB);
      
      expect(Math.round(finalOutputs * 100) / 100).toBe(74.48);
    });

    it('should calculate direct mode production correctly', () => {
      const config = {
        usesIntermediate: false,
        outputsPerBatch: 80, // 80 units per batea
        scrapGlobal: 0.07, // 7% global scrap
      };

      const result = UpdateYieldConfigSchema.safeParse(config);
      expect(result.success).toBe(true);

      // Calculation: 1 batea → 80 units with 7% scrap = 74.4 units
      const finalOutputs = config.outputsPerBatch * (1 - config.scrapGlobal);
      expect(Math.round(finalOutputs * 100) / 100).toBe(74.4);
    });
  });
});
