/**
 * Script para reparar historial de precios
 *
 * Ejecutar con: npx tsx scripts/fix-price-history.ts
 *
 * Opciones:
 *   --dry-run    Solo simular, no aplicar cambios (default)
 *   --apply      Aplicar los cambios
 *   --limit=N    Procesar máximo N facturas (default: 1000)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 1000;

  console.log('🔧 Fix Price History Script');
  console.log('===========================');
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (simulación)' : '⚡ APLICAR CAMBIOS'}`);
  console.log(`Limit: ${limit} facturas\n`);

  // Obtener todas las empresas
  const companies = await prisma.company.findMany({
    select: { id: true, name: true }
  });

  let totalGlobalCorregidos = 0;
  let totalGlobalFacturas = 0;

  for (const company of companies) {
    console.log(`\n📦 Empresa: ${company.name} (ID: ${company.id})`);
    console.log('-'.repeat(50));

    // Buscar facturas pagadas T1
    const facturasPagadas = await prisma.purchaseReceipt.findMany({
      where: {
        companyId: company.id,
        estado: 'pagada',
        OR: [{ docType: 'T1' }, { docType: null }],
      },
      select: {
        id: true,
        numeroSerie: true,
        numeroFactura: true,
        fechaEmision: true,
        total: true,
        items: {
          select: {
            id: true,
            itemId: true,
            descripcion: true,
            cantidad: true,
            precioUnitario: true,
          }
        }
      },
      take: limit,
      orderBy: { fechaEmision: 'desc' }
    });

    console.log(`   Facturas pagadas encontradas: ${facturasPagadas.length}`);

    let itemsCorregidos = 0;
    let itemsSinSupplierItem = 0;
    let itemsYaTenianHistorial = 0;
    let facturasAfectadas = 0;

    for (const factura of facturasPagadas) {
      let facturaModificada = false;

      for (const item of factura.items) {
        // Solo procesar items con supplierItemId y precio > 0
        if (!item.itemId) {
          itemsSinSupplierItem++;
          continue;
        }

        const precioUnitario = Number(item.precioUnitario || 0);
        if (precioUnitario <= 0) {
          itemsSinSupplierItem++;
          continue;
        }

        // Verificar si ya existe historial
        const existeHistorial = await prisma.priceHistory.findFirst({
          where: {
            supplierItemId: item.itemId,
            comprobanteId: factura.id,
          }
        });

        if (existeHistorial) {
          itemsYaTenianHistorial++;
          continue;
        }

        // Crear historial de precios
        if (!dryRun) {
          await prisma.priceHistory.create({
            data: {
              supplierItemId: item.itemId,
              precioUnitario: precioUnitario,
              comprobanteId: factura.id,
              fecha: factura.fechaEmision,
              companyId: company.id,
            }
          });

          // Actualizar precio del SupplierItem si está en 0
          const supplierItem = await prisma.supplierItem.findUnique({
            where: { id: item.itemId },
            select: { precioUnitario: true }
          });

          if (!supplierItem?.precioUnitario || Number(supplierItem.precioUnitario) === 0) {
            await prisma.supplierItem.update({
              where: { id: item.itemId },
              data: { precioUnitario: precioUnitario }
            });
          }
        }

        itemsCorregidos++;
        facturaModificada = true;
      }

      if (facturaModificada) {
        facturasAfectadas++;
      }
    }

    console.log(`   ✅ Items corregidos: ${itemsCorregidos}`);
    console.log(`   ⏭️  Items ya tenían historial: ${itemsYaTenianHistorial}`);
    console.log(`   ⚠️  Items sin SupplierItem/precio: ${itemsSinSupplierItem}`);
    console.log(`   📄 Facturas afectadas: ${facturasAfectadas}`);

    totalGlobalCorregidos += itemsCorregidos;
    totalGlobalFacturas += facturasAfectadas;
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN TOTAL');
  console.log('='.repeat(50));
  console.log(`   Total items corregidos: ${totalGlobalCorregidos}`);
  console.log(`   Total facturas afectadas: ${totalGlobalFacturas}`);

  if (dryRun) {
    console.log('\n⚠️  Esto fue una SIMULACIÓN. Para aplicar cambios ejecutar:');
    console.log('   npx tsx scripts/fix-price-history.ts --apply');
  } else {
    console.log('\n✅ Cambios aplicados exitosamente');
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('❌ Error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
