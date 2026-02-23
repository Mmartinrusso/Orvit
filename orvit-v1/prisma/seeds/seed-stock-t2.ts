/**
 * Seed: Stock T2 - Datos de prueba completos para ViewMode en Stock
 *
 * Este seed crea:
 * - Items T2 con múltiples movimientos para Kardex
 * - Items T1 para comparación
 * - Items legacy (sin docType / null) para probar compatibilidad
 * - Transferencias T1 y T2
 * - Items T2 con stock bajo para pruebas de reposición
 *
 * Para verificar:
 * - En Standard mode: items T2 ocultos en Stock, KPIs, Kardex, Transferencias
 * - En Extended mode: todos los items visibles
 *
 * Ejecutar: npm run seed:stock-t2
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Seed Stock T2 - Iniciando...\n');

  // Obtener company de prueba
  const company = await prisma.company.findFirst({
    where: { isActive: true }
  });

  if (!company) {
    console.error('❌ No se encontró una empresa activa');
    return;
  }

  console.log(`📦 Empresa: ${company.name} (ID: ${company.id})\n`);

  // Obtener o crear proveedor de prueba
  let supplier = await prisma.suppliers.findFirst({
    where: { company_id: company.id }
  });

  if (!supplier) {
    supplier = await prisma.suppliers.create({
      data: {
        name: 'Proveedor Test T2',
        razon_social: 'Proveedor Test T2 SRL',
        cuit: '30-99999999-9',
        company_id: company.id,
      }
    });
    console.log(`✅ Proveedor creado: ${supplier.name}`);
  } else {
    console.log(`✅ Proveedor existente: ${supplier.name}`);
  }

  // Obtener warehouses (necesitamos 2 para transferencias)
  let warehouse1 = await prisma.warehouse.findFirst({
    where: {
      companyId: company.id,
      isActive: true,
      isTransit: false
    }
  });

  if (!warehouse1) {
    warehouse1 = await prisma.warehouse.create({
      data: {
        codigo: 'DEP-MAIN',
        nombre: 'Depósito Principal',
        companyId: company.id,
        isActive: true,
        isTransit: false
      }
    });
    console.log(`✅ Warehouse 1 creado: ${warehouse1.nombre}`);
  } else {
    console.log(`✅ Warehouse 1 existente: ${warehouse1.nombre}`);
  }

  // Segundo warehouse para transferencias
  let warehouse2 = await prisma.warehouse.findFirst({
    where: {
      companyId: company.id,
      isActive: true,
      isTransit: false,
      id: { not: warehouse1.id }
    }
  });

  if (!warehouse2) {
    warehouse2 = await prisma.warehouse.create({
      data: {
        codigo: 'DEP-SEC',
        nombre: 'Depósito Secundario',
        companyId: company.id,
        isActive: true,
        isTransit: false
      }
    });
    console.log(`✅ Warehouse 2 creado: ${warehouse2.nombre}`);
  } else {
    console.log(`✅ Warehouse 2 existente: ${warehouse2.nombre}`);
  }

  // Obtener usuario para auditoría
  const user = await prisma.user.findFirst({
    where: {
      companies: { some: { companyId: company.id } }
    }
  });

  if (!user) {
    console.error('❌ No se encontró un usuario para la empresa');
    return;
  }

  console.log(`✅ Usuario: ${user.name}\n`);

  // =============================================
  // LIMPIAR DATOS ANTERIORES DEL SEED
  // =============================================
  console.log('🧹 Limpiando datos de seed anterior...\n');

  // Limpiar transferencias de seed
  await prisma.stockTransferItem.deleteMany({
    where: {
      transfer: {
        numero: { startsWith: 'TRF-SEED-' }
      }
    }
  });
  await prisma.stockTransfer.deleteMany({
    where: { numero: { startsWith: 'TRF-SEED-' } }
  });

  // Limpiar ajustes de seed
  await prisma.stockAdjustmentItem.deleteMany({
    where: {
      adjustment: {
        numero: { startsWith: 'AJU-SEED-' }
      }
    }
  });
  await prisma.stockAdjustment.deleteMany({
    where: { numero: { startsWith: 'AJU-SEED-' } }
  });

  // Limpiar supplies/items de seed
  const existingSupplies = await prisma.supplies.findMany({
    where: {
      name: { startsWith: '[SEED-T2]' },
      company_id: company.id
    }
  });

  for (const supply of existingSupplies) {
    const supplierItems = await prisma.supplierItem.findMany({
      where: { supplyId: supply.id }
    });

    for (const item of supplierItems) {
      await prisma.stockMovement.deleteMany({ where: { supplierItemId: item.id } });
      await prisma.stockLocation.deleteMany({ where: { supplierItemId: item.id } });
      await prisma.supplierItem.delete({ where: { id: item.id } });
    }

    await prisma.supplies.delete({ where: { id: supply.id } });
  }

  console.log('✅ Datos anteriores limpiados\n');

  // =============================================
  // CREAR ITEMS T2 CON MÚLTIPLES MOVIMIENTOS
  // =============================================
  console.log('📦 Creando items T2 con movimientos para Kardex...\n');

  const itemsT2Data = [
    { nombre: '[SEED-T2] Material Construcción A', unidad: 'UN', costo: 150.00, cantidadInicial: 200, stockMinimo: 50 },
    { nombre: '[SEED-T2] Insumo Industrial B', unidad: 'KG', costo: 45.50, cantidadInicial: 500, stockMinimo: 100 },
    { nombre: '[SEED-T2] Componente Electrónico C', unidad: 'UN', costo: 89.99, cantidadInicial: 250, stockMinimo: 30 },
  ];

  const createdT2Items: number[] = [];

  for (const itemData of itemsT2Data) {
    // Crear Supply
    const supply = await prisma.supplies.create({
      data: {
        name: itemData.nombre,
        unit_measure: itemData.unidad,
        company_id: company.id,
        is_active: true,
      }
    });

    // Crear SupplierItem
    const supplierItem = await prisma.supplierItem.create({
      data: {
        nombre: itemData.nombre,
        unidad: itemData.unidad,
        supplierId: supplier.id,
        supplyId: supply.id,
        precioUnitario: itemData.costo,
        activo: true,
        companyId: company.id
      }
    });

    createdT2Items.push(supplierItem.id);

    // Stock actual después de movimientos
    let stockActual = 0;

    // Movimiento 1: Entrada por recepción (T2)
    const cantidadEntrada = itemData.cantidadInicial;
    await prisma.stockMovement.create({
      data: {
        tipo: 'ENTRADA_RECEPCION',
        cantidad: cantidadEntrada,
        cantidadAnterior: stockActual,
        cantidadPosterior: stockActual + cantidadEntrada,
        costoUnitario: itemData.costo,
        supplierItemId: supplierItem.id,
        warehouseId: warehouse1.id,
        docType: 'T2',
        sourceNumber: `REC-T2-SEED-${supplierItem.id}`,
        motivo: 'Recepción inicial (seed T2)',
        companyId: company.id,
        createdBy: user.id,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Hace 7 días
      }
    });
    stockActual += cantidadEntrada;

    // Movimiento 2: Ajuste negativo (T2)
    const cantidadAjuste = Math.floor(cantidadEntrada * 0.1); // 10% de pérdida
    await prisma.stockMovement.create({
      data: {
        tipo: 'AJUSTE_NEGATIVO',
        cantidad: cantidadAjuste,
        cantidadAnterior: stockActual,
        cantidadPosterior: stockActual - cantidadAjuste,
        costoUnitario: itemData.costo,
        supplierItemId: supplierItem.id,
        warehouseId: warehouse1.id,
        docType: 'T2',
        sourceNumber: `AJU-T2-SEED-${supplierItem.id}`,
        motivo: 'Ajuste por merma (seed T2)',
        companyId: company.id,
        createdBy: user.id,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // Hace 5 días
      }
    });
    stockActual -= cantidadAjuste;

    // Movimiento 3: Salida por transferencia (T2)
    const cantidadTransferencia = Math.floor(cantidadEntrada * 0.15); // 15% transferido
    await prisma.stockMovement.create({
      data: {
        tipo: 'TRANSFERENCIA_SALIDA',
        cantidad: cantidadTransferencia,
        cantidadAnterior: stockActual,
        cantidadPosterior: stockActual - cantidadTransferencia,
        costoUnitario: itemData.costo,
        supplierItemId: supplierItem.id,
        warehouseId: warehouse1.id,
        docType: 'T2',
        sourceNumber: `TRF-T2-SEED-${supplierItem.id}`,
        motivo: 'Transferencia a depósito secundario (seed T2)',
        companyId: company.id,
        createdBy: user.id,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // Hace 3 días
      }
    });
    stockActual -= cantidadTransferencia;

    // Crear StockLocation con el stock final
    await prisma.stockLocation.create({
      data: {
        supplierItemId: supplierItem.id,
        warehouseId: warehouse1.id,
        cantidad: stockActual,
        cantidadReservada: 0,
        costoUnitario: itemData.costo,
        stockMinimo: itemData.stockMinimo,
        stockMaximo: 1000,
        companyId: company.id
      }
    });

    // Crear StockLocation en warehouse2 con la cantidad transferida
    await prisma.stockLocation.create({
      data: {
        supplierItemId: supplierItem.id,
        warehouseId: warehouse2.id,
        cantidad: cantidadTransferencia,
        cantidadReservada: 0,
        costoUnitario: itemData.costo,
        companyId: company.id
      }
    });

    // Movimiento de entrada en warehouse2
    await prisma.stockMovement.create({
      data: {
        tipo: 'TRANSFERENCIA_ENTRADA',
        cantidad: cantidadTransferencia,
        cantidadAnterior: 0,
        cantidadPosterior: cantidadTransferencia,
        costoUnitario: itemData.costo,
        supplierItemId: supplierItem.id,
        warehouseId: warehouse2.id,
        docType: 'T2',
        sourceNumber: `TRF-T2-SEED-${supplierItem.id}`,
        motivo: 'Entrada por transferencia (seed T2)',
        companyId: company.id,
        createdBy: user.id,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      }
    });

    console.log(`  ✅ T2: ${itemData.nombre}`);
    console.log(`     Stock W1: ${stockActual} | Stock W2: ${cantidadTransferencia}`);
    console.log(`     Movimientos: 4 (entrada, ajuste, transferencia salida/entrada)`);
  }

  // =============================================
  // CREAR ITEMS T1 CON MÚLTIPLES MOVIMIENTOS
  // =============================================
  console.log('\n📦 Creando items T1 con movimientos para Kardex...\n');

  const itemsT1Data = [
    { nombre: '[SEED-T2] Producto Normal X', unidad: 'UN', costo: 200.00, cantidadInicial: 150, stockMinimo: 30 },
    { nombre: '[SEED-T2] Suministro Oficina Y', unidad: 'UN', costo: 35.00, cantidadInicial: 300, stockMinimo: 50 },
  ];

  const createdT1Items: number[] = [];

  for (const itemData of itemsT1Data) {
    const supply = await prisma.supplies.create({
      data: {
        name: itemData.nombre,
        unit_measure: itemData.unidad,
        company_id: company.id,
        is_active: true,
      }
    });

    const supplierItem = await prisma.supplierItem.create({
      data: {
        nombre: itemData.nombre,
        unidad: itemData.unidad,
        supplierId: supplier.id,
        supplyId: supply.id,
        precioUnitario: itemData.costo,
        activo: true,
        companyId: company.id
      }
    });

    createdT1Items.push(supplierItem.id);

    let stockActual = 0;

    // Movimiento 1: Entrada (T1)
    const cantidadEntrada = itemData.cantidadInicial;
    await prisma.stockMovement.create({
      data: {
        tipo: 'ENTRADA_RECEPCION',
        cantidad: cantidadEntrada,
        cantidadAnterior: stockActual,
        cantidadPosterior: stockActual + cantidadEntrada,
        costoUnitario: itemData.costo,
        supplierItemId: supplierItem.id,
        warehouseId: warehouse1.id,
        docType: 'T1',
        sourceNumber: `REC-T1-SEED-${supplierItem.id}`,
        motivo: 'Recepción inicial (seed T1)',
        companyId: company.id,
        createdBy: user.id,
        createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
      }
    });
    stockActual += cantidadEntrada;

    // Movimiento 2: Ajuste positivo (T1)
    const cantidadAjustePositivo = 20;
    await prisma.stockMovement.create({
      data: {
        tipo: 'AJUSTE_POSITIVO',
        cantidad: cantidadAjustePositivo,
        cantidadAnterior: stockActual,
        cantidadPosterior: stockActual + cantidadAjustePositivo,
        costoUnitario: itemData.costo,
        supplierItemId: supplierItem.id,
        warehouseId: warehouse1.id,
        docType: 'T1',
        sourceNumber: `AJU-T1-SEED-${supplierItem.id}`,
        motivo: 'Ajuste por inventario físico (seed T1)',
        companyId: company.id,
        createdBy: user.id,
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
      }
    });
    stockActual += cantidadAjustePositivo;

    await prisma.stockLocation.create({
      data: {
        supplierItemId: supplierItem.id,
        warehouseId: warehouse1.id,
        cantidad: stockActual,
        cantidadReservada: 0,
        costoUnitario: itemData.costo,
        stockMinimo: itemData.stockMinimo,
        stockMaximo: 500,
        companyId: company.id
      }
    });

    console.log(`  ✅ T1: ${itemData.nombre}`);
    console.log(`     Stock: ${stockActual} | Movimientos: 2 (entrada, ajuste)`);
  }

  // =============================================
  // CREAR ITEM LEGACY (sin docType / null)
  // =============================================
  console.log('\n📦 Creando item legacy (null docType)...\n');

  const legacySupply = await prisma.supplies.create({
    data: {
      name: '[SEED-T2] Item Legacy Sin DocType',
      unit_measure: 'UN',
      company_id: company.id,
      is_active: true,
    }
  });

  const legacyItem = await prisma.supplierItem.create({
    data: {
      nombre: '[SEED-T2] Item Legacy Sin DocType',
      unidad: 'UN',
      supplierId: supplier.id,
      supplyId: legacySupply.id,
      precioUnitario: 120.00,
      activo: true,
      companyId: company.id
    }
  });

  await prisma.stockLocation.create({
    data: {
      supplierItemId: legacyItem.id,
      warehouseId: warehouse1.id,
      cantidad: 75,
      cantidadReservada: 0,
      costoUnitario: 120.00,
      stockMinimo: 20,
      companyId: company.id
    }
  });

  // StockMovement para legacy - usa T1 por defecto (Prisma no soporta NULL en enum)
  // El item se considera "legacy" porque no tiene docType explícito en su creación original
  await prisma.stockMovement.create({
    data: {
      tipo: 'ENTRADA_RECEPCION',
      cantidad: 75,
      cantidadAnterior: 0,
      cantidadPosterior: 75,
      costoUnitario: 120.00,
      supplierItemId: legacyItem.id,
      warehouseId: warehouse1.id,
      sourceNumber: 'REC-LEGACY-001',
      motivo: 'Recepción legacy (simula dato antiguo)',
      companyId: company.id,
      createdBy: user.id,
      // docType usa default T1 - Prisma no soporta NULL en enum
    }
  });

  console.log(`  ✅ Legacy: [SEED-T2] Item Legacy Sin DocType - 75 UN @ $120.00`);

  // =============================================
  // CREAR ITEMS T2 CON STOCK BAJO (REPOSICIÓN)
  // =============================================
  console.log('\n📦 Creando items T2 con stock bajo para reposición...\n');

  const itemsReposicionT2 = [
    { nombre: '[SEED-T2] REPO Item Crítico T2', unidad: 'UN', costo: 500.00, cantidad: 5, stockMinimo: 50 },
    { nombre: '[SEED-T2] REPO Item Bajo T2', unidad: 'KG', costo: 80.00, cantidad: 15, stockMinimo: 100 },
  ];

  for (const itemData of itemsReposicionT2) {
    const supply = await prisma.supplies.create({
      data: {
        name: itemData.nombre,
        unit_measure: itemData.unidad,
        company_id: company.id,
        is_active: true,
      }
    });

    const supplierItem = await prisma.supplierItem.create({
      data: {
        nombre: itemData.nombre,
        unidad: itemData.unidad,
        supplierId: supplier.id,
        supplyId: supply.id,
        precioUnitario: itemData.costo,
        activo: true,
        companyId: company.id
      }
    });

    await prisma.stockLocation.create({
      data: {
        supplierItemId: supplierItem.id,
        warehouseId: warehouse1.id,
        cantidad: itemData.cantidad,
        cantidadReservada: 0,
        costoUnitario: itemData.costo,
        stockMinimo: itemData.stockMinimo,
        stockMaximo: 500,
        companyId: company.id
      }
    });

    await prisma.stockMovement.create({
      data: {
        tipo: 'ENTRADA_RECEPCION',
        cantidad: itemData.cantidad,
        cantidadAnterior: 0,
        cantidadPosterior: itemData.cantidad,
        costoUnitario: itemData.costo,
        supplierItemId: supplierItem.id,
        warehouseId: warehouse1.id,
        docType: 'T2',
        sourceNumber: `REC-T2-REPO-${supplierItem.id}`,
        motivo: 'Recepción para test reposición (seed T2)',
        companyId: company.id,
        createdBy: user.id
      }
    });

    console.log(`  ⚠️ T2 BAJO: ${itemData.nombre}`);
    console.log(`     Stock: ${itemData.cantidad} | Mínimo: ${itemData.stockMinimo} (BAJO STOCK)`);
  }

  // Items T1 con stock bajo para comparar
  console.log('\n📦 Creando items T1 con stock bajo para reposición...\n');

  const itemsReposicionT1 = [
    { nombre: '[SEED-T2] REPO Item Crítico T1', unidad: 'UN', costo: 300.00, cantidad: 10, stockMinimo: 40 },
  ];

  for (const itemData of itemsReposicionT1) {
    const supply = await prisma.supplies.create({
      data: {
        name: itemData.nombre,
        unit_measure: itemData.unidad,
        company_id: company.id,
        is_active: true,
      }
    });

    const supplierItem = await prisma.supplierItem.create({
      data: {
        nombre: itemData.nombre,
        unidad: itemData.unidad,
        supplierId: supplier.id,
        supplyId: supply.id,
        precioUnitario: itemData.costo,
        activo: true,
        companyId: company.id
      }
    });

    await prisma.stockLocation.create({
      data: {
        supplierItemId: supplierItem.id,
        warehouseId: warehouse1.id,
        cantidad: itemData.cantidad,
        cantidadReservada: 0,
        costoUnitario: itemData.costo,
        stockMinimo: itemData.stockMinimo,
        stockMaximo: 500,
        companyId: company.id
      }
    });

    await prisma.stockMovement.create({
      data: {
        tipo: 'ENTRADA_RECEPCION',
        cantidad: itemData.cantidad,
        cantidadAnterior: 0,
        cantidadPosterior: itemData.cantidad,
        costoUnitario: itemData.costo,
        supplierItemId: supplierItem.id,
        warehouseId: warehouse1.id,
        docType: 'T1',
        sourceNumber: `REC-T1-REPO-${supplierItem.id}`,
        motivo: 'Recepción para test reposición (seed T1)',
        companyId: company.id,
        createdBy: user.id
      }
    });

    console.log(`  ⚠️ T1 BAJO: ${itemData.nombre}`);
    console.log(`     Stock: ${itemData.cantidad} | Mínimo: ${itemData.stockMinimo} (BAJO STOCK)`);
  }

  // =============================================
  // CREAR TRANSFERENCIAS T1 Y T2
  // =============================================
  console.log('\n📦 Creando transferencias T1 y T2...\n');

  // Transferencia T2 (usa items T2)
  if (createdT2Items.length > 0) {
    const transferT2 = await prisma.stockTransfer.create({
      data: {
        numero: 'TRF-SEED-T2-001',
        warehouseOrigenId: warehouse1.id,
        warehouseDestinoId: warehouse2.id,
        estado: 'COMPLETADO',
        fechaSolicitud: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        fechaEnvio: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        fechaRecepcion: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        notas: 'Transferencia de prueba con items T2',
        companyId: company.id,
        createdBy: user.id
      }
    });

    await prisma.stockTransferItem.create({
      data: {
        transferId: transferT2.id,
        supplierItemId: createdT2Items[0],
        cantidadSolicitada: 25,
        cantidadEnviada: 25,
        cantidadRecibida: 25,
        notas: 'Item T2 transferido'
      }
    });

    console.log(`  ✅ T2: Transferencia TRF-SEED-T2-001 (COMPLETADO)`);
    console.log(`     ${warehouse1.nombre} → ${warehouse2.nombre}`);
  }

  // Transferencia T1 (usa items T1)
  if (createdT1Items.length > 0) {
    const transferT1 = await prisma.stockTransfer.create({
      data: {
        numero: 'TRF-SEED-T1-001',
        warehouseOrigenId: warehouse1.id,
        warehouseDestinoId: warehouse2.id,
        estado: 'SOLICITADO',
        fechaSolicitud: new Date(),
        notas: 'Transferencia de prueba con items T1',
        companyId: company.id,
        createdBy: user.id
      }
    });

    await prisma.stockTransferItem.create({
      data: {
        transferId: transferT1.id,
        supplierItemId: createdT1Items[0],
        cantidadSolicitada: 30,
        cantidadEnviada: 0,
        cantidadRecibida: 0,
        notas: 'Item T1 - pendiente envío'
      }
    });

    console.log(`  ✅ T1: Transferencia TRF-SEED-T1-001 (SOLICITADO)`);
    console.log(`     ${warehouse1.nombre} → ${warehouse2.nombre}`);
  }

  // =============================================
  // CREAR AJUSTES T1 Y T2
  // =============================================
  console.log('\n📦 Creando ajustes de stock T1 y T2...\n');

  // Ajuste T2 - CONFIRMADO (usa items T2)
  if (createdT2Items.length >= 2) {
    const ajusteT2_1 = await prisma.stockAdjustment.create({
      data: {
        numero: 'AJU-SEED-T2-001',
        tipo: 'INVENTARIO_FISICO',
        estado: 'CONFIRMADO',
        motivo: 'Inventario físico mensual',
        motivoDetalle: 'Ajuste por diferencia encontrada en conteo físico de items T2',
        warehouseId: warehouse1.id,
        companyId: company.id,
        createdBy: user.id,
        aprobadoPor: user.id,
        aprobadoAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        adjuntos: [],
        notas: 'Ajuste de prueba T2 - Confirmado',
      }
    });

    // Item 1: Ajuste negativo (merma)
    await prisma.stockAdjustmentItem.create({
      data: {
        adjustmentId: ajusteT2_1.id,
        supplierItemId: createdT2Items[0],
        cantidadAnterior: 180,
        cantidadNueva: 165,
        diferencia: -15,
        motivo: 'Diferencia por rotura durante manipulación'
      }
    });

    // Item 2: Ajuste positivo (encontrado extra)
    await prisma.stockAdjustmentItem.create({
      data: {
        adjustmentId: ajusteT2_1.id,
        supplierItemId: createdT2Items[1],
        cantidadAnterior: 450,
        cantidadNueva: 458,
        diferencia: 8,
        motivo: 'Unidades adicionales encontradas en revisión'
      }
    });

    console.log(`  ✅ T2: Ajuste AJU-SEED-T2-001 (CONFIRMADO) - Inventario Físico`);
    console.log(`     2 items ajustados: -15 y +8`);

    // Ajuste T2 - PENDIENTE APROBACIÓN
    const ajusteT2_2 = await prisma.stockAdjustment.create({
      data: {
        numero: 'AJU-SEED-T2-002',
        tipo: 'MERMA',
        estado: 'PENDIENTE_APROBACION',
        motivo: 'Merma por deterioro',
        motivoDetalle: 'Material deteriorado por condiciones de almacenamiento',
        warehouseId: warehouse1.id,
        companyId: company.id,
        createdBy: user.id,
        adjuntos: [],
        notas: 'Ajuste de prueba T2 - Pendiente aprobación',
      }
    });

    await prisma.stockAdjustmentItem.create({
      data: {
        adjustmentId: ajusteT2_2.id,
        supplierItemId: createdT2Items[2],
        cantidadAnterior: 250,
        cantidadNueva: 235,
        diferencia: -15,
        motivo: 'Deterioro por humedad'
      }
    });

    console.log(`  ✅ T2: Ajuste AJU-SEED-T2-002 (PENDIENTE) - Merma`);
    console.log(`     1 item ajustado: -15`);
  }

  // Ajuste T1 - CONFIRMADO (usa items T1)
  if (createdT1Items.length >= 1) {
    const ajusteT1_1 = await prisma.stockAdjustment.create({
      data: {
        numero: 'AJU-SEED-T1-001',
        tipo: 'CORRECCION',
        estado: 'CONFIRMADO',
        motivo: 'Corrección por error de carga',
        motivoDetalle: 'Se detectó error en carga inicial del sistema',
        warehouseId: warehouse1.id,
        companyId: company.id,
        createdBy: user.id,
        aprobadoPor: user.id,
        aprobadoAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        adjuntos: [],
        notas: 'Ajuste de prueba T1 - Confirmado',
      }
    });

    await prisma.stockAdjustmentItem.create({
      data: {
        adjustmentId: ajusteT1_1.id,
        supplierItemId: createdT1Items[0],
        cantidadAnterior: 170,
        cantidadNueva: 175,
        diferencia: 5,
        motivo: 'Corrección cantidad inicial'
      }
    });

    console.log(`  ✅ T1: Ajuste AJU-SEED-T1-001 (CONFIRMADO) - Corrección`);
    console.log(`     1 item ajustado: +5`);

    // Ajuste T1 - BORRADOR
    if (createdT1Items.length >= 2) {
      const ajusteT1_2 = await prisma.stockAdjustment.create({
        data: {
          numero: 'AJU-SEED-T1-002',
          tipo: 'ROTURA',
          estado: 'BORRADOR',
          motivo: 'Rotura en depósito',
          motivoDetalle: 'Productos dañados durante reorganización',
          warehouseId: warehouse1.id,
          companyId: company.id,
          createdBy: user.id,
          adjuntos: [],
          notas: 'Ajuste de prueba T1 - Borrador',
        }
      });

      await prisma.stockAdjustmentItem.create({
        data: {
          adjustmentId: ajusteT1_2.id,
          supplierItemId: createdT1Items[1],
          cantidadAnterior: 320,
          cantidadNueva: 310,
          diferencia: -10,
          motivo: 'Rotura por caída de estantería'
        }
      });

      console.log(`  ✅ T1: Ajuste AJU-SEED-T1-002 (BORRADOR) - Rotura`);
      console.log(`     1 item ajustado: -10`);
    }
  }

  // =============================================
  // RESUMEN
  // =============================================
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DE DATOS CREADOS');
  console.log('='.repeat(60));

  // Conteo de movimientos
  const countT2 = await prisma.stockMovement.count({
    where: { companyId: company.id, docType: 'T2' }
  });
  const countT1 = await prisma.stockMovement.count({
    where: { companyId: company.id, docType: 'T1' }
  });
  const countAll = await prisma.stockMovement.count({
    where: { companyId: company.id }
  });
  const countNull = countAll - countT1 - countT2;

  console.log(`\n📦 StockMovements (todos los tipos):`);
  console.log(`   - T1: ${countT1}`);
  console.log(`   - T2: ${countT2}`);
  console.log(`   - null (legacy): ${countNull}`);

  // Conteo por tipo de movimiento (solo T1 y T2, null se maneja separado)
  const movementsByTypeT1 = await prisma.stockMovement.groupBy({
    by: ['tipo'],
    where: { companyId: company.id, docType: 'T1' },
    _count: true
  });
  const movementsByTypeT2 = await prisma.stockMovement.groupBy({
    by: ['tipo'],
    where: { companyId: company.id, docType: 'T2' },
    _count: true
  });

  console.log(`\n📊 Movimientos por tipo:`);
  console.log(`   T1:`);
  for (const m of movementsByTypeT1) {
    console.log(`     ${m.tipo}: ${m._count}`);
  }
  console.log(`   T2:`);
  for (const m of movementsByTypeT2) {
    console.log(`     ${m.tipo}: ${m._count}`);
  }

  // Conteo de transferencias
  const transferencias = await prisma.stockTransfer.findMany({
    where: { numero: { startsWith: 'TRF-SEED-' } },
    include: { items: true }
  });

  console.log(`\n🔄 Transferencias creadas: ${transferencias.length}`);
  for (const t of transferencias) {
    const hasT2Item = t.items.some(i => createdT2Items.includes(i.supplierItemId));
    console.log(`   ${t.numero} - ${hasT2Item ? 'T2' : 'T1'} - ${t.estado}`);
  }

  // Conteo de ajustes
  const ajustes = await prisma.stockAdjustment.findMany({
    where: { numero: { startsWith: 'AJU-SEED-' } },
    include: { items: { include: { supplierItem: { select: { id: true, nombre: true } } } } }
  });

  console.log(`\n🔧 Ajustes creados: ${ajustes.length}`);
  for (const a of ajustes) {
    const hasT2Item = a.items.some(i => createdT2Items.includes(i.supplierItemId));
    console.log(`   ${a.numero} - ${hasT2Item ? 'T2' : 'T1'} - ${a.estado} (${a.tipo})`);
  }

  // Conteo de items de reposición creados
  const repoItems = await prisma.stockLocation.findMany({
    where: {
      companyId: company.id,
      supplierItem: { nombre: { contains: 'REPO' } }
    },
    include: { supplierItem: { select: { nombre: true } } }
  });

  console.log(`\n⚠️ Items de reposición creados: ${repoItems.length}`);
  for (const item of repoItems) {
    const cantidad = Number(item.cantidad);
    const minimo = Number(item.stockMinimo || 0);
    const estado = cantidad < minimo ? '🔴 BAJO' : '🟢 OK';
    console.log(`   ${item.supplierItem.nombre}: ${cantidad}/${minimo} ${estado}`);
  }

  const totalStock = await prisma.stockLocation.count({
    where: { companyId: company.id }
  });

  console.log(`\n📍 Total StockLocations: ${totalStock}`);

  console.log('\n' + '='.repeat(60));
  console.log('🧪 INSTRUCCIONES DE PRUEBA');
  console.log('='.repeat(60));
  console.log(`
1. INVENTARIO (/administracion/compras/stock)
   Standard mode:
   → Ver solo items T1 y legacy
   → NO ver items con nombre "Material Construcción A" (T2)

   Extended mode:
   → Ver TODOS los items (T1 + T2 + legacy)

2. KARDEX (movimientos)
   Standard mode:
   → Solo movimientos T1
   → Tipos: ENTRADA_RECEPCION, AJUSTE_POSITIVO

   Extended mode:
   → TODOS los movimientos (T1 + T2)
   → Incluye: AJUSTE_NEGATIVO, TRANSFERENCIA_SALIDA/ENTRADA de T2

3. TRANSFERENCIAS
   Standard mode:
   → Solo TRF-SEED-T1-001 visible

   Extended mode:
   → Ambas transferencias visibles (T1 y T2)

4. REPOSICIÓN
   Standard mode:
   → Solo items T1 con stock bajo
   → Ver: "[SEED-T2] REPO Item Crítico T1"

   Extended mode:
   → Todos los items con stock bajo (T1 + T2)
   → Ver también: "[SEED-T2] REPO Item Crítico T2", "REPO Item Bajo T2"

5. AJUSTES (/administracion/compras/stock/ajustes)
   Standard mode:
   → Solo ajustes T1 visibles
   → Ver: AJU-SEED-T1-001 (CONFIRMADO), AJU-SEED-T1-002 (BORRADOR)

   Extended mode:
   → Todos los ajustes visibles (T1 + T2)
   → Ver también: AJU-SEED-T2-001 (CONFIRMADO), AJU-SEED-T2-002 (PENDIENTE)

6. KPIs
   → Deben cambiar según el modo seleccionado
`);

  console.log('\n✅ Seed completado exitosamente!\n');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
