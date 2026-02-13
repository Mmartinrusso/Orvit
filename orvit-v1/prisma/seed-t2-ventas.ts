import { PrismaClient, QuoteStatus, SaleStatus, DeliveryStatus, SalesInvoiceType, SalesInvoiceStatus, ClientPaymentStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function seedT2Ventas() {
  console.log('🔵 Iniciando seed T2 para Ventas...\n');

  // ═══════════════════════════════════════════════════════════
  // 1. Obtener dependencias mínimas
  // ═══════════════════════════════════════════════════════════
  const company = await prisma.company.findFirst();
  if (!company) {
    console.error('❌ No hay company en la BD. Ejecutá el seed principal primero.');
    return;
  }
  console.log(`📍 Company: ${company.name} (ID: ${company.id})`);

  let client = await prisma.client.findFirst({ where: { companyId: company.id } });
  if (!client) {
    console.log('⚠️ No hay clientes, creando cliente dummy...');
    client = await prisma.client.create({
      data: {
        companyId: company.id,
        name: 'Cliente T2 Test',
        legalName: 'Cliente T2 Test SA',
        email: 'clientet2@test.com',
        cuit: '20-12345678-9',
        postalCode: '1000',
      }
    });
    console.log(`✅ Cliente dummy creado: ${client.name}`);
  }
  console.log(`📍 Client: ${client.name || client.legalName} (ID: ${client.id})`);

  // Obtener un usuario de la company
  const userOnCompany = await prisma.userOnCompany.findFirst({
    where: { companyId: company.id },
    include: { user: true }
  });
  if (!userOnCompany) {
    console.error('❌ No hay usuarios en la company. Ejecutá el seed principal primero.');
    return;
  }
  const userId = userOnCompany.userId;
  console.log(`📍 User: ${userOnCompany.user.name} (ID: ${userId})`);

  const timestamp = Date.now();

  // ═══════════════════════════════════════════════════════════
  // 2. Crear datos T2
  // ═══════════════════════════════════════════════════════════
  console.log('\n📝 Creando documentos T2...');

  // Cotización T2
  const cotizacionT2 = await prisma.quote.create({
    data: {
      company: { connect: { id: company.id } },
      client: { connect: { id: client.id } },
      createdByUser: { connect: { id: userId } },
      numero: `COT-T2-${timestamp}`,
      estado: QuoteStatus.BORRADOR,
      fechaEmision: new Date(),
      fechaValidez: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      subtotal: 50000,
      tasaIva: 21,
      impuestos: 10500,
      total: 60500,
      docType: 'T2',
    }
  });
  console.log(`  ✅ Cotización T2: ${cotizacionT2.numero}`);

  // Cotización T2 adicional (enviada)
  const cotizacionT2_2 = await prisma.quote.create({
    data: {
      company: { connect: { id: company.id } },
      client: { connect: { id: client.id } },
      createdByUser: { connect: { id: userId } },
      numero: `COT-T2-${timestamp + 1}`,
      estado: QuoteStatus.ENVIADA,
      fechaEmision: new Date(),
      fechaValidez: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      subtotal: 75000,
      tasaIva: 21,
      impuestos: 15750,
      total: 90750,
      docType: 'T2',
    }
  });
  console.log(`  ✅ Cotización T2: ${cotizacionT2_2.numero}`);

  // Orden de Venta T2
  const ordenT2 = await prisma.sale.create({
    data: {
      company: { connect: { id: company.id } },
      client: { connect: { id: client.id } },
      createdByUser: { connect: { id: userId } },
      numero: `OV-T2-${timestamp}`,
      estado: SaleStatus.CONFIRMADA,
      fechaEmision: new Date(),
      subtotal: 100000,
      tasaIva: 21,
      impuestos: 21000,
      total: 121000,
      docType: 'T2',
    }
  });
  console.log(`  ✅ Orden de Venta T2: ${ordenT2.numero}`);

  // Entrega T2
  const entregaT2 = await prisma.saleDelivery.create({
    data: {
      numero: `ENT-T2-${timestamp}`,
      sale: { connect: { id: ordenT2.id } },
      client: { connect: { id: client.id } },
      company: { connect: { id: company.id } },
      createdByUser: { connect: { id: userId } },
      estado: DeliveryStatus.ENTREGADA,
      fechaEntrega: new Date(),
      direccionEntrega: 'Av. Córdoba 1234, CABA',
      docType: 'T2',
    }
  });
  console.log(`  ✅ Entrega T2: ${entregaT2.numero}`);

  // Factura T2
  const facturaT2 = await prisma.salesInvoice.create({
    data: {
      tipo: SalesInvoiceType.B,  // B = Factura B (consumidor final)
      letra: 'B',
      puntoVenta: '00001',
      numero: String(timestamp).slice(-8).padStart(8, '0'),
      numeroCompleto: `B-00001-${String(timestamp).slice(-8).padStart(8, '0')}`,
      client: { connect: { id: client.id } },
      sale: { connect: { id: ordenT2.id } },
      company: { connect: { id: company.id } },
      createdByUser: { connect: { id: userId } },
      estado: SalesInvoiceStatus.EMITIDA,
      fechaEmision: new Date(),
      fechaVencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      netoGravado: 100000,
      iva21: 21000,
      total: 121000,
      saldoPendiente: 121000,
      docType: 'T2',
    }
  });
  console.log(`  ✅ Factura T2: ${facturaT2.numeroCompleto}`);

  // Pago T2
  const pagoT2 = await prisma.clientPayment.create({
    data: {
      numero: `REC-T2-${timestamp}`,
      client: { connect: { id: client.id } },
      company: { connect: { id: company.id } },
      createdByUser: { connect: { id: userId } },
      fechaPago: new Date(),
      totalPago: 50000,
      efectivo: 50000,
      estado: ClientPaymentStatus.CONFIRMADO,
      docType: 'T2',
    }
  });
  console.log(`  ✅ Pago T2: ${pagoT2.numero}`);

  // ═══════════════════════════════════════════════════════════
  // 3. Crear datos T1 (Standard) para comparar
  // ═══════════════════════════════════════════════════════════
  console.log('\n📝 Creando documentos T1 (Standard)...');

  const cotizacionT1 = await prisma.quote.create({
    data: {
      company: { connect: { id: company.id } },
      client: { connect: { id: client.id } },
      createdByUser: { connect: { id: userId } },
      numero: `COT-T1-${timestamp}`,
      estado: QuoteStatus.ACEPTADA,
      fechaEmision: new Date(),
      fechaValidez: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      subtotal: 30000,
      tasaIva: 21,
      impuestos: 6300,
      total: 36300,
      docType: 'T1',  // Standard - debe verse siempre
    }
  });
  console.log(`  ✅ Cotización T1: ${cotizacionT1.numero}`);

  const ordenT1 = await prisma.sale.create({
    data: {
      company: { connect: { id: company.id } },
      client: { connect: { id: client.id } },
      createdByUser: { connect: { id: userId } },
      numero: `OV-T1-${timestamp}`,
      estado: SaleStatus.ENTREGADA,
      fechaEmision: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // hace 1 semana
      subtotal: 45000,
      tasaIva: 21,
      impuestos: 9450,
      total: 54450,
      docType: 'T1',  // Standard
    }
  });
  console.log(`  ✅ Orden T1: ${ordenT1.numero}`);

  // ═══════════════════════════════════════════════════════════
  // 4. Resumen de datos
  // ═══════════════════════════════════════════════════════════
  console.log('\n📊 Resumen de datos en BD (company ' + company.id + '):');

  const counts = {
    'Quote T1': await prisma.quote.count({ where: { companyId: company.id, docType: 'T1' } }),
    'Quote T2': await prisma.quote.count({ where: { companyId: company.id, docType: 'T2' } }),
    'Sale T1': await prisma.sale.count({ where: { companyId: company.id, docType: 'T1' } }),
    'Sale T2': await prisma.sale.count({ where: { companyId: company.id, docType: 'T2' } }),
    'Delivery T1': await prisma.saleDelivery.count({ where: { companyId: company.id, docType: 'T1' } }),
    'Delivery T2': await prisma.saleDelivery.count({ where: { companyId: company.id, docType: 'T2' } }),
    'Invoice T1': await prisma.salesInvoice.count({ where: { companyId: company.id, docType: 'T1' } }),
    'Invoice T2': await prisma.salesInvoice.count({ where: { companyId: company.id, docType: 'T2' } }),
    'Payment T1': await prisma.clientPayment.count({ where: { companyId: company.id, docType: 'T1' } }),
    'Payment T2': await prisma.clientPayment.count({ where: { companyId: company.id, docType: 'T2' } }),
  };

  console.log('  ┌─────────────────────┬───────┐');
  console.log('  │ Modelo              │ Count │');
  console.log('  ├─────────────────────┼───────┤');
  Object.entries(counts).forEach(([key, count]) => {
    const paddedKey = key.padEnd(19);
    const paddedCount = String(count).padStart(5);
    console.log(`  │ ${paddedKey} │ ${paddedCount} │`);
  });
  console.log('  └─────────────────────┴───────┘');

  console.log('\n✅ Seed T2 Ventas completado!');
  console.log('\n🔍 Para probar ViewMode:');
  console.log('   - Sin juego de tecla (Standard): Solo ves T1 (no T2)');
  console.log('   - Con juego de tecla (Extended): Ves TODO (T1 + T2)');
}

seedT2Ventas()
  .catch((error) => {
    console.error('❌ Error en seed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
