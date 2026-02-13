/**
 * Script de migración de datos T2 a BD secundaria
 *
 * Este script:
 * 1. Lee todos los datos con docType='T2' de la BD principal
 * 2. Los inserta en la BD secundaria (T2)
 * 3. Opcionalmente elimina los datos T2 de la BD principal
 *
 * Uso:
 * 1. Configurar DATABASE_URL_T2 en .env
 * 2. Generar cliente T2: npx prisma generate --schema=prisma/schema-t2.prisma
 * 3. Crear tablas T2: npx prisma db push --schema=prisma/schema-t2.prisma
 * 4. Ejecutar: npx ts-node prisma/migrate-t2-data.ts
 */

import { PrismaClient } from '@prisma/client';

// Verificar que tenemos DATABASE_URL_T2
if (!process.env.DATABASE_URL_T2) {
  console.error('ERROR: DATABASE_URL_T2 no está configurado en .env');
  process.exit(1);
}

// Importar cliente T2
let PrismaClientT2: any;
try {
  PrismaClientT2 = require('@prisma/client-t2').PrismaClient;
} catch (error) {
  console.error(
    'ERROR: Cliente Prisma T2 no encontrado.\n' +
      'Ejecutar primero: npx prisma generate --schema=prisma/schema-t2.prisma'
  );
  process.exit(1);
}

const prisma = new PrismaClient();
const prismaT2 = new PrismaClientT2();

interface MigrationStats {
  purchaseReceipts: number;
  purchaseReceiptItems: number;
  supplierAccountMovements: number;
  paymentOrders: number;
  stockMovements: number;
  errors: string[];
}

