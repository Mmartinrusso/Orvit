/**
 * Seed de datos T2 (ViewMode Extended) para pruebas
 *
 * Este script crea datos de prueba para verificar el funcionamiento de ViewMode:
 * - Comprobantes T1 (documentados)
 * - Comprobantes T2 (extendidos - solo visibles en modo Extended)
 * - Comprobantes legacy (docType = null, tratados como T1)
 * - Ordenes de compra T1 y T2
 * - Recepciones T2 con impacto en stock
 *
 * Ejecutar: npx ts-node prisma/seed-t2-compras.ts
 */

import { PrismaClient, DocType } from '@prisma/client';

const prisma = new PrismaClient();

interface SeedStats {
  purchaseReceipts: { T1: number; T2: number; null: number };
  purchaseOrders: { T1: number; T2: number; null: number };
  goodsReceipts: { T1: number; T2: number; null: number };
  stockMovements: { T1: number; T2: number; null: number };
  accountMovements: { T1: number; T2: number; null: number };
  auditLogs: { T1: number; T2: number; null: number };
}

async function seedT2Data() {
  console.log('🔐 Iniciando seed de datos T2 (ViewMode Extended)...\n');

  const stats: SeedStats = {
    purchaseReceipts: { T1: 0, T2: 0, null: 0 },
    purchaseOrders: { T1: 0, T2: 0, null: 0 },
    goodsReceipts: { T1: 0, T2: 0, null: 0 },
    stockMovements: { T1: 0, T2: 0, null: 0 },
    accountMovements: { T1: 0, T2: 0, null: 0 },
    auditLogs: { T1: 0, T2: 0, null: 0 },
  };

  try {
    // 1. Obtener la primera empresa
    const company = await prisma.company.findFirst({
      select: { id: true, name: true }
    });

    if (!company) {
      console.log('⚠️  No se encontraron empresas. Abortando seed.');
      return;
    }

    console.log(`📊 Empresa: ${company.name} (ID: ${company.id})\n`);

    // 2. Obtener usuario
    const user = await prisma.user.findFirst({
      where: {
        companies: {
          some: { companyId: company.id }
        }
      },
      select: { id: true, name: true }
    });

    if (!user) {
      console.log('⚠️  No se encontró usuario para la empresa.');
      return;
    }

    console.log(`👤 Usuario: ${user.name} (ID: ${user.id})\n`);

    // 3. Obtener o crear proveedor de prueba
    let proveedor = await prisma.suppliers.findFirst({
      where: { company_id: company.id }
    });

    if (!proveedor) {
      proveedor = await prisma.suppliers.create({
        data: {
          name: 'Proveedor Test ViewMode',
          razon_social: 'Proveedor Test ViewMode SRL',
          cuit: '30-12345678-9',
          company_id: company.id,
        }
      });
      console.log(`✅ Proveedor creado: ${proveedor.name}\n`);
    } else {
      console.log(`✅ Proveedor existente: ${proveedor.name}\n`);
    }

    // 4. Obtener o crear tipo de cuenta
    let tipoCuenta = await prisma.purchaseAccount.findFirst({
      where: { companyId: company.id }
    });

    if (!tipoCuenta) {
      tipoCuenta = await prisma.purchaseAccount.create({
        data: {
          nombre: 'Cuenta General',
          companyId: company.id,
        }
      });
      console.log(`✅ Tipo cuenta creado: ${tipoCuenta.nombre}\n`);
    }

    // 5. Crear comprobantes T1 (documentados)
    console.log('📄 Creando comprobantes T1 (documentados)...');
    for (let i = 1; i <= 3; i++) {
      await prisma.purchaseReceipt.create({
        data: {
          numeroSerie: '0001',
          numeroFactura: `T1-${Math.floor(Date.now() / 1000) % 100000}-${i}`,
          tipo: 'FC',
          proveedorId: proveedor.id,
          fechaEmision: new Date(),
          fechaImputacion: new Date(),
          tipoPago: 'credito',
          neto: 10000 * i,
          iva21: 2100 * i,
          total: 12100 * i,
          estado: 'pendiente',
          docType: 'T1' as DocType,
          tipoCuentaId: tipoCuenta.id,
          companyId: company.id,
          createdBy: user.id,
        }
      });
      stats.purchaseReceipts.T1++;
    }
    console.log(`   ✅ ${stats.purchaseReceipts.T1} comprobantes T1 creados\n`);

    // 6. Crear comprobantes T2 (extendidos - solo visibles en modo Extended)
    console.log('🔒 Creando comprobantes T2 (extendidos)...');
    for (let i = 1; i <= 2; i++) {
      await prisma.purchaseReceipt.create({
        data: {
          numeroSerie: 'X',
          numeroFactura: `T2-${Math.floor(Date.now() / 1000) % 100000}-${i}`,
          tipo: 'X',
          proveedorId: proveedor.id,
          fechaEmision: new Date(),
          fechaImputacion: new Date(),
          tipoPago: 'contado',
          neto: 5000 * i,
          iva21: 0,
          total: 5000 * i,
          estado: 'pendiente',
          docType: 'T2' as DocType,
          tipoCuentaId: tipoCuenta.id,
          companyId: company.id,
          createdBy: user.id,
        }
      });
      stats.purchaseReceipts.T2++;
    }
    console.log(`   ✅ ${stats.purchaseReceipts.T2} comprobantes T2 creados\n`);

    // 7. Crear comprobantes legacy (docType = null, tratados como T1)
    console.log('📜 Creando comprobantes legacy (null = T1)...');
    for (let i = 1; i <= 2; i++) {
      await prisma.purchaseReceipt.create({
        data: {
          numeroSerie: '0001',
          numeroFactura: `LEG${i}-${Math.floor(Date.now() / 1000) % 100000}`,
          tipo: 'FC',
          proveedorId: proveedor.id,
          fechaEmision: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 días atrás
          fechaImputacion: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          tipoPago: 'credito',
          neto: 8000 * i,
          iva21: 1680 * i,
          total: 9680 * i,
          estado: 'pagada',
          docType: null, // Legacy - sin docType
          tipoCuentaId: tipoCuenta.id,
          companyId: company.id,
          createdBy: user.id,
        }
      });
      stats.purchaseReceipts.null++;
    }
    console.log(`   ✅ ${stats.purchaseReceipts.null} comprobantes legacy (null) creados\n`);

    // 8. Crear órdenes de compra T1
    console.log('📋 Creando órdenes de compra T1...');
    for (let i = 1; i <= 2; i++) {
      await prisma.purchaseOrder.create({
        data: {
          numero: `OC-T1-${Date.now()}-${i}`,
          proveedorId: proveedor.id,
          fechaEmision: new Date(),
          estado: 'BORRADOR',
          subtotal: 15000 * i,
          impuestos: 3150 * i,
          total: 18150 * i,
          docType: 'T1' as DocType,
          companyId: company.id,
          createdBy: user.id,
        }
      });
      stats.purchaseOrders.T1++;
    }
    console.log(`   ✅ ${stats.purchaseOrders.T1} órdenes T1 creadas\n`);

    // 9. Crear órdenes de compra T2
    console.log('🔒 Creando órdenes de compra T2...');
    await prisma.purchaseOrder.create({
      data: {
        numero: `OC-T2-${Date.now()}`,
        proveedorId: proveedor.id,
        fechaEmision: new Date(),
        estado: 'BORRADOR',
        subtotal: 20000,
        impuestos: 0,
        total: 20000,
        docType: 'T2' as DocType,
        companyId: company.id,
        createdBy: user.id,
      }
    });
    stats.purchaseOrders.T2++;
    console.log(`   ✅ ${stats.purchaseOrders.T2} órdenes T2 creadas\n`);

    // 10. Crear nota de crédito T2 (caso límite)
    console.log('📝 Creando nota de crédito T2 (caso límite)...');
    await prisma.purchaseReceipt.create({
      data: {
        numeroSerie: 'X',
        numeroFactura: `NC-T2-${Math.floor(Date.now() / 1000) % 100000}`,
        tipo: 'NC',
        proveedorId: proveedor.id,
        fechaEmision: new Date(),
        fechaImputacion: new Date(),
        tipoPago: 'credito',
        neto: -2000,
        iva21: 0,
        total: -2000,
        estado: 'pendiente',
        docType: 'T2' as DocType,
        tipoCuentaId: tipoCuenta.id,
        companyId: company.id,
        createdBy: user.id,
      }
    });
    stats.purchaseReceipts.T2++;
    console.log(`   ✅ Nota de crédito T2 creada\n`);

    // 11. Crear warehouse y supplierItem para movimientos de stock
    console.log('📦 Preparando datos para movimientos de stock...');

    let warehouse = await prisma.warehouse.findFirst({
      where: { companyId: company.id, isActive: true }
    });

    if (!warehouse) {
      warehouse = await prisma.warehouse.create({
        data: {
          codigo: 'DEP-TEST',
          nombre: 'Depósito Test ViewMode',
          direccion: 'Dirección test',
          companyId: company.id,
          isActive: true,
          isTransit: false,
        }
      });
      console.log(`   ✅ Warehouse creado: ${warehouse.nombre}\n`);
    } else {
      console.log(`   ✅ Warehouse existente: ${warehouse.nombre}\n`);
    }

    // Primero necesitamos un Supply para crear SupplierItem
    let supply = await prisma.supplies.findFirst({
      where: { company_id: company.id }
    });

    if (!supply) {
      supply = await prisma.supplies.create({
        data: {
          name: 'Insumo Test ViewMode',
          unit_measure: 'UN',
          company_id: company.id,
        }
      });
      console.log(`   ✅ Supply creado: ${supply.name}\n`);
    } else {
      console.log(`   ✅ Supply existente: ${supply.name}\n`);
    }

    let supplierItem = await prisma.supplierItem.findFirst({
      where: { supplierId: proveedor.id }
    });

    if (!supplierItem) {
      supplierItem = await prisma.supplierItem.create({
        data: {
          nombre: 'Item Test ViewMode',
          codigoProveedor: 'ITEM-TEST-001',
          unidad: 'UN',
          precioUnitario: 1000,
          supplierId: proveedor.id,
          supplyId: supply.id,
          companyId: company.id,
        }
      });
      console.log(`   ✅ SupplierItem creado: ${supplierItem.nombre}\n`);
    } else {
      console.log(`   ✅ SupplierItem existente: ${supplierItem.nombre}\n`);
    }

    // Crear o actualizar StockLocation
    let stockLocation = await prisma.stockLocation.findUnique({
      where: {
        warehouseId_supplierItemId: {
          warehouseId: warehouse.id,
          supplierItemId: supplierItem.id,
        }
      }
    });

    if (!stockLocation) {
      stockLocation = await prisma.stockLocation.create({
        data: {
          warehouseId: warehouse.id,
          supplierItemId: supplierItem.id,
          cantidad: 0,
          cantidadReservada: 0,
          stockMinimo: 10,
          stockMaximo: 100,
          costoUnitario: 1000,
          companyId: company.id,
        }
      });
    }

    // 12. Crear movimientos de stock T1
    console.log('📦 Creando movimientos de stock T1...');
    for (let i = 1; i <= 3; i++) {
      await prisma.stockMovement.create({
        data: {
          tipo: 'ENTRADA_RECEPCION',
          cantidad: 10 * i,
          cantidadAnterior: 0,
          cantidadPosterior: 10 * i,
          costoUnitario: 1000,
          supplierItemId: supplierItem.id,
          warehouseId: warehouse.id,
          sourceNumber: `REC-T1-${Date.now()}-${i}`,
          motivo: 'Recepción de prueba T1',
          docType: 'T1' as DocType,
          companyId: company.id,
          createdBy: user.id,
        }
      });
      stats.stockMovements.T1++;
    }
    console.log(`   ✅ ${stats.stockMovements.T1} movimientos T1 creados\n`);

    // 13. Crear movimientos de stock T2
    console.log('🔒 Creando movimientos de stock T2...');
    for (let i = 1; i <= 2; i++) {
      await prisma.stockMovement.create({
        data: {
          tipo: 'ENTRADA_RECEPCION',
          cantidad: 20 * i,
          cantidadAnterior: 0,
          cantidadPosterior: 20 * i,
          costoUnitario: 800,
          supplierItemId: supplierItem.id,
          warehouseId: warehouse.id,
          sourceNumber: `REC-T2-${Date.now()}-${i}`,
          motivo: 'Recepción de prueba T2 (extendido)',
          docType: 'T2' as DocType,
          companyId: company.id,
          createdBy: user.id,
        }
      });
      stats.stockMovements.T2++;
    }
    console.log(`   ✅ ${stats.stockMovements.T2} movimientos T2 creados\n`);

    // 14. Crear movimientos de cuenta corriente T1
    console.log('💰 Creando movimientos cuenta corriente T1...');
    for (let i = 1; i <= 2; i++) {
      try {
        await prisma.supplierAccountMovement.create({
          data: {
            supplierId: proveedor.id,
            companyId: company.id,
            tipo: 'FACTURA',
            fecha: new Date(),
            fechaVencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            debe: 12100 * i,
            haber: 0,
            saldoMovimiento: 12100 * i,
            comprobante: `FC-T1-${Date.now()}-${i}`,
            descripcion: 'Factura de prueba T1',
            docType: 'T1' as DocType,
            createdBy: user.id,
          }
        });
        stats.accountMovements.T1++;
      } catch (e) {
        console.log('   ⚠️ Tabla SupplierAccountMovement no disponible, saltando...');
        break;
      }
    }
    if (stats.accountMovements.T1 > 0) {
      console.log(`   ✅ ${stats.accountMovements.T1} movimientos T1 creados\n`);
    }

    // 15. Crear movimientos de cuenta corriente T2
    console.log('🔒 Creando movimientos cuenta corriente T2...');
    for (let i = 1; i <= 2; i++) {
      try {
        await prisma.supplierAccountMovement.create({
          data: {
            supplierId: proveedor.id,
            companyId: company.id,
            tipo: 'FACTURA',
            fecha: new Date(),
            fechaVencimiento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
            debe: 5000 * i,
            haber: 0,
            saldoMovimiento: 5000 * i,
            comprobante: `X-T2-${Date.now()}-${i}`,
            descripcion: 'Factura de prueba T2 (extendido)',
            docType: 'T2' as DocType,
            createdBy: user.id,
          }
        });
        stats.accountMovements.T2++;
      } catch (e) {
        break;
      }
    }
    if (stats.accountMovements.T2 > 0) {
      console.log(`   ✅ ${stats.accountMovements.T2} movimientos T2 creados\n`);
    }

    // 16. Crear entradas de historial (PurchaseAuditLog) T1
    console.log('📜 Creando entradas de historial (audit log) T1...');
    for (let i = 1; i <= 3; i++) {
      try {
        await prisma.purchaseAuditLog.create({
          data: {
            entidad: 'purchase_receipt',
            entidadId: i,
            accion: 'create',
            datosNuevos: { estado: 'pendiente', monto: 10000 * i },
            userId: user.id,
            companyId: company.id,
            docType: 'T1' as DocType,
          }
        });
        stats.auditLogs.T1++;
      } catch (e) {
        console.log('   ⚠️ Tabla PurchaseAuditLog no disponible, saltando...');
        break;
      }
    }
    if (stats.auditLogs.T1 > 0) {
      console.log(`   ✅ ${stats.auditLogs.T1} entradas T1 creadas\n`);
    }

    // 17. Crear entradas de historial (PurchaseAuditLog) T2
    console.log('🔒 Creando entradas de historial (audit log) T2...');
    for (let i = 1; i <= 3; i++) {
      try {
        await prisma.purchaseAuditLog.create({
          data: {
            entidad: 'purchase_receipt',
            entidadId: 1000 + i, // IDs altos para T2
            accion: 'create',
            datosNuevos: { estado: 'pendiente', monto: 5000 * i, tipo: 'X' },
            userId: user.id,
            companyId: company.id,
            docType: 'T2' as DocType,
          }
        });
        stats.auditLogs.T2++;
      } catch (e) {
        break;
      }
    }
    // Crear también un update T2
    try {
      await prisma.purchaseAuditLog.create({
        data: {
          entidad: 'purchase_order',
          entidadId: 2001,
          accion: 'status_change',
          datosAnteriores: { estado: 'BORRADOR' },
          datosNuevos: { estado: 'APROBADA' },
          userId: user.id,
          companyId: company.id,
          docType: 'T2' as DocType,
        }
      });
      stats.auditLogs.T2++;
    } catch (e) { /* ignore */ }
    if (stats.auditLogs.T2 > 0) {
      console.log(`   ✅ ${stats.auditLogs.T2} entradas T2 creadas\n`);
    }

    // 18. Crear entradas de historial legacy (docType = null)
    // Usar raw query para poder insertar null directamente
    console.log('📜 Creando entradas de historial legacy (null)...');
    for (let i = 1; i <= 2; i++) {
      try {
        const datosJson = JSON.stringify({ estado: 'pendiente', monto: 8000 * i });
        await prisma.$executeRawUnsafe(
          `INSERT INTO "PurchaseAuditLog" ("entidad", "entidadId", "accion", "datosNuevos", "userId", "companyId", "docType", "createdAt")
           VALUES ('purchase_receipt', $1, 'create', $2::jsonb, $3, $4, NULL, NOW())`,
          500 + i,
          datosJson,
          user.id,
          company.id
        );
        stats.auditLogs.null++;
      } catch (e) {
        console.log('   ⚠️ Error creando entrada legacy:', e);
        break;
      }
    }
    if (stats.auditLogs.null > 0) {
      console.log(`   ✅ ${stats.auditLogs.null} entradas legacy (null) creadas\n`);
    }

    // Resumen final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE DATOS CREADOS');
    console.log('='.repeat(60));
    console.log('\nPurchaseReceipt (Comprobantes):');
    console.log(`   T1 (documentados):     ${stats.purchaseReceipts.T1}`);
    console.log(`   T2 (extendidos):       ${stats.purchaseReceipts.T2}`);
    console.log(`   null (legacy):         ${stats.purchaseReceipts.null}`);
    console.log(`   TOTAL:                 ${stats.purchaseReceipts.T1 + stats.purchaseReceipts.T2 + stats.purchaseReceipts.null}`);

    console.log('\nPurchaseOrder (Órdenes de Compra):');
    console.log(`   T1 (documentados):     ${stats.purchaseOrders.T1}`);
    console.log(`   T2 (extendidos):       ${stats.purchaseOrders.T2}`);
    console.log(`   TOTAL:                 ${stats.purchaseOrders.T1 + stats.purchaseOrders.T2}`);

    console.log('\nStockMovement (Movimientos de Stock):');
    console.log(`   T1 (documentados):     ${stats.stockMovements.T1}`);
    console.log(`   T2 (extendidos):       ${stats.stockMovements.T2}`);
    console.log(`   TOTAL:                 ${stats.stockMovements.T1 + stats.stockMovements.T2}`);

    if (stats.accountMovements.T1 > 0 || stats.accountMovements.T2 > 0) {
      console.log('\nSupplierAccountMovement (Cuenta Corriente):');
      console.log(`   T1 (documentados):     ${stats.accountMovements.T1}`);
      console.log(`   T2 (extendidos):       ${stats.accountMovements.T2}`);
      console.log(`   TOTAL:                 ${stats.accountMovements.T1 + stats.accountMovements.T2}`);
    }

    if (stats.auditLogs.T1 > 0 || stats.auditLogs.T2 > 0 || stats.auditLogs.null > 0) {
      console.log('\nPurchaseAuditLog (Historial):');
      console.log(`   T1 (documentados):     ${stats.auditLogs.T1}`);
      console.log(`   T2 (extendidos):       ${stats.auditLogs.T2}`);
      console.log(`   null (legacy):         ${stats.auditLogs.null}`);
      console.log(`   TOTAL:                 ${stats.auditLogs.T1 + stats.auditLogs.T2 + stats.auditLogs.null}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ VERIFICACIÓN DE VIEWMODE:');
    console.log('='.repeat(60));
    console.log('');
    console.log('En modo STANDARD (S):');
    console.log(`   - Verás ${stats.purchaseReceipts.T1 + stats.purchaseReceipts.null} comprobantes (T1 + legacy)`);
    console.log(`   - Verás ${stats.purchaseOrders.T1} órdenes de compra`);
    console.log(`   - Stock KPIs calculados con ${stats.stockMovements.T1} movimientos T1`);
    console.log(`   - Historial: ${stats.auditLogs.T1 + stats.auditLogs.null} entradas (T1 + legacy)`);
    console.log('');
    console.log('En modo EXTENDED (E):');
    console.log(`   - Verás ${stats.purchaseReceipts.T1 + stats.purchaseReceipts.T2 + stats.purchaseReceipts.null} comprobantes (todos)`);
    console.log(`   - Verás ${stats.purchaseOrders.T1 + stats.purchaseOrders.T2} órdenes de compra`);
    console.log(`   - Stock KPIs calculados con ${stats.stockMovements.T1 + stats.stockMovements.T2} movimientos (todos)`);
    console.log(`   - Historial: ${stats.auditLogs.T1 + stats.auditLogs.T2 + stats.auditLogs.null} entradas (todos)`);
    console.log('');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error durante el seed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
seedT2Data()
  .then(() => {
    console.log('🎉 Seed T2 completado!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
