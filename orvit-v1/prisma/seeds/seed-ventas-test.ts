import { PrismaClient, SaleStatus, SalesInvoiceStatus, ClientPaymentStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Helper para generar IDs tipo cuid
function cuid() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `c${timestamp}${random}`;
}

async function main() {
  console.log('🚀 Iniciando seed de datos de prueba para Ventas...\n');

  // 1. Obtener company existente
  const company = await prisma.company.findFirst();
  if (!company) {
    console.error('❌ No hay company. Ejecuta el seed principal primero.');
    return;
  }
  console.log(`✅ Company encontrada: ${company.name} (ID: ${company.id})`);

  // 2. Obtener usuario vendedor
  const vendedor = await prisma.user.findFirst({
    where: { companies: { some: { companyId: company.id } } }
  });
  if (!vendedor) {
    console.error('❌ No hay usuarios. Ejecuta el seed principal primero.');
    return;
  }
  console.log(`✅ Vendedor: ${vendedor.name} (ID: ${vendedor.id})`);

  // 3. Obtener o crear categoría
  let categoria = await prisma.category.findFirst({ where: { companyId: company.id } });
  if (!categoria) {
    categoria = await prisma.category.create({
      data: {
        name: 'Productos General',
        companyId: company.id,
        createdById: vendedor.id,
      }
    });
    console.log(`✅ Categoría creada: ${categoria.name}`);
  }

  // 4. Crear clientes de prueba
  console.log('\n📦 Creando clientes de prueba...');

  const clientesData = [
    { legalName: 'Distribuidora Norte SA', name: 'Dist. Norte', cuit: '30-71234567-8', email: 'norte@test.com', creditLimit: 500000 },
    { legalName: 'Comercial del Sur SRL', name: 'Com. Sur', cuit: '30-71234568-9', email: 'sur@test.com', creditLimit: 300000 },
    { legalName: 'Mayorista Centro SA', name: 'May. Centro', cuit: '30-71234569-0', email: 'centro@test.com', creditLimit: 1000000 },
    { legalName: 'Minorista Express', name: 'Min. Express', cuit: '20-12345678-1', email: 'express@test.com', creditLimit: 100000 },
    { legalName: 'Supermercado La Economía', name: 'La Economía', cuit: '30-71234570-1', email: 'economia@test.com', creditLimit: 750000 },
  ];

  const clientes: any[] = [];
  for (const c of clientesData) {
    const existing = await prisma.client.findFirst({ where: { email: c.email, companyId: company.id } });
    if (existing) {
      clientes.push(existing);
      console.log(`  - Cliente existente: ${c.legalName}`);
    } else {
      const nuevo = await prisma.client.create({
        data: {
          id: cuid(),
          ...c,
          companyId: company.id,
          taxCondition: 'responsable_inscripto',
          postalCode: '1000',
          isActive: true,
        }
      });
      clientes.push(nuevo);
      console.log(`  ✅ Cliente creado: ${c.legalName}`);
    }
  }

  // 5. Crear productos de prueba
  console.log('\n📦 Creando productos de prueba...');

  const productosData = [
    { name: 'Aceite de Girasol 1.5L', code: 'ACE-001', costPrice: 1800 },
    { name: 'Arroz Largo Fino 1kg', code: 'ARR-001', costPrice: 850 },
    { name: 'Fideos Spaghetti 500g', code: 'FID-001', costPrice: 550 },
    { name: 'Harina 000 1kg', code: 'HAR-001', costPrice: 400 },
    { name: 'Azúcar 1kg', code: 'AZU-001', costPrice: 650 },
    { name: 'Leche Entera 1L', code: 'LEC-001', costPrice: 800 },
    { name: 'Yerba Mate 1kg', code: 'YER-001', costPrice: 2500 },
    { name: 'Galletitas Dulces 300g', code: 'GAL-001', costPrice: 1000 },
  ];

  const productos: any[] = [];
  for (const p of productosData) {
    const existing = await prisma.product.findFirst({ where: { code: p.code, companyId: company.id } });
    if (existing) {
      productos.push(existing);
      console.log(`  - Producto existente: ${p.name}`);
    } else {
      const nuevo = await prisma.product.create({
        data: {
          id: cuid(),
          ...p,
          description: p.name,
          unit: 'UN',
          minStock: 10,
          currentStock: 100,
          volume: 0,
          weight: 0,
          location: 'A1',
          companyId: company.id,
          categoryId: categoria.id,
          createdById: vendedor.id,
          isActive: true,
        }
      });
      productos.push(nuevo);
      console.log(`  ✅ Producto creado: ${p.name}`);
    }
  }

  // 6. Crear ventas T1 (Formales)
  console.log('\n📄 Creando ventas T1 (Formales)...');

  const fechaBase = new Date();
  for (let i = 0; i < 10; i++) {
    const cliente = clientes[i % clientes.length];
    const fechaVenta = new Date(fechaBase);
    fechaVenta.setDate(fechaVenta.getDate() - (i * 3));

    const itemsVenta = productos.slice(0, 3 + (i % 3)).map((p, idx) => ({
      productId: p.id,
      codigo: p.code,
      descripcion: p.name,
      cantidad: 10 + (idx * 5),
      cantidadEntregada: 0,
      cantidadPendiente: 10 + (idx * 5),
      unidad: 'UN',
      precioUnitario: Number(p.costPrice) * 1.4, // 40% margen
      descuento: 0,
      subtotal: (10 + (idx * 5)) * Number(p.costPrice) * 1.4,
      costoUnitario: Number(p.costPrice),
      orden: idx,
    }));

    const subtotal = itemsVenta.reduce((sum, item) => sum + item.subtotal, 0);
    const impuestos = subtotal * 0.21;
    const total = subtotal + impuestos;

    const venta = await prisma.sale.create({
      data: {
        numero: `OV-2025-${String(1000 + i).padStart(5, '0')}`,
        clientId: cliente.id,
        sellerId: vendedor.id,
        estado: i < 7 ? SaleStatus.CONFIRMADA : SaleStatus.ENTREGADA,
        fechaEmision: fechaVenta,
        moneda: 'ARS',
        subtotal,
        tasaIva: 21,
        impuestos,
        total,
        docType: 'T1',
        companyId: company.id,
        createdBy: vendedor.id,
        items: {
          create: itemsVenta
        }
      }
    });
    console.log(`  ✅ Venta T1: ${venta.numero} - ${cliente.legalName} - $${total.toLocaleString()}`);

    // Crear factura para ventas confirmadas
    if (i < 8) {
      const factura = await prisma.salesInvoice.create({
        data: {
          tipo: 'A',
          letra: 'A',
          puntoVenta: '00001',
          numero: String(50000 + i).padStart(8, '0'),
          numeroCompleto: `A-00001-${String(50000 + i).padStart(8, '0')}`,
          saleId: venta.id,
          clientId: cliente.id,
          estado: i < 5 ? SalesInvoiceStatus.EMITIDA : SalesInvoiceStatus.COBRADA,
          fechaEmision: fechaVenta,
          fechaVencimiento: new Date(fechaVenta.getTime() + 30 * 24 * 60 * 60 * 1000),
          netoGravado: subtotal,
          iva21: impuestos,
          total,
          saldoPendiente: i < 5 ? total : 0,
          docType: 'T1',
          companyId: company.id,
          createdBy: vendedor.id,
        }
      });
      console.log(`    📄 Factura T1: ${factura.numeroCompleto}`);

      // Crear ledger entry
      await prisma.clientLedgerEntry.create({
        data: {
          clientId: cliente.id,
          companyId: company.id,
          tipo: 'FACTURA',
          facturaId: factura.id,
          fecha: fechaVenta,
          debe: total,
          haber: 0,
          comprobante: factura.numeroCompleto,
          descripcion: `Factura ${factura.numeroCompleto}`,
          createdBy: vendedor.id,
        }
      });

      // Crear pago para facturas cobradas
      if (i >= 5) {
        const pago = await prisma.clientPayment.create({
          data: {
            numero: `REC-2025-${String(100 + i).padStart(5, '0')}`,
            clientId: cliente.id,
            fechaPago: new Date(fechaVenta.getTime() + 15 * 24 * 60 * 60 * 1000),
            totalPago: total,
            efectivo: total * 0.5,
            transferencia: total * 0.5,
            estado: ClientPaymentStatus.CONFIRMADO,
            docType: 'T1',
            companyId: company.id,
            createdBy: vendedor.id,
          }
        });
        console.log(`    💰 Pago T1: ${pago.numero}`);

        // Crear allocation
        await prisma.invoicePaymentAllocation.create({
          data: {
            paymentId: pago.id,
            invoiceId: factura.id,
            montoAplicado: total,
          }
        });

        // Crear ledger entry para pago
        await prisma.clientLedgerEntry.create({
          data: {
            clientId: cliente.id,
            companyId: company.id,
            tipo: 'PAGO',
            pagoId: pago.id,
            fecha: pago.fechaPago,
            debe: 0,
            haber: total,
            comprobante: pago.numero,
            descripcion: `Pago ${pago.numero}`,
            createdBy: vendedor.id,
          }
        });
      }
    }
  }

  // 7. Crear ventas T2 (Informales - Notas de Venta)
  console.log('\n📄 Creando ventas T2 (Notas de Venta)...');

  for (let i = 0; i < 8; i++) {
    const cliente = clientes[(i + 2) % clientes.length];
    const fechaVenta = new Date(fechaBase);
    fechaVenta.setDate(fechaVenta.getDate() - (i * 2));

    const itemsVenta = productos.slice(0, 2 + (i % 4)).map((p, idx) => ({
      productId: p.id,
      codigo: p.code,
      descripcion: p.name,
      cantidad: 5 + (idx * 3),
      cantidadEntregada: 0,
      cantidadPendiente: 5 + (idx * 3),
      unidad: 'UN',
      precioUnitario: Number(p.costPrice) * 1.3, // 30% margen
      descuento: 0,
      subtotal: (5 + (idx * 3)) * Number(p.costPrice) * 1.3,
      costoUnitario: Number(p.costPrice),
      orden: idx,
    }));

    const subtotal = itemsVenta.reduce((sum, item) => sum + item.subtotal, 0);
    const total = subtotal; // Sin IVA para T2

    const venta = await prisma.sale.create({
      data: {
        numero: `NV-2025-${String(2000 + i).padStart(5, '0')}`,
        clientId: cliente.id,
        sellerId: vendedor.id,
        estado: i < 5 ? SaleStatus.CONFIRMADA : SaleStatus.ENTREGADA,
        fechaEmision: fechaVenta,
        moneda: 'ARS',
        subtotal,
        tasaIva: 0,
        impuestos: 0,
        total,
        docType: 'T2',
        companyId: company.id,
        createdBy: vendedor.id,
        items: {
          create: itemsVenta
        }
      }
    });
    console.log(`  ✅ Venta T2: ${venta.numero} - ${cliente.legalName} - $${total.toLocaleString()}`);

    // Crear nota de venta (factura T2)
    if (i < 6) {
      const nota = await prisma.salesInvoice.create({
        data: {
          tipo: 'B',
          letra: 'B',
          puntoVenta: '00001',
          numero: String(1000 + i).padStart(8, '0'),
          numeroCompleto: `NV-00001-${String(1000 + i).padStart(8, '0')}`,
          saleId: venta.id,
          clientId: cliente.id,
          estado: i < 3 ? SalesInvoiceStatus.EMITIDA : SalesInvoiceStatus.COBRADA,
          fechaEmision: fechaVenta,
          fechaVencimiento: new Date(fechaVenta.getTime() + 15 * 24 * 60 * 60 * 1000),
          netoGravado: subtotal,
          total,
          saldoPendiente: i < 3 ? total : 0,
          docType: 'T2',
          companyId: company.id,
          createdBy: vendedor.id,
        }
      });
      console.log(`    📄 Nota Venta T2: ${nota.numeroCompleto}`);

      // Crear ledger entry
      await prisma.clientLedgerEntry.create({
        data: {
          clientId: cliente.id,
          companyId: company.id,
          tipo: 'FACTURA',
          facturaId: nota.id,
          fecha: fechaVenta,
          debe: total,
          haber: 0,
          comprobante: nota.numeroCompleto,
          descripcion: `Nota de Venta ${nota.numeroCompleto}`,
          createdBy: vendedor.id,
        }
      });

      // Crear pago para notas cobradas
      if (i >= 3) {
        const pago = await prisma.clientPayment.create({
          data: {
            numero: `REC-T2-2025-${String(200 + i).padStart(5, '0')}`,
            clientId: cliente.id,
            fechaPago: new Date(fechaVenta.getTime() + 7 * 24 * 60 * 60 * 1000),
            totalPago: total,
            efectivo: total,
            estado: ClientPaymentStatus.CONFIRMADO,
            docType: 'T2',
            companyId: company.id,
            createdBy: vendedor.id,
          }
        });
        console.log(`    💰 Pago T2: ${pago.numero}`);

        // Crear allocation
        await prisma.invoicePaymentAllocation.create({
          data: {
            paymentId: pago.id,
            invoiceId: nota.id,
            montoAplicado: total,
          }
        });

        // Crear ledger entry para pago
        await prisma.clientLedgerEntry.create({
          data: {
            clientId: cliente.id,
            companyId: company.id,
            tipo: 'PAGO',
            pagoId: pago.id,
            fecha: pago.fechaPago,
            debe: 0,
            haber: total,
            comprobante: pago.numero,
            descripcion: `Pago ${pago.numero}`,
            createdBy: vendedor.id,
          }
        });
      }
    }
  }

  // 8. Actualizar balance de clientes
  console.log('\n💳 Actualizando balance de clientes...');
  for (const cliente of clientes) {
    const ledger = await prisma.clientLedgerEntry.aggregate({
      where: { clientId: cliente.id, companyId: company.id },
      _sum: { debe: true, haber: true }
    });
    const balance = Number(ledger._sum.debe || 0) - Number(ledger._sum.haber || 0);
    await prisma.client.update({
      where: { id: cliente.id },
      data: { currentBalance: balance }
    });
    console.log(`  ${cliente.legalName}: $${balance.toLocaleString()}`);
  }

  // 9. Resumen final
  console.log('\n📊 RESUMEN DE DATOS CREADOS:');
  console.log('─'.repeat(50));

  const counts = {
    'Clientes': await prisma.client.count({ where: { companyId: company.id } }),
    'Productos': await prisma.product.count({ where: { companyId: company.id } }),
    'Ventas T1': await prisma.sale.count({ where: { companyId: company.id, docType: 'T1' } }),
    'Ventas T2': await prisma.sale.count({ where: { companyId: company.id, docType: 'T2' } }),
    'Facturas T1': await prisma.salesInvoice.count({ where: { companyId: company.id, docType: 'T1' } }),
    'Facturas T2': await prisma.salesInvoice.count({ where: { companyId: company.id, docType: 'T2' } }),
    'Pagos T1': await prisma.clientPayment.count({ where: { companyId: company.id, docType: 'T1' } }),
    'Pagos T2': await prisma.clientPayment.count({ where: { companyId: company.id, docType: 'T2' } }),
    'Movimientos Ledger': await prisma.clientLedgerEntry.count({ where: { companyId: company.id } }),
  };

  for (const [key, count] of Object.entries(counts)) {
    console.log(`  ${key}: ${count}`);
  }

  console.log('\n✅ Seed completado exitosamente!');
  console.log('\n💡 Para probar los reportes:');
  console.log('   - Modo Standard (S): Verás solo datos T1');
  console.log('   - Modo Extended (E): Verás T1 + T2');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