async function migrateT2Data(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    purchaseReceipts: 0,
    purchaseReceiptItems: 0,
    supplierAccountMovements: 0,
    paymentOrders: 0,
    stockMovements: 0,
    errors: [],
  };

  console.log('='.repeat(60));
  console.log('MIGRACIÓN DE DATOS T2 A BD SECUNDARIA');
  console.log('='.repeat(60));
  console.log('');

  try {
    // 1. Migrar PurchaseReceipts T2
    console.log('1. Migrando comprobantes de compra T2...');
    const t2Receipts = await prisma.purchaseReceipt.findMany({
      where: { docType: 'T2' },
      include: { items: true },
    });

    for (const receipt of t2Receipts) {
      try {
        await prismaT2.t2PurchaseReceipt.create({
          data: {
            companyId: receipt.companyId,
            supplierId: receipt.proveedorId,
            tipoCuentaId: receipt.tipoCuentaId,
            createdBy: receipt.createdBy,
            numeroSerie: receipt.numeroSerie,
            numeroFactura: receipt.numeroFactura,
            tipo: receipt.tipo,
            fechaEmision: receipt.fechaEmision,
            fechaVencimiento: receipt.fechaVencimiento,
            fechaImputacion: receipt.fechaImputacion,
            tipoPago: receipt.tipoPago,
            metodoPago: receipt.metodoPago,
            neto: receipt.neto,
            total: receipt.total,
            estado: receipt.estado,
            observaciones: receipt.observaciones,
            createdAt: receipt.createdAt,
            updatedAt: receipt.updatedAt,
          },
        });
        stats.purchaseReceipts++;

        // Migrar items del comprobante
        for (const item of receipt.items) {
          try {
            await prismaT2.t2PurchaseReceiptItem.create({
              data: {
                receiptId: stats.purchaseReceipts, // Nuevo ID en BD T2
                supplierItemId: item.supplierItemId,
                cantidad: item.cantidad,
                precioUnitario: item.precioUnitario,
                subtotal: item.subtotal,
                descripcion: item.descripcion,
                createdAt: item.createdAt,
              },
            });
            stats.purchaseReceiptItems++;
          } catch (itemError: any) {
            stats.errors.push(`Item receipt ${receipt.id}: ${itemError.message}`);
          }
        }
      } catch (receiptError: any) {
        stats.errors.push(`Receipt ${receipt.id}: ${receiptError.message}`);
      }
    }
    console.log(`   ✓ ${stats.purchaseReceipts} comprobantes migrados`);
    console.log(`   ✓ ${stats.purchaseReceiptItems} items migrados`);

    // 2. Migrar PaymentOrders T2
    console.log('2. Migrando órdenes de pago T2...');
    const t2PaymentOrders = await prisma.paymentOrder.findMany({
      where: { docType: 'T2' },
    });

    for (const order of t2PaymentOrders) {
      try {
        await prismaT2.t2PaymentOrder.create({
          data: {
            companyId: order.companyId,
            supplierId: order.proveedorId,
            createdBy: order.createdBy,
            fechaPago: order.fechaPago,
            totalPago: order.totalPago,
            efectivo: order.efectivo,
            transferencia: order.transferencia,
            notas: order.notas,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
          },
        });
        stats.paymentOrders++;
      } catch (error: any) {
        stats.errors.push(`PaymentOrder ${order.id}: ${error.message}`);
      }
    }
    console.log(`   ✓ ${stats.paymentOrders} órdenes de pago migradas`);

    // 3. Migrar SupplierAccountMovements T2
    console.log('3. Migrando movimientos de cuenta corriente T2...');
    const t2AccountMovements = await prisma.supplierAccountMovement.findMany({
      where: { docType: 'T2' },
    });

    for (const mov of t2AccountMovements) {
      try {
        await prismaT2.t2SupplierAccountMovement.create({
          data: {
            companyId: mov.companyId,
            supplierId: mov.supplierId,
            tipo: mov.tipo,
            fecha: mov.fecha,
            fechaVencimiento: mov.fechaVencimiento,
            debe: mov.debe,
            haber: mov.haber,
            saldoMovimiento: mov.saldoMovimiento,
            comprobante: mov.comprobante,
            descripcion: mov.descripcion,
            createdBy: mov.createdBy,
            createdAt: mov.createdAt,
            updatedAt: mov.updatedAt,
          },
        });
        stats.supplierAccountMovements++;
      } catch (error: any) {
        stats.errors.push(`AccountMovement ${mov.id}: ${error.message}`);
      }
    }
    console.log(`   ✓ ${stats.supplierAccountMovements} movimientos migrados`);

    // 4. Migrar StockMovements T2
    console.log('4. Migrando movimientos de stock T2...');
    const t2StockMovements = await prisma.stockMovement.findMany({
      where: { docType: 'T2' },
    });

    for (const mov of t2StockMovements) {
      try {
        await prismaT2.t2StockMovement.create({
          data: {
            companyId: mov.companyId,
            supplierItemId: mov.supplierItemId,
            warehouseId: mov.warehouseId,
            createdBy: mov.userId,
            tipo: mov.tipo,
            cantidad: mov.cantidad,
            cantidadAnterior: mov.cantidadAnterior,
            cantidadPosterior: mov.cantidadPosterior,
            costoUnitario: mov.costoUnitario,
            costoTotal: mov.costoTotal,
            codigoPropio: mov.codigoPropio,
            codigoProveedor: mov.codigoProveedor,
            descripcionItem: mov.descripcionItem,
            sourceNumber: mov.sourceNumber,
            motivo: mov.motivo,
            notas: mov.notas,
            createdAt: mov.createdAt,
          },
        });
        stats.stockMovements++;
      } catch (error: any) {
        stats.errors.push(`StockMovement ${mov.id}: ${error.message}`);
      }
    }
    console.log(`   ✓ ${stats.stockMovements} movimientos de stock migrados`);

    console.log('');
    console.log('='.repeat(60));
    console.log('RESUMEN DE MIGRACIÓN');
    console.log('='.repeat(60));
    console.log(`Comprobantes:           ${stats.purchaseReceipts}`);
    console.log(`Items de comprobantes:  ${stats.purchaseReceiptItems}`);
    console.log(`Órdenes de pago:        ${stats.paymentOrders}`);
    console.log(`Movimientos CC:         ${stats.supplierAccountMovements}`);
    console.log(`Movimientos stock:      ${stats.stockMovements}`);
    console.log('');

    if (stats.errors.length > 0) {
      console.log('ERRORES:');
      stats.errors.forEach((e) => console.log(`  - ${e}`));
    } else {
      console.log('✓ Migración completada sin errores');
    }

    console.log('');
    console.log('SIGUIENTE PASO:');
    console.log(
      'Para eliminar los datos T2 de la BD principal, descomentar las líneas de delete en este script.'
    );
  } catch (error) {
    console.error('ERROR FATAL:', error);
    throw error;
  }

  return stats;
}

// Función para limpiar datos T2 de BD principal (USAR CON CUIDADO)
async function cleanupT2FromMainDb() {
  console.log('');
  console.log('LIMPIEZA DE DATOS T2 EN BD PRINCIPAL');
  console.log('ADVERTENCIA: Esta operación es irreversible');
  console.log('');

  // Descomentar las siguientes líneas para ejecutar la limpieza:
  // await prisma.stockMovement.deleteMany({ where: { docType: 'T2' } });
  // await prisma.supplierAccountMovement.deleteMany({ where: { docType: 'T2' } });
  // await prisma.purchaseReceiptItem.deleteMany({
  //   where: { receipt: { docType: 'T2' } }
  // });
  // await prisma.paymentOrderReceipt.deleteMany({
  //   where: { paymentOrder: { docType: 'T2' } }
  // });
  // await prisma.paymentOrder.deleteMany({ where: { docType: 'T2' } });
  // await prisma.purchaseReceipt.deleteMany({ where: { docType: 'T2' } });

  console.log('Limpieza deshabilitada. Descomentar líneas en el código para ejecutar.');
}

// Ejecutar migración
async function main() {
  try {
    await migrateT2Data();
    // await cleanupT2FromMainDb(); // Descomentar para limpiar después de verificar
  } finally {
    await prisma.$disconnect();
    await prismaT2.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
