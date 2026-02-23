/**
 * Seed de datos de ejemplo — Centro de Costos V2
 *
 * Crea datos realistas para el rubro "fabricación de adoquines / bloques de hormigón"
 * y los deja disponibles para Feb 2026 (mes actual de demostración).
 *
 * Incluye:
 * - Proveedores, clientes, categorías de productos
 * - Insumos con precio promedio ponderado (mismo insumo de 2 proveedores)
 * - Recetas de producción
 * - Facturas de compras directas e indirectas
 * - Facturas de ventas
 * - Producción mensual registrada
 * - Configuración de distribución de costos indirectos
 * - Activación de CostSystemConfig en modo V2
 *
 * Ejecutar: npm run seed:costos-v2
 */

import { PrismaClient, DocType, SalesInvoiceType, SalesInvoiceStatus, IndirectCategory } from '@prisma/client';

const prisma = new PrismaClient();

const SEED_MONTH = '2026-02';
const MES_INICIO = new Date('2026-02-01T00:00:00.000Z');
const MES_FIN = new Date('2026-02-28T23:59:59.999Z');
const MES_ANTERIOR_INICIO = new Date('2026-01-01T00:00:00.000Z');

async function seedCostosV2() {
  console.log('🏭 Iniciando seed — Centro de Costos V2...\n');

  // ─── 1. Bootstrap: empresa y usuario ─────────────────────────────────────
  const company = await prisma.company.findFirst({
    select: { id: true, name: true },
  });
  if (!company) {
    console.log('⚠️  No se encontraron empresas. Abortando seed.');
    return;
  }
  console.log(`📊 Empresa: ${company.name} (ID: ${company.id})\n`);

  const user = await prisma.user.findFirst({
    where: { companies: { some: { companyId: company.id } } },
    select: { id: true },
  });
  if (!user) {
    console.log('⚠️  No se encontró un usuario asociado a la empresa. Abortando seed.');
    return;
  }

  const cid = company.id;
  const uid = user.id;

  // ─── 2. PurchaseAccount (tipoCuenta) ─────────────────────────────────────
  let tipoCuenta = await prisma.purchaseAccount.findFirst({
    where: { companyId: cid },
  });
  if (!tipoCuenta) {
    tipoCuenta = await prisma.purchaseAccount.create({
      data: { nombre: 'Cuentas a Pagar', companyId: cid },
    });
    console.log(`✅ PurchaseAccount creado: ${tipoCuenta.nombre}`);
  } else {
    console.log(`ℹ️  PurchaseAccount existente: ${tipoCuenta.nombre}`);
  }

  // ─── 3. Categorías de productos ──────────────────────────────────────────
  async function findOrCreateCategory(name: string) {
    const existing = await prisma.product_categories.findFirst({
      where: { name, company_id: cid },
    });
    if (existing) return existing;
    return prisma.product_categories.create({
      data: { name, company_id: cid },
    });
  }

  const catAdoquines = await findOrCreateCategory('Adoquines');
  const catBloques   = await findOrCreateCategory('Bloques');
  const catCordones  = await findOrCreateCategory('Cordones');
  console.log(`✅ Categorías: ${catAdoquines.name}, ${catBloques.name}, ${catCordones.name}`);

  // ─── 4. Proveedores ───────────────────────────────────────────────────────
  async function findOrCreateSupplier(name: string, razon_social: string, cuit: string) {
    const existing = await prisma.suppliers.findFirst({
      where: { cuit, company_id: cid },
    });
    if (existing) return existing;
    return prisma.suppliers.create({
      data: { name, razon_social, cuit, company_id: cid },
    });
  }

  const provCementoA = await findOrCreateSupplier(
    'Cementos Avellaneda',
    'Cementos Avellaneda SA',
    '30-55512345-6'
  );
  const provCementoB = await findOrCreateSupplier(
    'Loma Negra',
    'Loma Negra CIASA',
    '30-68432156-4'
  );
  const provEdenor = await findOrCreateSupplier(
    'Edenor',
    'Empresa Distribuidora y Comercializadora Norte SA',
    '30-67676282-5'
  );
  const provSeguro = await findOrCreateSupplier(
    'La Caja Seguros',
    'La Caja de Ahorro y Seguro SA',
    '30-50000062-0'
  );
  console.log(`✅ Proveedores: ${provCementoA.name}, ${provCementoB.name}, ${provEdenor.name}, ${provSeguro.name}`);

  // ─── 5. Clientes ─────────────────────────────────────────────────────────
  async function findOrCreateClient(email: string, name: string, legalName: string, cuit: string) {
    const existing = await prisma.client.findFirst({
      where: { email, companyId: cid },
    });
    if (existing) return existing;
    return prisma.client.create({
      data: {
        email,
        name,
        legalName,
        cuit,
        postalCode: '1900',
        city: 'La Plata',
        province: 'Buenos Aires',
        companyId: cid,
      },
    });
  }

  const clientMunicipio = await findOrCreateClient(
    'compras@municipalidad.gob.ar',
    'Municipalidad de La Plata',
    'Municipalidad de La Plata',
    '30-99901234-5'
  );
  const clientConstructora = await findOrCreateClient(
    'admin@constructora-rivero.com',
    'Constructora Rivero',
    'Constructora Rivero SRL',
    '20-28345678-9'
  );
  console.log(`✅ Clientes: ${clientMunicipio.name}, ${clientConstructora.name}`);

  // ─── 6. InputItems (insumos) con precio promedio ponderado ───────────────
  //
  // Cemento: 2 compras del mes
  //   Cementos Avellaneda: 500 bolsas × $2.800 = $1.400.000
  //   Loma Negra:          300 bolsas × $3.200 = $  960.000
  //   Total: 800 bolsas, $2.360.000
  //   Precio PPP = $2.360.000 / 800 = $2.950/bolsa
  //
  const PPP_CEMENTO = (500 * 2800 + 300 * 3200) / (500 + 300); // 2950

  async function findOrCreateInput(name: string, unitLabel: string, currentPrice: number) {
    const existing = await prisma.inputItem.findFirst({
      where: { name, companyId: cid },
    });
    if (existing) return existing;
    return prisma.inputItem.create({
      data: { name, unitLabel, currentPrice, companyId: cid },
    });
  }

  const insCemento = await findOrCreateInput('Cemento Portland', 'bolsa 50kg', PPP_CEMENTO);
  const insArena   = await findOrCreateInput('Arena Gruesa', 'm³', 18500);
  const insAditivo = await findOrCreateInput('Aditivo Plastificante', 'L', 3200);
  console.log(`✅ Insumos: Cemento (PPP=$${PPP_CEMENTO}), Arena, Aditivo`);

  // Historial de precios del cemento: precio anterior y precio actual PPP
  const cementoHistorial = await prisma.inputPriceHistory.findFirst({
    where: { inputId: insCemento.id, companyId: cid },
  });
  if (!cementoHistorial) {
    await prisma.inputPriceHistory.createMany({
      data: [
        { inputId: insCemento.id, companyId: cid, effectiveFrom: MES_ANTERIOR_INICIO, price: 2650 },
        { inputId: insCemento.id, companyId: cid, effectiveFrom: MES_INICIO, price: PPP_CEMENTO },
      ],
    });
    console.log(`✅ Historial de precios del cemento creado (2650 → ${PPP_CEMENTO})`);
  }

  // ─── 7. Line (línea de producción) ───────────────────────────────────────
  let line = await prisma.line.findFirst({
    where: { companyId: cid },
  });
  if (!line) {
    line = await prisma.line.create({
      data: { code: 'PAVI', name: 'Línea de Pavimentación', companyId: cid },
    });
    console.log(`✅ Line creada: ${line.name}`);
  } else {
    console.log(`ℹ️  Line existente: ${line.name}`);
  }

  // ─── 8. CostProducts ─────────────────────────────────────────────────────
  async function findOrCreateCostProduct(name: string) {
    const existing = await prisma.costProduct.findFirst({
      where: { name, companyId: cid },
    });
    if (existing) return existing;
    return prisma.costProduct.create({
      data: {
        name,
        lineId: line!.id,
        measureKind: 'UNIT',
        unitLabel: 'UN',
        costMethod: 'REAL',
        companyId: cid,
      },
    });
  }

  const prodAdoquin = await findOrCreateCostProduct('Adoquín 20×10×6');
  const prodBloque  = await findOrCreateCostProduct('Bloque Calcareo 20×40');
  console.log(`✅ CostProducts: ${prodAdoquin.name}, ${prodBloque.name}`);

  // ─── 9. Recetas ──────────────────────────────────────────────────────────
  async function findOrCreateRecipe(name: string, scopeId: string) {
    const existing = await prisma.recipe.findFirst({
      where: { name, companyId: cid, scopeId },
    });
    if (existing) return existing;
    return prisma.recipe.create({
      data: {
        name,
        scopeType: 'COST_PRODUCT',
        scopeId,
        version: 1,
        base: 'PER_BATCH',
        baseQty: name.includes('Adoquín') ? 1000 : 500,
        baseUnit: 'UN',
        status: 'ACTIVE',
        isActive: true,
        companyId: cid,
      },
    });
  }

  const recetaAdoquin = await findOrCreateRecipe('Receta Adoquín 20×10×6', prodAdoquin.id);
  const recetaBloque  = await findOrCreateRecipe('Receta Bloque Calcareo', prodBloque.id);

  // Items de receta — Adoquín
  const recetaAdoquinItems = await prisma.recipeItem.count({
    where: { recipeId: recetaAdoquin.id },
  });
  if (recetaAdoquinItems === 0) {
    await prisma.recipeItem.createMany({
      data: [
        { recipeId: recetaAdoquin.id, inputId: insCemento.id, quantity: 8,    unitLabel: 'bolsa 50kg' },
        { recipeId: recetaAdoquin.id, inputId: insArena.id,   quantity: 0.35, unitLabel: 'm³' },
        { recipeId: recetaAdoquin.id, inputId: insAditivo.id, quantity: 2,    unitLabel: 'L' },
      ],
    });
    console.log(`✅ RecipeItems Adoquín: cemento(8), arena(0.35), aditivo(2)`);
  }

  // Items de receta — Bloque
  const recetaBloqueItems = await prisma.recipeItem.count({
    where: { recipeId: recetaBloque.id },
  });
  if (recetaBloqueItems === 0) {
    await prisma.recipeItem.createMany({
      data: [
        { recipeId: recetaBloque.id, inputId: insCemento.id, quantity: 5,    unitLabel: 'bolsa 50kg' },
        { recipeId: recetaBloque.id, inputId: insArena.id,   quantity: 0.20, unitLabel: 'm³' },
      ],
    });
    console.log(`✅ RecipeItems Bloque: cemento(5), arena(0.20)`);
  }

  // ─── 10. PurchaseReceipts — compras directas de insumos ──────────────────
  console.log('\n📦 Creando comprobantes de compras directas...');

  const comprasDirectas = [
    {
      proveedor: provCementoA,
      serie: '0001',
      numero: `CV2-${Date.now()}-1`,
      fecha: new Date('2026-02-05T12:00:00.000Z'),
      neto: 1400000,
      iva21: 294000,
      total: 1694000,
      descripcion: `Cemento Portland bolsa 50kg`,
      cantidad: 500,
      unidad: 'bolsa',
      precioUnitario: 2800,
    },
    {
      proveedor: provCementoB,
      serie: '0001',
      numero: `CV2-${Date.now()}-2`,
      fecha: new Date('2026-02-12T12:00:00.000Z'),
      neto: 960000,
      iva21: 201600,
      total: 1161600,
      descripcion: `Cemento Portland bolsa 50kg`,
      cantidad: 300,
      unidad: 'bolsa',
      precioUnitario: 3200,
    },
  ];

  for (const c of comprasDirectas) {
    const existe = await prisma.purchaseReceipt.findFirst({
      where: { proveedorId: c.proveedor.id, companyId: cid, neto: c.neto },
    });
    if (!existe) {
      const receipt = await prisma.purchaseReceipt.create({
        data: {
          numeroSerie: c.serie,
          numeroFactura: c.numero,
          tipo: 'FC',
          proveedorId: c.proveedor.id,
          fechaEmision: c.fecha,
          fechaImputacion: c.fecha,
          tipoPago: 'credito',
          neto: c.neto,
          iva21: c.iva21,
          total: c.total,
          estado: 'pendiente',
          docType: 'T1' as DocType,
          esIndirecto: false,
          tipoCuentaId: tipoCuenta!.id,
          companyId: cid,
          createdBy: uid,
        },
      });
      await prisma.purchaseReceiptItem.create({
        data: {
          comprobanteId: receipt.id,
          descripcion: c.descripcion,
          cantidad: c.cantidad,
          unidad: c.unidad,
          precioUnitario: c.precioUnitario,
          subtotal: c.neto,
          proveedorId: c.proveedor.id,
          companyId: cid,
        },
      });
      console.log(`  ✅ Compra directa: ${c.proveedor.name} — $${c.neto.toLocaleString('es-AR')}`);
    } else {
      console.log(`  ℹ️  Compra directa ${c.proveedor.name} ya existe`);
    }
  }

  // ─── 11. PurchaseReceipts — costos indirectos ─────────────────────────────
  console.log('\n⚡ Creando comprobantes de costos indirectos...');

  const comprasIndirectas = [
    {
      proveedor: provEdenor,
      serie: '0001',
      numero: '10000789',
      fecha: new Date('2026-02-03T12:00:00.000Z'),
      neto: 9800,
      iva21: 2058,
      total: 11858,
      categoria: IndirectCategory.UTILITIES,
      descripcion: 'Servicio eléctrico Feb 2026 — Planta 1',
    },
    {
      proveedor: provEdenor,
      serie: '0001',
      numero: '10000790',
      fecha: new Date('2026-02-10T12:00:00.000Z'),
      neto: 8700,
      iva21: 1827,
      total: 10527,
      categoria: IndirectCategory.UTILITIES,
      descripcion: 'Servicio eléctrico Feb 2026 — Planta 2',
    },
    {
      proveedor: provSeguro,
      serie: '0001',
      numero: '00002201',
      fecha: new Date('2026-02-01T12:00:00.000Z'),
      neto: 12000,
      iva21: 2520,
      total: 14520,
      categoria: IndirectCategory.VEHICLES,
      descripcion: 'Seguro flotilla vehículos Feb 2026',
    },
    {
      proveedor: provSeguro,
      serie: '0002',
      numero: '00000310',
      fecha: new Date('2026-02-15T12:00:00.000Z'),
      neto: 8400,
      iva21: 0,
      total: 8400,
      categoria: IndirectCategory.IMP_SERV,
      descripcion: 'Tasa municipal actividad industrial',
    },
  ];

  for (const c of comprasIndirectas) {
    const existe = await prisma.purchaseReceipt.findFirst({
      where: {
        proveedorId: c.proveedor.id,
        companyId: cid,
        numeroFactura: c.numero,
        esIndirecto: true,
      },
    });
    if (!existe) {
      await prisma.purchaseReceipt.create({
        data: {
          numeroSerie: c.serie,
          numeroFactura: c.numero,
          tipo: 'FC',
          proveedorId: c.proveedor.id,
          fechaEmision: c.fecha,
          fechaImputacion: c.fecha,   // ← getIndirectCostsForMonth filtra por este campo
          tipoPago: 'credito',
          neto: c.neto,
          iva21: c.iva21,
          total: c.total,
          estado: 'pendiente',
          docType: 'T1' as DocType,
          esIndirecto: true,
          indirectCategory: c.categoria,
          tipoCuentaId: tipoCuenta!.id,
          companyId: cid,
          createdBy: uid,
        },
      });
      console.log(`  ✅ Indirecto [${c.categoria}]: ${c.proveedor.name} — $${c.neto.toLocaleString('es-AR')}`);
    } else {
      console.log(`  ℹ️  Indirecto ${c.numero} (${c.categoria}) ya existe`);
    }
  }

  // ─── 12. SalesInvoices ────────────────────────────────────────────────────
  console.log('\n🧾 Creando facturas de ventas...');

  const facturasVenta = [
    {
      cliente: clientMunicipio,
      tipo: SalesInvoiceType.B,
      letra: 'B',
      puntoVenta: '00001',
      numero: '00000001',
      fecha: new Date('2026-02-07T12:00:00.000Z'),
      netoGravado: 2800000,
      iva21: 588000,
      total: 3388000,
      items: [{ descripcion: 'Adoquines 20×10×6 c/100', cantidad: 4000, precioUnitario: 700 }],
    },
    {
      cliente: clientMunicipio,
      tipo: SalesInvoiceType.B,
      letra: 'B',
      puntoVenta: '00001',
      numero: '00000002',
      fecha: new Date('2026-02-14T12:00:00.000Z'),
      netoGravado: 1500000,
      iva21: 315000,
      total: 1815000,
      items: [{ descripcion: 'Bloques Calcareos 20×40', cantidad: 1500, precioUnitario: 1000 }],
    },
    {
      cliente: clientConstructora,
      tipo: SalesInvoiceType.A,
      letra: 'A',
      puntoVenta: '00001',
      numero: '00000001',
      fecha: new Date('2026-02-20T12:00:00.000Z'),
      netoGravado: 980000,
      iva21: 205800,
      total: 1185800,
      items: [{ descripcion: 'Adoquines 20×10×6 c/100', cantidad: 2800, precioUnitario: 350 }],
    },
  ];

  for (const f of facturasVenta) {
    const numeroCompleto = `${f.letra}-${f.puntoVenta}-${f.numero}`;
    const existe = await prisma.salesInvoice.findFirst({
      where: { companyId: cid, tipo: f.tipo, puntoVenta: f.puntoVenta, numero: f.numero },
    });
    if (!existe) {
      const invoice = await prisma.salesInvoice.create({
        data: {
          tipo: f.tipo,
          letra: f.letra,
          puntoVenta: f.puntoVenta,
          numero: f.numero,
          numeroCompleto,
          clientId: f.cliente.id,
          estado: SalesInvoiceStatus.EMITIDA,
          fechaEmision: f.fecha,
          fechaVencimiento: new Date(f.fecha.getTime() + 30 * 24 * 60 * 60 * 1000),
          netoGravado: f.netoGravado,
          iva21: f.iva21,
          total: f.total,
          saldoPendiente: f.total,
          docType: 'T1' as DocType,
          companyId: cid,
          createdBy: uid,
        },
      });
      for (const item of f.items) {
        const subtotal = item.cantidad * item.precioUnitario;
        await prisma.salesInvoiceItem.create({
          data: {
            invoiceId: invoice.id,
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            unidad: 'UN',
            precioUnitario: item.precioUnitario,
            subtotal,
          },
        });
      }
      console.log(`  ✅ Factura ${numeroCompleto}: $${f.total.toLocaleString('es-AR')}`);
    } else {
      console.log(`  ℹ️  Factura ${numeroCompleto} ya existe`);
    }
  }

  // ─── 13. MonthlyProduction ────────────────────────────────────────────────
  console.log('\n🏗️  Creando producción mensual...');

  await prisma.monthlyProduction.upsert({
    where: { productId_month: { productId: prodAdoquin.id, month: SEED_MONTH } },
    create: { productId: prodAdoquin.id, month: SEED_MONTH, producedQuantity: 15000, companyId: cid },
    update: { producedQuantity: 15000 },
  });
  console.log(`  ✅ Adoquín 20×10×6: 15.000 unidades producidas en ${SEED_MONTH}`);

  await prisma.monthlyProduction.upsert({
    where: { productId_month: { productId: prodBloque.id, month: SEED_MONTH } },
    create: { productId: prodBloque.id, month: SEED_MONTH, producedQuantity: 4000, companyId: cid },
    update: { producedQuantity: 4000 },
  });
  console.log(`  ✅ Bloque Calcareo 20×40: 4.000 unidades producidas en ${SEED_MONTH}`);

  // ─── 14. IndirectDistributionConfig ──────────────────────────────────────
  console.log('\n📊 Configurando distribución de costos indirectos...');

  await prisma.indirectDistributionConfig.deleteMany({ where: { companyId: cid } });

  const distribuciones = [
    // UTILITIES → 60% Adoquines, 30% Bloques, 10% Cordones
    { indirectCategory: IndirectCategory.UTILITIES, cat: catAdoquines, percentage: 60 },
    { indirectCategory: IndirectCategory.UTILITIES, cat: catBloques,   percentage: 30 },
    { indirectCategory: IndirectCategory.UTILITIES, cat: catCordones,  percentage: 10 },
    // VEHICLES → 50% Adoquines, 50% Bloques
    { indirectCategory: IndirectCategory.VEHICLES,  cat: catAdoquines, percentage: 50 },
    { indirectCategory: IndirectCategory.VEHICLES,  cat: catBloques,   percentage: 50 },
    // IMP_SERV → 70% Adoquines, 30% Bloques
    { indirectCategory: IndirectCategory.IMP_SERV,  cat: catAdoquines, percentage: 70 },
    { indirectCategory: IndirectCategory.IMP_SERV,  cat: catBloques,   percentage: 30 },
  ];

  await prisma.indirectDistributionConfig.createMany({
    data: distribuciones.map((d) => ({
      companyId: cid,
      indirectCategory: d.indirectCategory,
      productCategoryId: d.cat.id,
      productCategoryName: d.cat.name,
      percentage: d.percentage,
    })),
  });
  console.log(`  ✅ ${distribuciones.length} reglas de distribución creadas`);

  // ─── 15. CostSystemConfig — activar V2 ───────────────────────────────────
  console.log('\n⚙️  Activando Centro de Costos V2...');

  await prisma.costSystemConfig.upsert({
    where: { companyId: cid },
    create: {
      companyId: cid,
      version: 'V2',
      useComprasData: true,
      useVentasData: true,
      useProdData: true,
      useIndirectData: true,
      v2EnabledAt: new Date(),
    },
    update: {
      version: 'V2',
      useComprasData: true,
      useVentasData: true,
      useProdData: true,
      useIndirectData: true,
    },
  });
  console.log('  ✅ CostSystemConfig: V2 activado con todas las fuentes de datos');

  // ─── Resumen ──────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN — DATOS CREADOS PARA COSTOS V2');
  console.log('='.repeat(60));
  console.log(`Mes de referencia:    ${SEED_MONTH}`);
  console.log(`Empresa:              ${company.name}`);
  console.log('');
  console.log('Ventas (3 facturas):');
  console.log('  B-00001-00000001:   $3.388.000  (Municipalidad — Adoquines)');
  console.log('  B-00001-00000002:   $1.815.000  (Municipalidad — Bloques)');
  console.log('  A-00001-00000001:   $1.185.800  (Constructora Rivero)');
  console.log('  TOTAL VENTAS:       $6.388.800');
  console.log('');
  console.log('Compras directas (2 facturas):');
  console.log('  Cementos Avellaneda: $1.694.000  (500 bolsas × $2.800)');
  console.log('  Loma Negra:          $1.161.600  (300 bolsas × $3.200)');
  console.log(`  Precio PPP cemento:  $${PPP_CEMENTO}/bolsa`);
  console.log('');
  console.log('Costos indirectos (4 facturas):');
  console.log('  UTILITIES (Edenor ×2): $18.500 → distribuido 60/30/10%');
  console.log('  VEHICLES (seguro):     $12.000 → distribuido 50/50%');
  console.log('  IMP_SERV (tasa):       $ 8.400 → distribuido 70/30%');
  console.log('  TOTAL INDIRECTOS:      $38.900');
  console.log('');
  console.log('Producción Feb 2026:');
  console.log('  Adoquín 20×10×6:  15.000 unidades');
  console.log('  Bloque Calcareo:   4.000 unidades');
  console.log('='.repeat(60));
}

seedCostosV2()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
