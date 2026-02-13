import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { getEffectiveInputPrice, getEffectiveEmployeeComp } from '@/lib/costs/calculator';

const prisma = new PrismaClient();

describe('Price History Tests', () => {
  let testCompanyId: number;
  let testInputId: string;
  let testEmployeeId: string;

  beforeEach(async () => {
    // Crear empresa de prueba
    const company = await prisma.company.create({
      data: {
        name: 'Test Company',
      },
    });
    testCompanyId = company.id;

    // Crear insumo de prueba
    const input = await prisma.inputItem.create({
      data: {
        companyId: testCompanyId,
        name: 'Test Input',
        unitLabel: 'kg',
        currentPrice: 100,
      },
    });
    testInputId = input.id;

    // Crear empleado de prueba
    const employee = await prisma.costEmployee.create({
      data: {
        companyId: testCompanyId,
        name: 'Test Employee',
        role: 'Operario',
        grossSalary: 500000,
        payrollTaxes: 150000,
      },
    });
    testEmployeeId = employee.id;
  });

  afterEach(async () => {
    // Limpiar datos de prueba
    await prisma.inputPriceHistory.deleteMany({
      where: { inputId: testInputId },
    });
    await prisma.employeeCompHistory.deleteMany({
      where: { employeeId: testEmployeeId },
    });
    await prisma.inputItem.delete({ where: { id: testInputId } });
    await prisma.costEmployee.delete({ where: { id: testEmployeeId } });
    await prisma.company.delete({ where: { id: testCompanyId } });
  });

  describe('getEffectiveInputPrice', () => {
    it('should return current price when no history exists', async () => {
      const price = await getEffectiveInputPrice(testInputId, '2024-01');
      expect(price).toBe(100);
    });

    it('should return effective price for specific month', async () => {
      // Agregar historial de precios
      await prisma.inputPriceHistory.create({
        data: {
          companyId: testCompanyId,
          inputId: testInputId,
          effectiveFrom: new Date('2024-01-15'),
          price: 120,
        },
      });

      await prisma.inputPriceHistory.create({
        data: {
          companyId: testCompanyId,
          inputId: testInputId,
          effectiveFrom: new Date('2024-02-10'),
          price: 140,
        },
      });

      // Precio efectivo para enero (debe usar el precio de enero)
      const priceJan = await getEffectiveInputPrice(testInputId, '2024-01');
      expect(priceJan).toBe(120);

      // Precio efectivo para febrero (debe usar el precio de febrero)
      const priceFeb = await getEffectiveInputPrice(testInputId, '2024-02');
      expect(priceFeb).toBe(140);

      // Precio efectivo para diciembre 2023 (debe usar precio actual)
      const priceDec = await getEffectiveInputPrice(testInputId, '2023-12');
      expect(priceDec).toBe(100);
    });

    it('should use most recent price when multiple exist in same month', async () => {
      await prisma.inputPriceHistory.createMany({
        data: [
          {
            companyId: testCompanyId,
            inputId: testInputId,
            effectiveFrom: new Date('2024-01-05'),
            price: 110,
          },
          {
            companyId: testCompanyId,
            inputId: testInputId,
            effectiveFrom: new Date('2024-01-20'),
            price: 130,
          },
        ],
      });

      const price = await getEffectiveInputPrice(testInputId, '2024-01');
      expect(price).toBe(130); // Should use the most recent price
    });
  });

  describe('getEffectiveEmployeeComp', () => {
    it('should return current compensation when no history exists', async () => {
      const comp = await getEffectiveEmployeeComp(testEmployeeId, '2024-01');
      expect(comp.grossSalary).toBe(500000);
      expect(comp.payrollTaxes).toBe(150000);
    });

    it('should return effective compensation for specific month', async () => {
      // Agregar historial de compensación
      await prisma.employeeCompHistory.create({
        data: {
          companyId: testCompanyId,
          employeeId: testEmployeeId,
          effectiveFrom: new Date('2024-01-01'),
          grossSalary: 550000,
          payrollTaxes: 165000,
        },
      });

      await prisma.employeeCompHistory.create({
        data: {
          companyId: testCompanyId,
          employeeId: testEmployeeId,
          effectiveFrom: new Date('2024-03-01'),
          grossSalary: 600000,
          payrollTaxes: 180000,
          changePct: 9.09, // ~9% increase
        },
      });

      // Compensación efectiva para enero
      const compJan = await getEffectiveEmployeeComp(testEmployeeId, '2024-01');
      expect(compJan.grossSalary).toBe(550000);
      expect(compJan.payrollTaxes).toBe(165000);

      // Compensación efectiva para febrero (debe usar la de enero)
      const compFeb = await getEffectiveEmployeeComp(testEmployeeId, '2024-02');
      expect(compFeb.grossSalary).toBe(550000);
      expect(compFeb.payrollTaxes).toBe(165000);

      // Compensación efectiva para marzo
      const compMar = await getEffectiveEmployeeComp(testEmployeeId, '2024-03');
      expect(compMar.grossSalary).toBe(600000);
      expect(compMar.payrollTaxes).toBe(180000);

      // Compensación efectiva para diciembre 2023 (debe usar actual)
      const compDec = await getEffectiveEmployeeComp(testEmployeeId, '2023-12');
      expect(compDec.grossSalary).toBe(500000);
      expect(compDec.payrollTaxes).toBe(150000);
    });
  });
});
