/**
 * Seed script para datos de prueba de Tesorería
 * Ejecutar: npx ts-node prisma/seed-tesoreria.ts
 */

import { PrismaClient, CashMovementType, BankMovementType, ChequeOrigen, ChequeTipo, ChequeEstado, TreasuryTransferStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed de Tesorería...\n');

  // Obtener la primera empresa activa
  const company = await prisma.company.findFirst({
    where: { isActive: true },
    select: { id: true, name: true }
  });

  if (!company) {
    console.error('No se encontró empresa activa');
    return;
  }

  console.log(`Usando empresa: ${company.name} (ID: ${company.id})\n`);

  // Obtener primer usuario admin
  const user = await prisma.user.findFirst({
    where: { isActive: true },
    select: { id: true, name: true }
  });

  if (!user) {
    console.error('No se encontró usuario activo');
    return;
  }

  console.log(`Usando usuario: ${user.name} (ID: ${user.id})\n`);

  // ==========================================
  // 1. CAJAS DE EFECTIVO
  // ==========================================
  console.log('--- Creando Cajas de Efectivo ---');

  const cajaPrincipalARS = await prisma.cashAccount.upsert({
    where: {
      companyId_codigo: { companyId: company.id, codigo: 'CAJA-ARS-01' }
    },
    update: {},
    create: {
      companyId: company.id,
      codigo: 'CAJA-ARS-01',
      nombre: 'Caja Principal Pesos',
      moneda: 'ARS',
      esDefault: true,
      isActive: true,
      createdBy: user.id
    }
  });
  console.log(`  Caja creada: ${cajaPrincipalARS.nombre}`);

  const cajaChicaARS = await prisma.cashAccount.upsert({
    where: {
      companyId_codigo: { companyId: company.id, codigo: 'CAJA-CHICA-01' }
    },
    update: {},
    create: {
      companyId: company.id,
      codigo: 'CAJA-CHICA-01',
      nombre: 'Caja Chica',
      moneda: 'ARS',
      esDefault: false,
      isActive: true,
      createdBy: user.id
    }
  });
  console.log(`  Caja creada: ${cajaChicaARS.nombre}`);

  const cajaUSD = await prisma.cashAccount.upsert({
    where: {
      companyId_codigo: { companyId: company.id, codigo: 'CAJA-USD-01' }
    },
    update: {},
    create: {
      companyId: company.id,
      codigo: 'CAJA-USD-01',
      nombre: 'Caja Dólares',
      moneda: 'USD',
      esDefault: true,
      isActive: true,
      createdBy: user.id
    }
  });
  console.log(`  Caja creada: ${cajaUSD.nombre}`);

  // Crear movimientos de caja (T1 y T2)
  console.log('\n--- Creando Movimientos de Caja ---');

  // Movimientos T1 - Caja Principal
  await prisma.cashMovement.createMany({
    data: [
      {
        companyId: company.id,
        cashAccountId: cajaPrincipalARS.id,
        tipo: CashMovementType.INGRESO_DEPOSITO,
        descripcion: 'Apertura de caja',
        ingreso: 500000,
        egreso: 0,
        saldoAnterior: 0,
        saldoPosterior: 500000,
        fecha: new Date(),
        docType: 'T1',
        createdBy: user.id
      },
      {
        companyId: company.id,
        cashAccountId: cajaPrincipalARS.id,
        tipo: CashMovementType.INGRESO_COBRO,
        descripcion: 'Cobro de factura FC-001',
        ingreso: 150000,
        egreso: 0,
        saldoAnterior: 500000,
        saldoPosterior: 650000,
        fecha: new Date(),
        docType: 'T1',
        createdBy: user.id
      },
      {
        companyId: company.id,
        cashAccountId: cajaPrincipalARS.id,
        tipo: CashMovementType.EGRESO_PAGO,
        descripcion: 'Pago de proveedor',
        ingreso: 0,
        egreso: 75000,
        saldoAnterior: 650000,
        saldoPosterior: 575000,
        fecha: new Date(),
        docType: 'T1',
        createdBy: user.id
      }
    ],
    skipDuplicates: true
  });
  console.log('  Movimientos T1 creados en Caja Principal');

  // Movimientos T2 (solo visibles en Extended mode)
  await prisma.cashMovement.createMany({
    data: [
      {
        companyId: company.id,
        cashAccountId: cajaPrincipalARS.id,
        tipo: CashMovementType.INGRESO_DEPOSITO,
        descripcion: 'Venta sin factura',
        ingreso: 80000,
        egreso: 0,
        saldoAnterior: 575000,
        saldoPosterior: 655000,
        fecha: new Date(),
        docType: 'T2',
        createdBy: user.id
      },
      {
        companyId: company.id,
        cashAccountId: cajaPrincipalARS.id,
        tipo: CashMovementType.EGRESO_RETIRO,
        descripcion: 'Compra en efectivo sin factura',
        ingreso: 0,
        egreso: 25000,
        saldoAnterior: 655000,
        saldoPosterior: 630000,
        fecha: new Date(),
        docType: 'T2',
        createdBy: user.id
      }
    ],
    skipDuplicates: true
  });
  console.log('  Movimientos T2 creados en Caja Principal');

  // Movimientos caja chica
  await prisma.cashMovement.createMany({
    data: [
      {
        companyId: company.id,
        cashAccountId: cajaChicaARS.id,
        tipo: CashMovementType.INGRESO_DEPOSITO,
        descripcion: 'Apertura de caja chica',
        ingreso: 50000,
        egreso: 0,
        saldoAnterior: 0,
        saldoPosterior: 50000,
        fecha: new Date(),
        docType: 'T1',
        createdBy: user.id
      },
      {
        companyId: company.id,
        cashAccountId: cajaChicaARS.id,
        tipo: CashMovementType.EGRESO_RETIRO,
        descripcion: 'Insumos de oficina',
        ingreso: 0,
        egreso: 5000,
        saldoAnterior: 50000,
        saldoPosterior: 45000,
        fecha: new Date(),
        docType: 'T1',
        createdBy: user.id
      }
    ],
    skipDuplicates: true
  });
  console.log('  Movimientos creados en Caja Chica');

  // Movimientos USD
  await prisma.cashMovement.createMany({
    data: [
      {
        companyId: company.id,
        cashAccountId: cajaUSD.id,
        tipo: CashMovementType.INGRESO_DEPOSITO,
        descripcion: 'Apertura de caja USD',
        ingreso: 5000,
        egreso: 0,
        saldoAnterior: 0,
        saldoPosterior: 5000,
        fecha: new Date(),
        docType: 'T1',
        createdBy: user.id
      }
    ],
    skipDuplicates: true
  });
  console.log('  Movimientos creados en Caja USD');

  // ==========================================
  // 2. CUENTAS BANCARIAS
  // ==========================================
  console.log('\n--- Creando Cuentas Bancarias ---');

  const bancoGalicia = await prisma.bankAccount.upsert({
    where: {
      companyId_codigo: { companyId: company.id, codigo: 'BCO-GAL-001' }
    },
    update: {},
    create: {
      companyId: company.id,
      codigo: 'BCO-GAL-001',
      nombre: 'Cuenta Galicia Pesos',
      banco: 'Banco Galicia',
      tipoCuenta: 'CUENTA_CORRIENTE',
      numeroCuenta: '1234567890',
      cbu: '0070079120000001234567',
      alias: 'EMPRESA.GALICIA.PESOS',
      moneda: 'ARS',
      esDefault: true,
      saldoContable: 0,
      saldoBancario: 0,
      createdBy: user.id
    }
  });
  console.log(`  Banco creado: ${bancoGalicia.nombre}`);

  const bancoNacion = await prisma.bankAccount.upsert({
    where: {
      companyId_codigo: { companyId: company.id, codigo: 'BCO-NAC-001' }
    },
    update: {},
    create: {
      companyId: company.id,
      codigo: 'BCO-NAC-001',
      nombre: 'Cuenta Nación Pesos',
      banco: 'Banco de la Nación Argentina',
      tipoCuenta: 'CAJA_AHORRO',
      numeroCuenta: '0987654321',
      cbu: '0110020130000009876543',
      alias: 'EMPRESA.NACION.PESOS',
      moneda: 'ARS',
      esDefault: false,
      saldoContable: 0,
      saldoBancario: 0,
      createdBy: user.id
    }
  });
  console.log(`  Banco creado: ${bancoNacion.nombre}`);

  const bancoGaliciaUSD = await prisma.bankAccount.upsert({
    where: {
      companyId_codigo: { companyId: company.id, codigo: 'BCO-GAL-USD' }
    },
    update: {},
    create: {
      companyId: company.id,
      codigo: 'BCO-GAL-USD',
      nombre: 'Cuenta Galicia Dólares',
      banco: 'Banco Galicia',
      tipoCuenta: 'CUENTA_CORRIENTE',
      numeroCuenta: '1234567891',
      cbu: '0070079120000001234568',
      alias: 'EMPRESA.GALICIA.USD',
      moneda: 'USD',
      esDefault: true,
      saldoContable: 0,
      saldoBancario: 0,
      createdBy: user.id
    }
  });
  console.log(`  Banco creado: ${bancoGaliciaUSD.nombre}`);

  // Crear movimientos bancarios
  console.log('\n--- Creando Movimientos Bancarios ---');

  await prisma.bankMovement.createMany({
    data: [
      {
        companyId: company.id,
        bankAccountId: bancoGalicia.id,
        tipo: BankMovementType.DEPOSITO_EFECTIVO,
        descripcion: 'Depósito inicial',
        ingreso: 1500000,
        egreso: 0,
        saldoAnterior: 0,
        saldoPosterior: 1500000,
        fecha: new Date(),
        createdBy: user.id
      },
      {
        companyId: company.id,
        bankAccountId: bancoGalicia.id,
        tipo: BankMovementType.TRANSFERENCIA_IN,
        descripcion: 'Cobro transferencia cliente ABC',
        ingreso: 350000,
        egreso: 0,
        saldoAnterior: 1500000,
        saldoPosterior: 1850000,
        fecha: new Date(),
        createdBy: user.id
      },
      {
        companyId: company.id,
        bankAccountId: bancoGalicia.id,
        tipo: BankMovementType.TRANSFERENCIA_OUT,
        descripcion: 'Pago proveedor XYZ',
        ingreso: 0,
        egreso: 180000,
        saldoAnterior: 1850000,
        saldoPosterior: 1670000,
        fecha: new Date(),
        createdBy: user.id
      },
      {
        companyId: company.id,
        bankAccountId: bancoGalicia.id,
        tipo: BankMovementType.DEBITO_AUTOMATICO,
        descripcion: 'Débito servicios',
        ingreso: 0,
        egreso: 15000,
        saldoAnterior: 1670000,
        saldoPosterior: 1655000,
        fecha: new Date(),
        createdBy: user.id
      }
    ],
    skipDuplicates: true
  });
  console.log('  Movimientos creados en Galicia ARS');

  await prisma.bankMovement.createMany({
    data: [
      {
        companyId: company.id,
        bankAccountId: bancoNacion.id,
        tipo: BankMovementType.DEPOSITO_EFECTIVO,
        descripcion: 'Depósito inicial',
        ingreso: 800000,
        egreso: 0,
        saldoAnterior: 0,
        saldoPosterior: 800000,
        fecha: new Date(),
        createdBy: user.id
      }
    ],
    skipDuplicates: true
  });
  console.log('  Movimientos creados en Nación ARS');

  await prisma.bankMovement.createMany({
    data: [
      {
        companyId: company.id,
        bankAccountId: bancoGaliciaUSD.id,
        tipo: BankMovementType.DEPOSITO_EFECTIVO,
        descripcion: 'Depósito USD',
        ingreso: 10000,
        egreso: 0,
        saldoAnterior: 0,
        saldoPosterior: 10000,
        fecha: new Date(),
        createdBy: user.id
      }
    ],
    skipDuplicates: true
  });
  console.log('  Movimientos creados en Galicia USD');

  // ==========================================
  // 3. CHEQUES
  // ==========================================
  console.log('\n--- Creando Cheques ---');

  // Cheques recibidos T1
  const hoy = new Date();
  const en5Dias = new Date(hoy);
  en5Dias.setDate(en5Dias.getDate() + 5);
  const en10Dias = new Date(hoy);
  en10Dias.setDate(en10Dias.getDate() + 10);
  const en15Dias = new Date(hoy);
  en15Dias.setDate(en15Dias.getDate() + 15);
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);

  await prisma.cheque.createMany({
    data: [
      // ECHEQ recibido (siempre T1)
      {
        companyId: company.id,
        origen: ChequeOrigen.RECIBIDO,
        tipo: ChequeTipo.ECHEQ,
        numero: 'ECH-001',
        banco: 'Banco Galicia',
        sucursal: '001',
        titular: 'Cliente ABC S.A.',
        cuitTitular: '30-12345678-9',
        importe: 250000,
        moneda: 'ARS',
        fechaEmision: ayer,
        fechaVencimiento: en5Dias,
        estado: ChequeEstado.CARTERA,
        docType: 'T1',
        createdBy: user.id
      },
      // Cheque físico recibido T1
      {
        companyId: company.id,
        origen: ChequeOrigen.RECIBIDO,
        tipo: ChequeTipo.FISICO,
        numero: 'CHQ-12345',
        banco: 'Banco Nación',
        sucursal: '456',
        titular: 'Cliente XYZ S.R.L.',
        cuitTitular: '30-98765432-1',
        importe: 180000,
        moneda: 'ARS',
        fechaEmision: ayer,
        fechaVencimiento: en10Dias,
        estado: ChequeEstado.CARTERA,
        docType: 'T1',
        createdBy: user.id
      },
      // Cheque físico recibido T2 (solo visible en Extended)
      {
        companyId: company.id,
        origen: ChequeOrigen.RECIBIDO,
        tipo: ChequeTipo.FISICO,
        numero: 'CHQ-T2-001',
        banco: 'Banco BBVA',
        sucursal: '789',
        titular: 'Juan Pérez',
        cuitTitular: null,
        importe: 75000,
        moneda: 'ARS',
        fechaEmision: hoy,
        fechaVencimiento: en15Dias,
        estado: ChequeEstado.CARTERA,
        docType: 'T2',
        createdBy: user.id
      },
      // Otro ECHEQ
      {
        companyId: company.id,
        origen: ChequeOrigen.RECIBIDO,
        tipo: ChequeTipo.ECHEQ,
        numero: 'ECH-002',
        banco: 'Banco Santander',
        sucursal: '100',
        titular: 'Distribuidora Norte S.A.',
        cuitTitular: '30-55555555-5',
        importe: 320000,
        moneda: 'ARS',
        fechaEmision: ayer,
        fechaVencimiento: en10Dias,
        estado: ChequeEstado.CARTERA,
        docType: 'T1',
        createdBy: user.id
      }
    ],
    skipDuplicates: true
  });
  console.log('  Cheques recibidos creados');

  // Cheques emitidos
  await prisma.cheque.createMany({
    data: [
      {
        companyId: company.id,
        origen: ChequeOrigen.EMITIDO,
        tipo: ChequeTipo.FISICO,
        numero: 'EMI-001',
        banco: 'Banco Galicia',
        sucursal: '001',
        titular: 'Proveedor ABC',
        cuitTitular: '30-11111111-1',
        importe: 95000,
        moneda: 'ARS',
        fechaEmision: hoy,
        fechaVencimiento: en5Dias,
        estado: ChequeEstado.CARTERA,
        bankAccountId: bancoGalicia.id,
        docType: 'T1',
        createdBy: user.id
      }
    ],
    skipDuplicates: true
  });
  console.log('  Cheques emitidos creados');

  // ==========================================
  // 4. TRANSFERENCIAS
  // ==========================================
  console.log('\n--- Creando Transferencias ---');

  await prisma.treasuryTransfer.createMany({
    data: [
      // Transferencia de banco a caja (T1)
      {
        companyId: company.id,
        numero: 'TRF-2026-00001',
        origenBancoId: bancoGalicia.id,
        destinoCajaId: cajaPrincipalARS.id,
        importe: 100000,
        moneda: 'ARS',
        fecha: hoy,
        descripcion: 'Retiro de efectivo para caja',
        estado: TreasuryTransferStatus.COMPLETADA,
        docType: 'T1',
        createdBy: user.id
      },
      // Transferencia entre cajas (T2 - efectivo)
      {
        companyId: company.id,
        numero: 'TRF-2026-00002',
        origenCajaId: cajaPrincipalARS.id,
        destinoCajaId: cajaChicaARS.id,
        importe: 20000,
        moneda: 'ARS',
        fecha: hoy,
        descripcion: 'Reposición caja chica',
        estado: TreasuryTransferStatus.COMPLETADA,
        docType: 'T2',
        createdBy: user.id
      },
      // Transferencia entre bancos (T1)
      {
        companyId: company.id,
        numero: 'TRF-2026-00003',
        origenBancoId: bancoNacion.id,
        destinoBancoId: bancoGalicia.id,
        importe: 200000,
        moneda: 'ARS',
        fecha: hoy,
        descripcion: 'Transferencia entre cuentas propias',
        estado: TreasuryTransferStatus.COMPLETADA,
        docType: 'T1',
        createdBy: user.id
      }
    ],
    skipDuplicates: true
  });
  console.log('  Transferencias creadas');

  // ==========================================
  // RESUMEN FINAL
  // ==========================================
  console.log('\n========================================');
  console.log('SEED DE TESORERÍA COMPLETADO');
  console.log('========================================\n');

  // Mostrar resumen de saldos
  const cajas = await prisma.cashAccount.findMany({
    where: { companyId: company.id },
    include: {
      movements: {
        select: { ingreso: true, egreso: true, docType: true }
      }
    }
  });

  console.log('CAJAS:');
  for (const caja of cajas) {
    const saldoT1 = caja.movements
      .filter(m => m.docType === 'T1')
      .reduce((sum, m) => sum + Number(m.ingreso) - Number(m.egreso), 0);
    const saldoTotal = caja.movements
      .reduce((sum, m) => sum + Number(m.ingreso) - Number(m.egreso), 0);
    console.log(`  ${caja.nombre} (${caja.moneda}): T1=$${saldoT1.toLocaleString()} | Total=$${saldoTotal.toLocaleString()}`);
  }

  const bancos = await prisma.bankAccount.findMany({
    where: { companyId: company.id },
    include: {
      movements: {
        select: { ingreso: true, egreso: true }
      }
    }
  });

  console.log('\nBANCOS:');
  for (const banco of bancos) {
    const saldo = banco.movements.reduce((sum, m) => sum + Number(m.ingreso) - Number(m.egreso), 0);
    console.log(`  ${banco.nombre}: $${saldo.toLocaleString()}`);
  }

  const chequesCount = await prisma.cheque.groupBy({
    by: ['docType'],
    where: { companyId: company.id, estado: ChequeEstado.CARTERA },
    _count: true,
    _sum: { importe: true }
  });

  console.log('\nCHEQUES EN CARTERA:');
  for (const g of chequesCount) {
    console.log(`  ${g.docType}: ${g._count} cheques por $${Number(g._sum.importe).toLocaleString()}`);
  }

  const transferenciasCount = await prisma.treasuryTransfer.groupBy({
    by: ['docType'],
    where: { companyId: company.id },
    _count: true,
    _sum: { importe: true }
  });

  console.log('\nTRANSFERENCIAS:');
  for (const g of transferenciasCount) {
    console.log(`  ${g.docType}: ${g._count} transferencias por $${Number(g._sum.importe).toLocaleString()}`);
  }

  console.log('\n');
}

main()
  .catch((e) => {
    console.error('Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
