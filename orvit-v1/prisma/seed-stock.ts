/**
 * Seed de Stock/Inventario para pruebas
 *
 * Este script crea datos de prueba para el modulo de stock:
 * - Depositos (warehouses)
 * - Stock inicial (stock locations)
 * - Movimientos de stock
 * - Transferencias
 * - Ajustes de inventario
 *
 * Ejecutar: npx ts-node prisma/seed-stock.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedStock() {
  console.log('📦 Iniciando seed de Stock...\n');

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

    // 3. Crear depositos de prueba
    const depositos = await crearDepositos(company.id);
    console.log(`✅ Depósitos creados/verificados: ${depositos.length}\n`);

    // 4. Verificar/crear proveedores e items
    const proveedores = await getOrCreateProveedores(company.id);
    console.log(`✅ Proveedores disponibles: ${proveedores.length}\n`);

    // 5. Crear items de proveedor si no existen
    for (const proveedor of proveedores) {
      await getOrCreateSupplierItems(proveedor.id, company.id);
    }
    console.log('✅ Items de proveedores verificados/creados\n');

    // 6. Crear stock inicial
    await crearStockInicial(company.id, depositos);
    console.log('✅ Stock inicial creado\n');

    // 7. Crear movimientos de ejemplo (skip si hay problemas de schema)
    try {
      await crearMovimientosEjemplo(company.id, depositos, user.id);
      console.log('✅ Movimientos de ejemplo creados\n');
    } catch (e) {
      console.log('⚠️  Movimientos omitidos (requiere migración de BD)\n');
    }

    // 8. Crear transferencia de ejemplo
    try {
      await crearTransferenciaEjemplo(company.id, depositos, user.id);
      console.log('✅ Transferencia de ejemplo creada\n');
    } catch (e) {
      console.log('⚠️  Transferencias omitidas (requiere migración de BD)\n');
    }

    // 9. Crear ajuste de ejemplo
    try {
      await crearAjusteEjemplo(company.id, depositos, user.id);
      console.log('✅ Ajuste de ejemplo creado\n');
    } catch (e) {
      console.log('⚠️  Ajustes omitidos (requiere migración de BD)\n');
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 Seed de Stock completado!');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error durante el seed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function crearDepositos(companyId: number) {
  const depositosConfig = [
    { codigo: 'DEP-PRINCIPAL', nombre: 'Depósito Principal', direccion: 'Calle Principal 123', isDefault: true },
    { codigo: 'DEP-SECUNDARIO', nombre: 'Depósito Secundario', direccion: 'Av. Secundaria 456', isDefault: false },
    { codigo: 'DEP-PRODUCCION', nombre: 'Depósito Producción', direccion: 'Planta Industrial', isDefault: false },
  ];

  const depositos: { id: number; codigo: string; nombre: string }[] = [];

  for (const config of depositosConfig) {
    let deposito = await prisma.warehouse.findFirst({
      where: { codigo: config.codigo, companyId }
    });

    if (!deposito) {
      deposito = await prisma.warehouse.create({
        data: {
          codigo: config.codigo,
          nombre: config.nombre,
          direccion: config.direccion,
          isDefault: config.isDefault,
          isActive: true,
          companyId,
        }
      });
      console.log(`   + Depósito creado: ${config.nombre}`);
    } else {
      console.log(`   ✓ Depósito existe: ${config.nombre}`);
    }

    depositos.push({ id: deposito.id, codigo: deposito.codigo, nombre: deposito.nombre });
  }

  // Crear deposito virtual IN_TRANSIT si no existe
  let transitWarehouse = await prisma.warehouse.findFirst({
    where: { codigo: 'IN_TRANSIT', companyId }
  });

  if (!transitWarehouse) {
    transitWarehouse = await prisma.warehouse.create({
      data: {
        codigo: 'IN_TRANSIT',
        nombre: 'En Tránsito',
        isDefault: false,
        isActive: true,
        isTransit: true,
        companyId,
      }
    });
    console.log('   + Depósito IN_TRANSIT creado');
  }

  return depositos;
}

// Items de ejemplo para stock
const ITEMS_STOCK = [
  { nombre: 'Aceite lubricante 20W-50', unidad: 'LT', precio: 8500, stockMin: 10, stockMax: 100 },
  { nombre: 'Filtro de aire industrial', unidad: 'UN', precio: 15000, stockMin: 5, stockMax: 50 },
  { nombre: 'Rodamiento 6205-2RS', unidad: 'UN', precio: 4500, stockMin: 20, stockMax: 200 },
  { nombre: 'Correa dentada HTD 5M', unidad: 'MT', precio: 3200, stockMin: 15, stockMax: 150 },
  { nombre: 'Grasa multipropósito EP2', unidad: 'KG', precio: 6800, stockMin: 5, stockMax: 50 },
  { nombre: 'Tornillo M10x40 inox', unidad: 'UN', precio: 120, stockMin: 100, stockMax: 1000 },
  { nombre: 'Manguera hidráulica 3/4"', unidad: 'MT', precio: 12500, stockMin: 10, stockMax: 100 },
  { nombre: 'Sello mecánico 25mm', unidad: 'UN', precio: 28000, stockMin: 3, stockMax: 30 },
];

async function getOrCreateProveedores(companyId: number) {
  let proveedores = await prisma.suppliers.findMany({
    where: { company_id: companyId },
    take: 3,
    select: { id: true, name: true }
  });

  if (proveedores.length < 2) {
    const proveedoresPrueba = [
      { name: 'Ferretería Industrial SRL', cuit: '30-71234567-0', email: 'ventas@ferreteria.com' },
      { name: 'Suministros Técnicos SA', cuit: '30-71234568-1', email: 'contacto@suministros.com' },
    ];

    for (const prov of proveedoresPrueba) {
      const existe = await prisma.suppliers.findFirst({
        where: { cuit: prov.cuit, company_id: companyId }
      });

      if (!existe) {
        await prisma.suppliers.create({
          data: {
            name: prov.name,
            cuit: prov.cuit,
            email: prov.email,
            company_id: companyId,
          }
        });
        console.log(`   + Proveedor creado: ${prov.name}`);
      }
    }

    proveedores = await prisma.suppliers.findMany({
      where: { company_id: companyId },
      take: 3,
      select: { id: true, name: true }
    });
  }

  return proveedores;
}

async function getOrCreateSupplierItems(proveedorId: number, companyId: number) {
  const itemsExistentes = await prisma.supplierItem.count({
    where: { supplierId: proveedorId, companyId }
  });

  if (itemsExistentes >= 5) return;

  for (const item of ITEMS_STOCK) {
    // Verificar supply
    let supply = await prisma.supplies.findFirst({
      where: { name: item.nombre, company_id: companyId }
    });

    if (!supply) {
      supply = await prisma.supplies.create({
        data: {
          name: item.nombre,
          unit_measure: item.unidad,
          company_id: companyId,
          is_active: true,
        }
      });
    }

    // Verificar supplierItem
    const supplierItemExiste = await prisma.supplierItem.findFirst({
      where: { supplierId: proveedorId, supplyId: supply.id, companyId }
    });

    if (!supplierItemExiste) {
      await prisma.supplierItem.create({
        data: {
          supplierId: proveedorId,
          supplyId: supply.id,
          nombre: item.nombre,
          unidad: item.unidad,
          precioUnitario: item.precio,
          activo: true,
          companyId,
        }
      });
    }
  }
}

async function crearStockInicial(companyId: number, depositos: { id: number; codigo: string }[]) {
  // Obtener items de proveedor
  const supplierItems = await prisma.supplierItem.findMany({
    where: { companyId, activo: true },
    take: 8,
    distinct: ['nombre'],
  });

  if (supplierItems.length === 0) {
    console.log('   ⚠️ No hay items de proveedor para crear stock');
    return;
  }

  const depositoPrincipal = depositos.find(d => d.codigo === 'DEP-PRINCIPAL');
  const depositoSecundario = depositos.find(d => d.codigo === 'DEP-SECUNDARIO');

  if (!depositoPrincipal) return;

  for (let i = 0; i < supplierItems.length; i++) {
    const item = supplierItems[i];
    const itemConfig = ITEMS_STOCK[i % ITEMS_STOCK.length];

    // Stock en deposito principal
    const existePrincipal = await prisma.stockLocation.findUnique({
      where: {
        warehouseId_supplierItemId: {
          warehouseId: depositoPrincipal.id,
          supplierItemId: item.id,
        }
      }
    });

    if (!existePrincipal) {
      const cantidadInicial = Math.floor(Math.random() * 50) + 10;
      await prisma.stockLocation.create({
        data: {
          warehouseId: depositoPrincipal.id,
          supplierItemId: item.id,
          cantidad: cantidadInicial,
          cantidadReservada: 0,
          stockMinimo: itemConfig.stockMin,
          stockMaximo: itemConfig.stockMax,
          costoUnitario: Number(item.precioUnitario),
          companyId,
        }
      });
      console.log(`   + Stock creado: ${item.nombre} = ${cantidadInicial} en ${depositoPrincipal.codigo}`);
    }

    // Stock en deposito secundario (algunos items)
    if (depositoSecundario && i % 2 === 0) {
      const existeSecundario = await prisma.stockLocation.findUnique({
        where: {
          warehouseId_supplierItemId: {
            warehouseId: depositoSecundario.id,
            supplierItemId: item.id,
          }
        }
      });

      if (!existeSecundario) {
        const cantidadSecundaria = Math.floor(Math.random() * 20) + 5;
        await prisma.stockLocation.create({
          data: {
            warehouseId: depositoSecundario.id,
            supplierItemId: item.id,
            cantidad: cantidadSecundaria,
            cantidadReservada: 0,
            stockMinimo: Math.floor(itemConfig.stockMin / 2),
            companyId,
          }
        });
        console.log(`   + Stock creado: ${item.nombre} = ${cantidadSecundaria} en ${depositoSecundario.codigo}`);
      }
    }
  }
}

async function crearMovimientosEjemplo(companyId: number, depositos: { id: number; codigo: string }[], userId: number) {
  const depositoPrincipal = depositos.find(d => d.codigo === 'DEP-PRINCIPAL');
  if (!depositoPrincipal) return;

  // Verificar si ya hay movimientos
  const movExistentes = await prisma.stockMovement.count({
    where: { companyId }
  });

  if (movExistentes > 0) {
    console.log(`   ℹ️ Ya existen ${movExistentes} movimientos. Omitiendo.`);
    return;
  }

  // Obtener algunos stock locations
  const stocks = await prisma.stockLocation.findMany({
    where: { companyId, warehouseId: depositoPrincipal.id },
    take: 3,
  });

  for (const stock of stocks) {
    // Crear movimiento de entrada (simulando recepcion)
    await prisma.stockMovement.create({
      data: {
        tipo: 'ENTRADA_RECEPCION',
        cantidad: 25,
        cantidadAnterior: Number(stock.cantidad) - 25,
        cantidadPosterior: Number(stock.cantidad),
        supplierItemId: stock.supplierItemId,
        warehouseId: stock.warehouseId,
        motivo: 'Recepción inicial de mercadería - SEED',
        companyId,
        createdBy: userId,
      }
    });
  }

  console.log(`   + ${stocks.length} movimientos de entrada creados`);
}

async function crearTransferenciaEjemplo(companyId: number, depositos: { id: number; codigo: string }[], userId: number) {
  const depositoPrincipal = depositos.find(d => d.codigo === 'DEP-PRINCIPAL');
  const depositoSecundario = depositos.find(d => d.codigo === 'DEP-SECUNDARIO');

  if (!depositoPrincipal || !depositoSecundario) return;

  // Verificar si ya hay transferencias
  const transExistentes = await prisma.stockTransfer.count({
    where: { companyId }
  });

  if (transExistentes > 0) {
    console.log(`   ℹ️ Ya existen ${transExistentes} transferencias. Omitiendo.`);
    return;
  }

  // Obtener un item con stock
  const stockItem = await prisma.stockLocation.findFirst({
    where: { companyId, warehouseId: depositoPrincipal.id, cantidad: { gt: 10 } },
    include: { supplierItem: true }
  });

  if (!stockItem) {
    console.log('   ⚠️ No hay items con stock suficiente para transferencia');
    return;
  }

  // Generar numero
  const year = new Date().getFullYear();
  const numero = `TRF-${year}-00001`;

  // Crear transferencia en borrador
  const transfer = await prisma.stockTransfer.create({
    data: {
      numero,
      warehouseOrigenId: depositoPrincipal.id,
      warehouseDestinoId: depositoSecundario.id,
      estado: 'BORRADOR',
      motivo: 'Transferencia de prueba - Reabastecimiento',
      companyId,
      createdBy: userId,
    }
  });

  // Crear item de transferencia
  await prisma.stockTransferItem.create({
    data: {
      transferId: transfer.id,
      supplierItemId: stockItem.supplierItemId,
      cantidadSolicitada: 5,
      cantidadEnviada: 0,
      cantidadRecibida: 0,
    }
  });

  console.log(`   + Transferencia ${numero} creada (BORRADOR)`);
}

async function crearAjusteEjemplo(companyId: number, depositos: { id: number; codigo: string }[], userId: number) {
  const depositoPrincipal = depositos.find(d => d.codigo === 'DEP-PRINCIPAL');
  if (!depositoPrincipal) return;

  // Verificar si ya hay ajustes
  const ajustesExistentes = await prisma.stockAdjustment.count({
    where: { companyId }
  });

  if (ajustesExistentes > 0) {
    console.log(`   ℹ️ Ya existen ${ajustesExistentes} ajustes. Omitiendo.`);
    return;
  }

  // Obtener un item con stock
  const stockItem = await prisma.stockLocation.findFirst({
    where: { companyId, warehouseId: depositoPrincipal.id },
    include: { supplierItem: true }
  });

  if (!stockItem) {
    console.log('   ⚠️ No hay items con stock para ajuste');
    return;
  }

  // Generar numero
  const year = new Date().getFullYear();
  const numero = `AJU-${year}-00001`;

  // Crear ajuste en borrador
  const ajuste = await prisma.stockAdjustment.create({
    data: {
      numero,
      tipo: 'INVENTARIO_FISICO',
      estado: 'BORRADOR',
      warehouseId: depositoPrincipal.id,
      motivo: 'Conteo físico de prueba - Auditoría mensual',
      companyId,
      createdBy: userId,
    }
  });

  // Crear item de ajuste (diferencia de +3)
  await prisma.stockAdjustmentItem.create({
    data: {
      adjustmentId: ajuste.id,
      supplierItemId: stockItem.supplierItemId,
      cantidadAnterior: Number(stockItem.cantidad),
      cantidadNueva: Number(stockItem.cantidad) + 3,
      diferencia: 3,
    }
  });

  console.log(`   + Ajuste ${numero} creado (BORRADOR)`);
}

// Ejecutar seed
seedStock()
  .then(() => {
    console.log('✨ Proceso finalizado con éxito');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Proceso finalizado con errores:', error);
    process.exit(1);
  });
