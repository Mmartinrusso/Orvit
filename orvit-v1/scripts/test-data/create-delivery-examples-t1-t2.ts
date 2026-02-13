/**
 * Script para crear ejemplos de entregas T1 (formal) y T2 (informal)
 * 
 * T1 = Formal/Fiscal: Con factura AFIP, remito oficial, etc.
 * T2 = Informal: Solo remito interno, sin factura fiscal
 * 
 * Ejecutar: npx tsx scripts/test-data/create-delivery-examples-t1-t2.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Creando ejemplos de entregas T1 y T2...\n');

  // Buscar o crear empresa de prueba
  let company = await prisma.company.findFirst({
    where: { name: { contains: 'TEST' } }
  });

  if (!company) {
    console.log('📝 Creando empresa de prueba...');
    company = await prisma.company.create({
      data: {
        name: 'TEST COMPANY - Entregas',
        cuit: '20-12345678-9',
      },
    });
  }

  console.log(`✅ Empresa: ${company.name} (ID: ${company.id})\n`);

  // Buscar o crear cliente de prueba
  let client = await prisma.client.findFirst({
    where: { companyId: company.id, legalName: { contains: 'ACME' } }
  });

  if (!client) {
    console.log('📝 Creando cliente de prueba...');
    client = await prisma.client.create({
      data: {
        companyId: company.id,
        legalName: 'ACME Corp SRL',
        fantasyName: 'ACME',
        cuit: '30-98765432-1',
        address: 'Av. Corrientes 1234, CABA',
        phone: '+5491112345678',
        email: 'compras@acme.com',
        clientTypeId: null,
      },
    });
  }

  console.log(`✅ Cliente: ${client.legalName} (ID: ${client.id})\n`);

  // Buscar o crear producto de prueba
  let product = await prisma.product.findFirst({
    where: { companyId: company.id }
  });

  if (!product) {
    console.log('📝 Creando producto de prueba...');
    product = await prisma.product.create({
      data: {
        companyId: company.id,
        name: 'Laptop Dell Inspiron 15',
        sku: 'DELL-INS-15-001',
        price: 850000,
        cost: 650000,
        stock: 100,
      },
    });
  }

  console.log(`✅ Producto: ${product.name} (ID: ${product.id})\n`);

  // ============================================================================
  // EJEMPLO T1: Venta FORMAL con Factura AFIP
  // ============================================================================
  console.log('📦 Creando ejemplo T1 (FORMAL - con factura AFIP)...\n');

  const saleT1 = await prisma.sale.create({
    data: {
      numero: 'VTA-T1-001',
      companyId: company.id,
      clientId: client.id,
      fecha: new Date(),
      subtotal: 850000,
      tax: 178500, // 21% IVA
      total: 1028500,
      docType: 'T1', // 🔑 FORMAL/FISCAL
      status: 'CONFIRMADA',
      items: {
        create: [
          {
            productId: product.id,
            cantidad: 1,
            precioUnitario: 850000,
            subtotal: 850000,
            alicuotaIVA: '21',
            iva: 178500,
            total: 1028500,
            cantidadEntregada: 0,
            cantidadPendiente: 1,
          },
        ],
      },
    },
    include: { items: true },
  });

  console.log(`✅ Orden de Venta T1 creada: ${saleT1.numero}`);
  console.log(`   - DocType: ${saleT1.docType}`);
  console.log(`   - Total: $${saleT1.total.toLocaleString()}`);
  console.log(`   - IVA: $${saleT1.tax?.toLocaleString()}\n`);

  // Crear entrega T1
  const deliveryT1 = await prisma.saleDelivery.create({
    data: {
      numero: 'ENT-T1-001',
      saleId: saleT1.id,
      clientId: client.id,
      fecha: new Date(),
      tipo: 'ENVIO',
      estado: 'PENDIENTE',
      direccionEntrega: 'Av. Corrientes 1234, CABA',
      docType: 'T1', // 🔑 FORMAL
      items: {
        create: [
          {
            saleItemId: saleT1.items[0].id,
            productId: product.id,
            cantidad: 1,
          },
        ],
      },
    },
  });

  console.log(`✅ Entrega T1 creada: ${deliveryT1.numero}`);
  console.log(`   - Estado: ${deliveryT1.estado}`);
  console.log(`   - Tipo: ${deliveryT1.tipo}`);
  console.log(`   - DocType: ${deliveryT1.docType} (Requiere factura AFIP)\n`);

  // ============================================================================
  // EJEMPLO T2: Venta INFORMAL sin Factura AFIP
  // ============================================================================
  console.log('📦 Creando ejemplo T2 (INFORMAL - solo remito)...\n');

  const saleT2 = await prisma.sale.create({
    data: {
      numero: 'VTA-T2-001',
      companyId: company.id,
      clientId: client.id,
      fecha: new Date(),
      subtotal: 850000,
      tax: 0, // Sin IVA en T2
      total: 850000,
      docType: 'T2', // 🔑 INFORMAL
      status: 'CONFIRMADA',
      items: {
        create: [
          {
            productId: product.id,
            cantidad: 1,
            precioUnitario: 850000,
            subtotal: 850000,
            alicuotaIVA: '0',
            iva: 0,
            total: 850000,
            cantidadEntregada: 0,
            cantidadPendiente: 1,
          },
        ],
      },
    },
    include: { items: true },
  });

  console.log(`✅ Orden de Venta T2 creada: ${saleT2.numero}`);
  console.log(`   - DocType: ${saleT2.docType}`);
  console.log(`   - Total: $${saleT2.total.toLocaleString()}`);
  console.log(`   - IVA: $0 (Informal)\n`);

  // Crear entrega T2
  const deliveryT2 = await prisma.saleDelivery.create({
    data: {
      numero: 'ENT-T2-001',
      saleId: saleT2.id,
      clientId: client.id,
      fecha: new Date(),
      tipo: 'RETIRO',
      estado: 'PENDIENTE',
      direccionEntrega: 'Retira en sucursal',
      docType: 'T2', // 🔑 INFORMAL
      items: {
        create: [
          {
            saleItemId: saleT2.items[0].id,
            productId: product.id,
            cantidad: 1,
          },
        ],
      },
    },
  });

  console.log(`✅ Entrega T2 creada: ${deliveryT2.numero}`);
  console.log(`   - Estado: ${deliveryT2.estado}`);
  console.log(`   - Tipo: ${deliveryT2.tipo}`);
  console.log(`   - DocType: ${deliveryT2.docType} (Solo remito interno)\n`);

  // ============================================================================
  // RESUMEN
  // ============================================================================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 RESUMEN DE EJEMPLOS CREADOS\n');
  
  console.log('🔵 T1 (FORMAL/FISCAL):');
  console.log(`   Venta: ${saleT1.numero}`);
  console.log(`   Entrega: ${deliveryT1.numero}`);
  console.log(`   Total con IVA: $${saleT1.total.toLocaleString()}`);
  console.log(`   Requiere: Factura AFIP tipo A/B/C\n`);
  
  console.log('🟢 T2 (INFORMAL):');
  console.log(`   Venta: ${saleT2.numero}`);
  console.log(`   Entrega: ${deliveryT2.numero}`);
  console.log(`   Total sin IVA: $${saleT2.total.toLocaleString()}`);
  console.log(`   Requiere: Solo remito interno\n`);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n✅ Datos de ejemplo creados exitosamente!');
  console.log('\n💡 Próximo paso: Verificar en el frontend que ambos tipos se muestren correctamente');
  console.log('   - Ir a /administracion/ventas/entregas');
  console.log('   - Ver filtro ViewMode (S = solo T1, E = T1+T2)');
  console.log('   - Verificar que ENT-T1-001 y ENT-T2-001 aparezcan según el modo\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
