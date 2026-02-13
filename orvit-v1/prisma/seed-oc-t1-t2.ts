/**
 * Seed OC T1 y T2 - Crear órdenes de compra en ambos modos
 */

import { PrismaClient, DocType } from '@prisma/client';

const prisma = new PrismaClient();

async function seedOC() {
  console.log('📋 Creando Órdenes de Compra T1 y T2...\n');

  try {
    // Obtener empresa
    const company = await prisma.company.findFirst({ select: { id: true, name: true } });
    if (!company) {
      console.log('❌ No hay empresa');
      return;
    }
    console.log('✅ Empresa:', company.name);

    // Obtener usuario
    const user = await prisma.user.findFirst({
      where: { companies: { some: { companyId: company.id } } }
    });
    if (!user) {
      console.log('❌ No hay usuario');
      return;
    }
    console.log('✅ Usuario:', user.name);

    // Obtener proveedor
    let proveedor = await prisma.suppliers.findFirst({ where: { company_id: company.id } });
    if (!proveedor) {
      proveedor = await prisma.suppliers.create({
        data: {
          name: 'Proveedor OC Test',
          razon_social: 'Proveedor OC Test SRL',
          cuit: '30-22222222-2',
          company_id: company.id,
          condicion_iva: 'Responsable Inscripto',
        }
      });
    }
    console.log('✅ Proveedor:', proveedor.name);

    const baseTime = Math.floor(Date.now() / 1000) % 100000;
    const estados = ['BORRADOR', 'PENDIENTE_APROBACION', 'APROBADA', 'ENVIADA_PROVEEDOR', 'COMPLETADA'] as const;

    // Crear 5 OC T1 (blanco/documentado)
    console.log('\n📋 Creando 5 órdenes de compra T1 (blanco)...');
    for (let i = 1; i <= 5; i++) {
      const total = 15000 + (i * 8000);
      const subtotal = total / 1.21;
      const impuestos = total - subtotal;

      await prisma.purchaseOrder.create({
        data: {
          numero: `OC-T1-${baseTime}-${String(i).padStart(3, '0')}`,
          proveedorId: proveedor.id,
          fechaEmision: new Date(Date.now() - (i * 2 * 24 * 60 * 60 * 1000)),
          fechaEntregaEsperada: new Date(Date.now() + (i * 7 * 24 * 60 * 60 * 1000)),
          estado: estados[i - 1],
          subtotal: subtotal,
          impuestos: impuestos,
          total: total,
          docType: 'T1' as DocType,
          companyId: company.id,
          createdBy: user.id,
        }
      });
      console.log(`   ✅ OC T1 #${i}: $${total.toLocaleString()} (${estados[i-1]})`);
    }

    // Crear 5 OC T2 (negro/no documentado)
    console.log('\n📋 Creando 5 órdenes de compra T2 (negro)...');
    for (let i = 1; i <= 5; i++) {
      const total = 25000 + (i * 12000);
      const subtotal = total / 1.21;
      const impuestos = total - subtotal;

      await prisma.purchaseOrder.create({
        data: {
          numero: `OC-T2-${baseTime}-${String(i).padStart(3, '0')}`,
          proveedorId: proveedor.id,
          fechaEmision: new Date(Date.now() - (i * 3 * 24 * 60 * 60 * 1000)),
          fechaEntregaEsperada: new Date(Date.now() + (i * 10 * 24 * 60 * 60 * 1000)),
          estado: estados[i - 1],
          subtotal: subtotal,
          impuestos: impuestos,
          total: total,
          docType: 'T2' as DocType,
          companyId: company.id,
          createdBy: user.id,
        }
      });
      console.log(`   ✅ OC T2 #${i}: $${total.toLocaleString()} (${estados[i-1]})`);
    }

    // Resumen
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN ÓRDENES DE COMPRA');
    console.log('='.repeat(60));

    const t1Orders = await prisma.purchaseOrder.count({ where: { companyId: company.id, docType: 'T1' } });
    const t2Orders = await prisma.purchaseOrder.count({ where: { companyId: company.id, docType: 'T2' } });
    const totalOrders = await prisma.purchaseOrder.count({ where: { companyId: company.id } });
    const nullOrders = totalOrders - t1Orders - t2Orders;

    console.log(`\n   T1 (blanco):    ${t1Orders}`);
    console.log(`   T2 (negro):     ${t2Orders}`);
    console.log(`   null (legacy):  ${nullOrders}`);
    console.log(`   TOTAL:          ${totalOrders}`);

    console.log('\n' + '='.repeat(60));
    console.log('✨ Las OC ahora se ven en AMBOS modos (no filtran por ViewMode)');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedOC()
  .then(() => {
    console.log('🎉 Seed OC completado!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
