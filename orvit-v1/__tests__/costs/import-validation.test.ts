import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Schema de validación para importación de producción
const ProductionImportRowSchema = z.object({
  productCode: z.string().min(1, 'Código de producto requerido'),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Formato de mes inválido (YYYY-MM)'),
  quantity: z.number().min(0, 'Cantidad debe ser positiva'),
  notes: z.string().optional(),
});

// Schema de validación para importación de empleados
const EmployeeImportRowSchema = z.object({
  documentOrCode: z.string().min(1, 'Documento o código requerido'),
  name: z.string().min(2, 'Nombre debe tener al menos 2 caracteres'),
  role: z.string().min(2, 'Rol debe tener al menos 2 caracteres'),
  grossSalary: z.number().min(0, 'Salario bruto debe ser positivo'),
  payrollTaxes: z.number().min(0, 'Cargas patronales deben ser positivas'),
  effectiveFrom: z.coerce.date(),
});

describe('Import Validation Tests', () => {
  describe('Production Import Validation', () => {
    it('should validate correct production data', () => {
      const validData = {
        productCode: 'PROD001',
        month: '2024-01',
        quantity: 100,
        notes: 'Test production',
      };

      const result = ProductionImportRowSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid month format', () => {
      const invalidData = {
        productCode: 'PROD001',
        month: '2024/01', // Invalid format
        quantity: 100,
      };

      const result = ProductionImportRowSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain('Formato de mes inválido');
    });

    it('should reject negative quantities', () => {
      const invalidData = {
        productCode: 'PROD001',
        month: '2024-01',
        quantity: -10, // Invalid negative
      };

      const result = ProductionImportRowSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain('Cantidad debe ser positiva');
    });

    it('should reject empty product code', () => {
      const invalidData = {
        productCode: '', // Empty code
        month: '2024-01',
        quantity: 100,
      };

      const result = ProductionImportRowSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain('Código de producto requerido');
    });

    it('should accept optional notes', () => {
      const validData = {
        productCode: 'PROD001',
        month: '2024-01',
        quantity: 100,
        // notes is optional
      };

      const result = ProductionImportRowSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('Employee Import Validation', () => {
    it('should validate correct employee data', () => {
      const validData = {
        documentOrCode: '12345678',
        name: 'Juan Pérez',
        role: 'Operario',
        grossSalary: 500000,
        payrollTaxes: 150000,
        effectiveFrom: '2024-01-01',
      };

      const result = EmployeeImportRowSchema.safeParse(validData);
      expect(result.success).toBe(true);
      expect(result.data?.effectiveFrom).toBeInstanceOf(Date);
    });

    it('should reject short names', () => {
      const invalidData = {
        documentOrCode: '12345678',
        name: 'A', // Too short
        role: 'Operario',
        grossSalary: 500000,
        payrollTaxes: 150000,
        effectiveFrom: '2024-01-01',
      };

      const result = EmployeeImportRowSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain('al menos 2 caracteres');
    });

    it('should reject negative salaries', () => {
      const invalidData = {
        documentOrCode: '12345678',
        name: 'Juan Pérez',
        role: 'Operario',
        grossSalary: -100, // Invalid negative
        payrollTaxes: 150000,
        effectiveFrom: '2024-01-01',
      };

      const result = EmployeeImportRowSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain('Salario bruto debe ser positivo');
    });

    it('should reject negative payroll taxes', () => {
      const invalidData = {
        documentOrCode: '12345678',
        name: 'Juan Pérez',
        role: 'Operario',
        grossSalary: 500000,
        payrollTaxes: -50000, // Invalid negative
        effectiveFrom: '2024-01-01',
      };

      const result = EmployeeImportRowSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain('Cargas patronales deben ser positivas');
    });

    it('should parse date strings correctly', () => {
      const validData = {
        documentOrCode: '12345678',
        name: 'Juan Pérez',
        role: 'Operario',
        grossSalary: 500000,
        payrollTaxes: 150000,
        effectiveFrom: '2024-01-15',
      };

      const result = EmployeeImportRowSchema.safeParse(validData);
      expect(result.success).toBe(true);
      expect(result.data?.effectiveFrom.getFullYear()).toBe(2024);
      expect(result.data?.effectiveFrom.getMonth()).toBe(0); // January (0-indexed)
      expect(result.data?.effectiveFrom.getDate()).toBe(15);
    });

    it('should reject invalid date formats', () => {
      const invalidData = {
        documentOrCode: '12345678',
        name: 'Juan Pérez',
        role: 'Operario',
        grossSalary: 500000,
        payrollTaxes: 150000,
        effectiveFrom: 'invalid-date',
      };

      const result = EmployeeImportRowSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('Data Normalization', () => {
    it('should handle numeric strings for quantities', () => {
      const dataWithStringNumber = {
        productCode: 'PROD001',
        month: '2024-01',
        quantity: '150.5', // String number
      };

      // Simulate the normalization that happens in the API
      const normalizedData = {
        ...dataWithStringNumber,
        quantity: parseFloat(dataWithStringNumber.quantity),
      };

      const result = ProductionImportRowSchema.safeParse(normalizedData);
      expect(result.success).toBe(true);
      expect(result.data?.quantity).toBe(150.5);
    });

    it('should handle numeric strings for salaries', () => {
      const dataWithStringNumbers = {
        documentOrCode: '12345678',
        name: 'Juan Pérez',
        role: 'Operario',
        grossSalary: '500000.50', // String number
        payrollTaxes: '150000.25', // String number
        effectiveFrom: '2024-01-01',
      };

      // Simulate the normalization that happens in the API
      const normalizedData = {
        ...dataWithStringNumbers,
        grossSalary: parseFloat(dataWithStringNumbers.grossSalary),
        payrollTaxes: parseFloat(dataWithStringNumbers.payrollTaxes),
      };

      const result = EmployeeImportRowSchema.safeParse(normalizedData);
      expect(result.success).toBe(true);
      expect(result.data?.grossSalary).toBe(500000.50);
      expect(result.data?.payrollTaxes).toBe(150000.25);
    });
  });
});
