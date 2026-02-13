/**
 * O2C System Seed Data
 *
 * Creates comprehensive example data for the Order-to-Cash system.
 * Run with: npx ts-node prisma/seeds/o2c-seed.ts
 */

import { PrismaClient, Prisma, DocType } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to create dates relative to today
function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

// Decimal helper
const D = (value: number) => new Prisma.Decimal(value);

async function main() {
  console.log('🌱 Starting O2C Seed...');

  // Get or create company
  let company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'ORVIT Demo',
        taxId: '30-12345678-9',
        address: 'Av. Corrientes 1234, CABA',
        phone: '+54 11 4555-1234',
        email: 'info@orvitdemo.com',
        isActive: true,
      },
    });
    console.log('✅ Created company:', company.name);
  }

  const companyId = company.id;

  // ═══════════════════════════════════════════════════════════════════════════════
  // SALES CONFIG
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('\n📋 Creating Sales Config...');

  const salesConfig = await prisma.salesConfig.upsert({
    where: { companyId },
    update: {},
    create: {
      companyId,
      // Document Prefixes
      quotePrefix: 'COT',
      quoteNextNumber: 1,
      salePrefix: 'PED',
      saleNextNumber: 1,
      deliveryPrefix: 'ENT',
      deliveryNextNumber: 1,
      remitoPrefix: 'REM',
      remitoNextNumber: 1,
      invoicePrefix: 'FAC',
      paymentPrefix: 'REC',
      paymentNextNumber: 1,
      puntoVenta: '0001',
      invoiceNextNumberA: 1,
      invoiceNextNumberB: 1,
      invoiceNextNumberC: 1,
      acopioPrefix: 'ACO',
      acopioNextNumber: 1,
      retiroPrefix: 'RET',
      retiroNextNumber: 1,
      // Credit Settings
      validarLimiteCredito: true,
      bloquearVentaSinCredito: false,
      // Default values
      diasVencimientoDefault: 30,
      tasaIvaDefault: D(21),
      diasValidezCotizacion: 15,
      clientFormEnabledFields: ['name', 'legalName', 'taxId', 'phone', 'email', 'address'],
    },
  });
  console.log('✅ Sales config created');

  // ═══════════════════════════════════════════════════════════════════════════════
  // CLIENTS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('\n👥 Creating Clients...');

  const clients = [
    {
      id: 'client-good',
      name: 'Cliente Excelente SA',
      legalName: 'Cliente Excelente SA',
      cuit: '30-11111111-1',
      email: 'pagos@clienteexcelente.com',
      phone: '+54 11 4555-0001',
      address: 'Av. Libertador 1000, CABA',
      postalCode: 'C1001',
      creditLimit: 500000,
      currentBalance: 50000,
      isBlocked: false,
      taxCondition: 'responsable_inscripto',
      paymentTerms: 30,
      companyId,
    },
    {
      id: 'client-regular',
      name: 'Cliente Regular SRL',
      legalName: 'Cliente Regular SRL',
      cuit: '30-22222222-2',
      email: 'admin@clienteregular.com',
      phone: '+54 11 4555-0002',
      address: 'Av. Rivadavia 2000, CABA',
      postalCode: 'C1002',
      creditLimit: 200000,
      currentBalance: 180000, // Near limit
      isBlocked: false,
      taxCondition: 'responsable_inscripto',
      paymentTerms: 30,
      companyId,
    },
    {
      id: 'client-overdue',
      name: 'Cliente Moroso SA',
      legalName: 'Cliente Moroso SA',
      cuit: '30-33333333-3',
      email: 'cuentas@clientemoroso.com',
      phone: '+54 11 4555-0003',
      address: 'Av. Belgrano 3000, CABA',
      postalCode: 'C1003',
      creditLimit: 100000,
      currentBalance: 120000, // Over limit
      isBlocked: true,
      blockedReason: 'Mora de 45 días - Factura FAC-0001-A-00000123',
      blockedAt: daysAgo(15),
      taxCondition: 'responsable_inscripto',
      paymentTerms: 30,
      companyId,
    },
    {
      id: 'client-new',
      name: 'Cliente Nuevo',
      legalName: 'Juan Pérez',
      cuit: '20-44444444-4',
      email: 'juan@example.com',
      phone: '+54 11 4555-0004',
      address: 'Calle Florida 400, CABA',
      postalCode: 'C1004',
      creditLimit: null, // No limit
      currentBalance: 0,
      isBlocked: false,
      taxCondition: 'monotributo',
      paymentTerms: 0, // Contado
      companyId,
    },
    {
      id: 'client-rejected-cheque',
      name: 'Cliente Cheque Rechazado SA',
      legalName: 'Cliente Cheque Rechazado SA',
      cuit: '30-55555555-5',
      email: 'admin@chequerechazado.com',
      phone: '+54 11 4555-0005',
      address: 'Av. Santa Fe 5000, CABA',
      postalCode: 'C1005',
      creditLimit: 150000,
      currentBalance: 75000,
      isBlocked: true,
      blockedReason: 'Cheque rechazado - CHQ #123456',
      blockedAt: daysAgo(5),
      taxCondition: 'responsable_inscripto',
      paymentTerms: 30,
      companyId,
    },
  ];

  for (const client of clients) {
    await prisma.client.upsert({
      where: { id: client.id },
      update: client,
      create: client,
    });
  }
  console.log(`✅ Created ${clients.length} clients`);

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRODUCTS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('\n📦 Creating Products...');

  // Get or create a category for products
  let category = await prisma.category.findFirst({ where: { companyId } });
  if (!category) {
    category = await prisma.category.create({
      data: {
        name: 'Materiales de Construcción',
        companyId,
      },
    });
  }

  // Get a user for createdById
  let user = await prisma.user.findFirst({ where: { isActive: true } });
  if (!user) {
    console.log('⚠️ No user found, skipping products');
  } else {
    const products = [
      {
        id: 'prod-cement',
        code: 'CEM-001',
        name: 'Cemento Portland 50kg',
        description: 'Bolsa de cemento portland de 50kg',
        costPrice: 6000,
        minStock: 50,
        currentStock: 500,
        unit: 'bolsa',
        volume: 0.035,
        weight: 50,
        location: 'Depósito A',
        categoryId: category.id,
        createdById: user.id,
        companyId,
      },
      {
        id: 'prod-arena',
        code: 'ARE-001',
        name: 'Arena Gruesa m³',
        description: 'Arena gruesa por metro cúbico',
        costPrice: 18000,
        minStock: 10,
        currentStock: 100,
        unit: 'm³',
        volume: 1,
        weight: 1500,
        location: 'Playa',
        categoryId: category.id,
        createdById: user.id,
        companyId,
      },
      {
        id: 'prod-hierro',
        code: 'HIE-001',
        name: 'Hierro 12mm x 12m',
        description: 'Varilla de hierro 12mm de diámetro, 12 metros',
        costPrice: 11000,
        minStock: 20,
        currentStock: 200,
        unit: 'barra',
        volume: 0.01,
        weight: 10.65,
        location: 'Depósito B',
        categoryId: category.id,
        createdById: user.id,
        companyId,
      },
      {
        id: 'prod-ladrillo',
        code: 'LAD-001',
        name: 'Ladrillo Hueco 18x18x33',
        description: 'Ladrillo hueco cerámico',
        costPrice: 80,
        minStock: 1000,
        currentStock: 10000,
        unit: 'unidad',
        volume: 0.011,
        weight: 3.5,
        location: 'Depósito C',
        categoryId: category.id,
        createdById: user.id,
        companyId,
      },
      {
        id: 'prod-cal',
        code: 'CAL-001',
        name: 'Cal Hidratada 25kg',
        description: 'Bolsa de cal hidratada de 25kg',
        costPrice: 2500,
        minStock: 30,
        currentStock: 300,
        unit: 'bolsa',
        volume: 0.02,
        weight: 25,
        location: 'Depósito A',
        categoryId: category.id,
        createdById: user.id,
        companyId,
      },
    ];

    for (const product of products) {
      await prisma.product.upsert({
        where: { id: product.id },
        update: product,
        create: product,
      });
    }
    console.log(`✅ Created ${products.length} products`);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // BANK ACCOUNTS & CASH ACCOUNTS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('\n🏦 Creating Treasury Accounts...');

  // Get user for createdBy
  const treasuryUser = user || await prisma.user.findFirst({ where: { isActive: true } });
  if (!treasuryUser) {
    console.log('⚠️ No user found, skipping treasury accounts');
  } else {
    const cashAccount = await prisma.cashAccount.upsert({
      where: { id: 1 },
      update: {},
      create: {
        codigo: 'CAJA-001',
        nombre: 'Caja Principal',
        saldoActual: D(150000),
        moneda: 'ARS',
        isActive: true,
        esDefault: true,
        createdBy: treasuryUser.id,
        companyId,
      },
    });

    const bankAccount = await prisma.bankAccount.upsert({
      where: { id: 1 },
      update: {},
      create: {
        codigo: 'BNA-001',
        nombre: 'Banco Nación - Cta Cte',
        banco: 'Banco de la Nación Argentina',
        tipoCuenta: 'CC',
        numeroCuenta: '012345678901',
        cbu: '0110012345678901234567',
        saldoContable: D(500000),
        saldoBancario: D(500000),
        moneda: 'ARS',
        isActive: true,
        esDefault: true,
        createdBy: treasuryUser.id,
        companyId,
      },
    });

    console.log('✅ Created cash and bank accounts');
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DOCUMENT SEQUENCES (using raw SQL since model not in Prisma schema yet)
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('\n🔢 Creating Document Sequences...');

  const sequences = [
    { docType: 'SALE', prefix: 'PED', puntoVenta: '' },
    { docType: 'QUOTE', prefix: 'COT', puntoVenta: '' },
    { docType: 'LOADORDER', prefix: 'ORC', puntoVenta: '' },
    { docType: 'DELIVERY', prefix: 'ENT', puntoVenta: '' },
    { docType: 'REMITO', prefix: 'REM', puntoVenta: '0001' },
    { docType: 'INVOICE_A', prefix: '0001-A', puntoVenta: '0001' },
    { docType: 'INVOICE_B', prefix: '0001-B', puntoVenta: '0001' },
    { docType: 'INVOICE_C', prefix: '0001-C', puntoVenta: '0001' },
    { docType: 'RECEIPT', prefix: 'REC', puntoVenta: '' },
    { docType: 'CREDITNOTE', prefix: 'NC', puntoVenta: '0001' },
    { docType: 'DEBITNOTE', prefix: 'ND', puntoVenta: '0001' },
    { docType: 'DISPUTE', prefix: 'DIS', puntoVenta: '' },
    { docType: 'RETURN', prefix: 'DEV', puntoVenta: '' },
  ];

  for (const seq of sequences) {
    await prisma.$executeRaw`
      INSERT INTO document_sequences ("companyId", "docType", "prefix", "puntoVenta", "nextNumber")
      VALUES (${companyId}, ${seq.docType}, ${seq.prefix}, ${seq.puntoVenta}, 1)
      ON CONFLICT ("companyId", "docType", "puntoVenta") DO NOTHING
    `;
  }
  console.log(`✅ Created ${sequences.length} document sequences`);

  // ═══════════════════════════════════════════════════════════════════════════════
  // SAMPLE SALES FLOW (Complete O2C Cycle)
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('\n📋 Creating Sample Sales Flow...');

  // Delete existing sample sales first
  await prisma.saleItem.deleteMany({
    where: {
      sale: {
        companyId,
        numero: { in: ['PED-00000001', 'PED-00000002', 'PED-00000003'] },
      },
    },
  });
  await prisma.sale.deleteMany({
    where: {
      companyId,
      numero: { in: ['PED-00000001', 'PED-00000002', 'PED-00000003'] },
    },
  });

  // Sale 1: Complete flow - Confirmed, Delivered, Invoiced, Partially Paid
  const sale1 = await prisma.sale.create({
    data: {
      numero: 'PED-00000001',
      clientId: 'client-good',
      companyId,
      fechaEmision: daysAgo(30),
      fechaEntregaEstimada: daysAgo(25),
      estado: 'FACTURADA',
      subtotal: D(170000), // 20 cement + 2 m³ arena
      descuentoGlobal: D(5),
      descuentoMonto: D(8500),
      tasaIva: D(21),
      impuestos: D(33915),
      total: D(195415),
      moneda: 'ARS',
      docType: 'T1',
      createdBy: 1,
      items: {
        create: [
          {
            productId: 'prod-cement',
            codigo: 'CEM-001',
            descripcion: 'Cemento Portland 50kg',
            cantidad: D(20),
            cantidadPendiente: D(0),
            unidad: 'bolsa',
            precioUnitario: D(8500),
            descuento: D(0),
            subtotal: D(170000),
            cantidadEntregada: D(20),
            orden: 1,
          },
        ],
      },
    },
  });
  console.log('✅ Created Sale 1 (Complete flow)');

  // Sale 2: In preparation - Ready for load order
  const sale2 = await prisma.sale.create({
    data: {
      numero: 'PED-00000002',
      clientId: 'client-regular',
      companyId,
      fechaEmision: daysAgo(5),
      fechaEntregaEstimada: daysFromNow(2),
      estado: 'EN_PREPARACION',
      subtotal: D(300000),
      descuentoGlobal: D(0),
      descuentoMonto: D(0),
      tasaIva: D(21),
      impuestos: D(63000),
      total: D(363000),
      moneda: 'ARS',
      docType: 'T1',
      createdBy: 1,
      items: {
        create: [
          {
            productId: 'prod-hierro',
            codigo: 'HIE-001',
            descripcion: 'Hierro 12mm x 12m',
            cantidad: D(20),
            cantidadPendiente: D(20),
            unidad: 'barra',
            precioUnitario: D(15000),
            descuento: D(0),
            subtotal: D(300000),
            cantidadEntregada: D(0),
            orden: 1,
          },
        ],
      },
    },
  });
  console.log('✅ Created Sale 2 (In preparation)');

  // Sale 3: Draft - Needs confirmation
  const sale3 = await prisma.sale.create({
    data: {
      numero: 'PED-00000003',
      clientId: 'client-new',
      companyId,
      fechaEmision: new Date(),
      fechaEntregaEstimada: daysFromNow(7),
      estado: 'BORRADOR',
      subtotal: D(12000),
      descuentoGlobal: D(0),
      descuentoMonto: D(0),
      tasaIva: D(21),
      impuestos: D(2520),
      total: D(14520),
      moneda: 'ARS',
      docType: 'T1',
      createdBy: 1,
      items: {
        create: [
          {
            productId: 'prod-ladrillo',
            codigo: 'LAD-001',
            descripcion: 'Ladrillo Hueco 18x18x33',
            cantidad: D(100),
            cantidadPendiente: D(100),
            unidad: 'unidad',
            precioUnitario: D(120),
            descuento: D(0),
            subtotal: D(12000),
            cantidadEntregada: D(0),
            orden: 1,
          },
        ],
      },
    },
  });
  console.log('✅ Created Sale 3 (Draft)');

  // ═══════════════════════════════════════════════════════════════════════════════
  // PICKUP SLOTS (Turnos de Retiro) - using raw SQL
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('\n📅 Creating Pickup Slots...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const userId = treasuryUser?.id || 1;

  for (let d = 0; d < 7; d++) {
    const slotDate = new Date(today);
    slotDate.setDate(slotDate.getDate() + d);

    // Skip weekends
    if (slotDate.getDay() === 0 || slotDate.getDay() === 6) continue;

    // Create slots from 8:00 to 17:00
    for (let hour = 8; hour < 17; hour++) {
      const horaInicio = `${hour.toString().padStart(2, '0')}:00`;
      const horaFin = `${(hour + 1).toString().padStart(2, '0')}:00`;
      await prisma.$executeRaw`
        INSERT INTO pickup_slots ("companyId", "fecha", "horaInicio", "horaFin", "capacidadMaxima", "createdBy", "createdAt", "updatedAt")
        VALUES (${companyId}, ${slotDate}::date, ${horaInicio}, ${horaFin}, 2, ${userId}, NOW(), NOW())
        ON CONFLICT ("companyId", "fecha", "horaInicio") DO NOTHING
      `;
    }
  }
  console.log('✅ Created pickup slots for next 7 days');

  // ═══════════════════════════════════════════════════════════════════════════════
  // CLIENT BLOCK HISTORY (Example records) - using raw SQL
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('\n🚫 Creating Block History...');

  await prisma.$executeRaw`
    INSERT INTO client_block_history ("clientId", "companyId", "tipoBloqueo", "motivo", "montoExcedido", "facturaRef", "diasMora", "bloqueadoPor")
    VALUES ('client-overdue', ${companyId}, 'MORA', 'Factura vencida hace más de 45 días', 35000, 'FAC-0001-A-00000123', 45, ${userId})
    ON CONFLICT DO NOTHING
  `;

  await prisma.$executeRaw`
    INSERT INTO client_block_history ("clientId", "companyId", "tipoBloqueo", "motivo", "montoExcedido", "facturaRef", "diasMora", "bloqueadoPor")
    VALUES ('client-rejected-cheque', ${companyId}, 'CHEQUE_RECHAZADO', 'Cheque rechazado por falta de fondos', 25000, 'CHQ-123456', 0, ${userId})
    ON CONFLICT DO NOTHING
  `;
  console.log('✅ Created block history records');

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('🎉 O2C Seed completed successfully!');
  console.log('═'.repeat(60));
  console.log('\nCreated:');
  console.log(`  • 1 Company: ${company.name}`);
  console.log(`  • 5 Clients (good, regular, overdue, new, rejected-cheque)`);
  console.log(`  • 5 Products (cement, sand, iron, bricks, lime)`);
  console.log('  • 1 Cash Account');
  console.log('  • 1 Bank Account');
  console.log(`  • 13 Document Sequences`);
  console.log('  • 3 Sample Sales (draft, in-prep, invoiced)');
  console.log('  • Pickup slots for 7 days');
  console.log('  • Client block history');
  console.log('\n✨ Ready to test O2C flows!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
