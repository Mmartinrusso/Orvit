/**
 * Seed T1 Extra - Crear datos adicionales T1 (documentados/blanco)
 * Para probar la diferencia entre ViewMode Standard y Extended
 */

import { PrismaClient, DocType } from '@prisma/client';

const prisma = new PrismaClient();

async function seedT1Data() {
  console.log('📄 Creando datos T1 (documentados/blanco)...\n');

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
          name: 'Proveedor T1 Test',
          razon_social: 'Proveedor T1 Test SRL',
          cuit: '30-11111111-1',
          company_id: company.id,
          condicion_iva: 'Responsable Inscripto',
        }
      });
    }
    console.log('✅ Proveedor:', proveedor.name);

    // Obtener tipo de cuenta
    let tipoCuenta = await prisma.purchaseAccount.findFirst({ where: { companyId: company.id } });
    if (!tipoCuenta) {
      tipoCuenta = await prisma.purchaseAccount.create({
        data: { nombre: 'Cuenta General', companyId: company.id }
      });
    }
    console.log('✅ Tipo cuenta:', tipoCuenta.nombre);

    // Crear facturas T1
    console.log('\n📄 Creando 10 facturas T1...');
    const baseTime = Math.floor(Date.now() / 1000) % 100000;

    for (let i = 1; i <= 10; i++) {
      const total = 10000 + (i * 5000);
      const neto = total / 1.21;
      const iva = total - neto;

      await prisma.purchaseReceipt.create({
        data: {
          numeroSerie: '0001',
          numeroFactura: `A-${baseTime}-${String(i).padStart(4, '0')}`,
          tipo: 'FC',
          proveedorId: proveedor.id,
          fechaEmision: new Date(Date.now() - (i * 2 * 24 * 60 * 60 * 1000)),
          fechaImputacion: new Date(Date.now() - (i * 2 * 24 * 60 * 60 * 1000)),
          fechaVencimiento: new Date(Date.now() + (30 - i) * 24 * 60 * 60 * 1000),
          tipoPago: i % 3 === 0 ? 'contado' : 'credito',
          neto: neto,
          iva21: iva,
          total: total,
          estado: i % 3 === 0 ? 'pagada' : 'pendiente',
          docType: 'T1' as DocType,
          tipoCuentaId: tipoCuenta.id,
          companyId: company.id,
          createdBy: user.id,
        }
      });
      console.log(`   ✅ Factura T1 #${i}: $${total.toLocaleString()}`);
    }

    // Crear órdenes de compra T1
    console.log('\n📋 Creando 5 órdenes de compra T1...');
    const estados = ['BORRADOR', 'PENDIENTE_APROBACION', 'APROBADA', 'ENVIADA_PROVEEDOR', 'COMPLETADA'] as const;

    for (let i = 1; i <= 5; i++) {
      const total = 20000 + (i * 10000);
      const subtotal = total / 1.21;
      const impuestos = total - subtotal;

      await prisma.purchaseOrder.create({
        data: {
          numero: `OC-${baseTime}-${String(i).padStart(3, '0')}`,
          proveedorId: proveedor.id,
          fechaEmision: new Date(Date.now() - (i * 3 * 24 * 60 * 60 * 1000)),
          fechaEntregaEsperada: new Date(Date.now() + (i * 5 * 24 * 60 * 60 * 1000)),
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

    // Contar datos finales
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN FINAL DE DATOS');
    console.log('='.repeat(60));

    const t1Receipts = await prisma.purchaseReceipt.count({ where: { companyId: company.id, docType: 'T1' } });
    const t2Receipts = await prisma.purchaseReceipt.count({ where: { companyId: company.id, docType: 'T2' } });
    const totalReceipts = await prisma.purchaseReceipt.count({ where: { companyId: company.id } });
    const nullReceipts = totalReceipts - t1Receipts - t2Receipts;

    const t1Orders = await prisma.purchaseOrder.count({ where: { companyId: company.id, docType: 'T1' } });
    const t2Orders = await prisma.purchaseOrder.count({ where: { companyId: company.id, docType: 'T2' } });
    const totalOrders = await prisma.purchaseOrder.count({ where: { companyId: company.id } });
    const nullOrders = totalOrders - t1Orders - t2Orders;

    console.log('\n📄 Comprobantes (PurchaseReceipt):');
    console.log(`   T1 (blanco):    ${t1Receipts}`);
    console.log(`   T2 (negro):     ${t2Receipts}`);
    console.log(`   null (legacy):  ${nullReceipts}`);
    console.log(`   TOTAL:          ${t1Receipts + t2Receipts + nullReceipts}`);

    console.log('\n📋 Órdenes de Compra (PurchaseOrder):');
    console.log(`   T1 (blanco):    ${t1Orders}`);
    console.log(`   T2 (negro):     ${t2Orders}`);
    console.log(`   null (legacy):  ${nullOrders}`);
    console.log(`   TOTAL:          ${t1Orders + t2Orders + nullOrders}`);

    console.log('\n' + '='.repeat(60));
    console.log('🔍 VERIFICACIÓN DE VIEWMODE:');
    console.log('='.repeat(60));
    console.log('');
    console.log('ViewMode STANDARD (S) - Sin juego de tecla:');
    console.log(`   - Verás ${t1Receipts + nullReceipts} comprobantes (T1 + legacy)`);
    console.log(`   - Verás ${t1Orders + nullOrders} órdenes de compra`);
    console.log('');
    console.log('ViewMode EXTENDED (E) - Con juego de tecla:');
    console.log(`   - Verás ${t1Receipts + t2Receipts + nullReceipts} comprobantes (TODOS)`);
    console.log(`   - Verás ${t1Orders + t2Orders + nullOrders} órdenes de compra`);
    console.log('');
    console.log(`⚡ Diferencia: ${t2Receipts} comprobantes T2 y ${t2Orders} OC T2 ocultos en Standard`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedT1Data()
  .then(() => {
    console.log('🎉 Seed T1 completado!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
