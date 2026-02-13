const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Creando datos de prueba para el portal...\n');

  // 1. Obtener empresa y cliente
  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) {
    console.error('❌ No se encontró ninguna empresa activa');
    return;
  }
  console.log('✅ Empresa:', company.name, '(ID:', company.id + ')');

  const client = await prisma.client.findFirst({
    where: { companyId: company.id },
  });
  if (!client) {
    console.error('❌ No se encontró ningún cliente');
    return;
  }
  console.log('✅ Cliente:', client.legalName, '(ID:', client.id + ')');

  // Obtener usuario del portal
  const portalUser = await prisma.clientPortalUser.findFirst({
    where: { clientId: client.id, companyId: company.id },
  });
  if (!portalUser) {
    console.error('❌ No se encontró usuario del portal. Ejecuta primero create-portal-test-user.js');
    return;
  }
  console.log('✅ Usuario portal:', portalUser.email);

  // Obtener un usuario admin para creator (via UserOnCompany relation)
  const userOnCompany = await prisma.userOnCompany.findFirst({
    where: { companyId: company.id },
    include: { user: true },
  });
  if (!userOnCompany) {
    console.error('❌ No se encontró ningún usuario admin');
    return;
  }
  const adminUser = userOnCompany.user;
  console.log('✅ Usuario admin:', adminUser.name);

  // 2. Crear o obtener categoría de productos
  let category = await prisma.category.findFirst({
    where: { companyId: company.id },
  });

  if (!category) {
    category = await prisma.category.create({
      data: {
        name: 'Materiales de Construcción',
        description: 'Productos para construcción',
        companyId: company.id,
        createdById: adminUser.id,
        isActive: true,
      },
    });
    console.log('✅ Categoría creada:', category.name);
  } else {
    console.log('✅ Categoría existente:', category.name);
  }

  // 3. Crear productos de prueba con precios de venta
  console.log('\n📦 Creando productos de prueba...');

  const productData = [
    { code: 'PROD-001', name: 'Bloques de Hormigón 20x20x40', unit: 'unidad', costPrice: 105, salePrice: 150 },
    { code: 'PROD-002', name: 'Ladrillos Cerámicos 12x18x33', unit: 'unidad', costPrice: 60, salePrice: 85 },
    { code: 'PROD-003', name: 'Cemento Portland 50kg', unit: 'bolsa', costPrice: 840, salePrice: 1200 },
    { code: 'PROD-004', name: 'Arena Fina x m3', unit: 'm3', costPrice: 3150, salePrice: 4500 },
    { code: 'PROD-005', name: 'Piedra Partida x m3', unit: 'm3', costPrice: 3640, salePrice: 5200 },
    { code: 'PROD-006', name: 'Cal Hidratada 25kg', unit: 'bolsa', costPrice: 455, salePrice: 650 },
    { code: 'PROD-007', name: 'Hierro 8mm x 12m', unit: 'barra', costPrice: 1960, salePrice: 2800 },
    { code: 'PROD-008', name: 'Hierro 10mm x 12m', unit: 'barra', costPrice: 2940, salePrice: 4200 },
    { code: 'PROD-009', name: 'Malla Electrosoldada 15x15cm', unit: 'panel', costPrice: 5950, salePrice: 8500 },
    { code: 'PROD-010', name: 'Membrana Asfáltica 4mm', unit: 'rollo', costPrice: 10500, salePrice: 15000 },
  ];

  const createdProducts = [];
  for (const pData of productData) {
    let product = await prisma.product.findFirst({
      where: { code: pData.code, companyId: company.id },
    });

    if (!product) {
      product = await prisma.product.create({
        data: {
          code: pData.code,
          name: pData.name,
          description: `${pData.name} - Material de construcción de alta calidad`,
          unit: pData.unit,
          categoryId: category.id,
          companyId: company.id,
          createdById: adminUser.id,
          costPrice: pData.costPrice,
          costCurrency: 'ARS',
          salePrice: pData.salePrice,
          saleCurrency: 'ARS',
          minStock: 10,
          currentStock: 100,
          volume: 0,
          weight: 0,
          location: 'Depósito 1',
          isActive: true,
        },
      });
      console.log('  ✅ Producto creado:', product.name);
    } else {
      // Actualizar precio de venta si no tiene
      if (!product.salePrice) {
        await prisma.product.update({
          where: { id: product.id },
          data: { salePrice: pData.salePrice, saleCurrency: 'ARS' },
        });
        console.log('  ℹ️ Producto actualizado con precio:', product.name);
      } else {
        console.log('  ℹ️ Producto existente:', product.name);
      }
    }

    createdProducts.push({ product, price: pData.salePrice });
  }
  console.log('✅ Productos creados/actualizados');

  // 4. Crear cotizaciones de prueba
  console.log('\n📝 Creando cotizaciones de prueba...');

  const cotizacionesData = [
    {
      numero: 'COT-2026-00001',
      estado: 'ENVIADA',
      titulo: 'Materiales para obra Villa Gesell',
      items: [
        { productIdx: 0, cantidad: 500 },
        { productIdx: 2, cantidad: 20 },
        { productIdx: 3, cantidad: 5 },
      ],
      diasValidez: 15,
    },
    {
      numero: 'COT-2026-00002',
      estado: 'EN_NEGOCIACION',
      titulo: 'Presupuesto construcción galpón',
      items: [
        { productIdx: 1, cantidad: 2000 },
        { productIdx: 6, cantidad: 100 },
        { productIdx: 7, cantidad: 80 },
      ],
      diasValidez: 30,
    },
    {
      numero: 'COT-2026-00003',
      estado: 'ACEPTADA',
      titulo: 'Ampliación local comercial',
      items: [
        { productIdx: 2, cantidad: 50 },
        { productIdx: 4, cantidad: 10 },
        { productIdx: 8, cantidad: 15 },
      ],
      diasValidez: 10,
    },
    {
      numero: 'COT-2026-00004',
      estado: 'CONVERTIDA',
      titulo: 'Remodelación oficinas',
      items: [
        { productIdx: 5, cantidad: 30 },
        { productIdx: 9, cantidad: 5 },
      ],
      diasValidez: 7,
    },
    {
      numero: 'COT-2026-00005',
      estado: 'VENCIDA',
      titulo: 'Proyecto abandonado',
      items: [
        { productIdx: 0, cantidad: 100 },
        { productIdx: 1, cantidad: 200 },
      ],
      diasValidez: -10, // Ya vencida
    },
  ];

  for (const cotData of cotizacionesData) {
    const existing = await prisma.quote.findFirst({
      where: { numero: cotData.numero, companyId: company.id },
    });

    if (existing) {
      console.log('  ℹ️ Cotización existente:', cotData.numero);
      continue;
    }

    // Calcular items y totales
    let subtotal = 0;
    const items = cotData.items.map((item, idx) => {
      const prod = createdProducts[item.productIdx];
      const itemSubtotal = prod.price * item.cantidad;
      subtotal += itemSubtotal;
      return {
        productId: prod.product.id,
        codigo: prod.product.code,
        descripcion: prod.product.name,
        cantidad: item.cantidad,
        unidad: prod.product.unit,
        precioUnitario: prod.price,
        descuento: 0,
        subtotal: itemSubtotal,
        orden: idx,
      };
    });

    const descuentoMonto = subtotal * 0.05; // 5% descuento
    const baseImponible = subtotal - descuentoMonto;
    const impuestos = baseImponible * 0.21;
    const total = baseImponible + impuestos;

    const fechaEmision = new Date();
    fechaEmision.setDate(fechaEmision.getDate() - Math.floor(Math.random() * 30));

    const fechaValidez = new Date(fechaEmision);
    fechaValidez.setDate(fechaValidez.getDate() + cotData.diasValidez);

    const quote = await prisma.quote.create({
      data: {
        numero: cotData.numero,
        company: { connect: { id: company.id } },
        client: { connect: { id: client.id } },
        seller: { connect: { id: adminUser.id } },
        estado: cotData.estado,
        quoteType: 'COTIZACION',
        fechaEmision,
        fechaValidez,
        fechaEnvio: cotData.estado !== 'BORRADOR' ? fechaEmision : null,
        subtotal,
        descuentoGlobal: 5,
        descuentoMonto,
        tasaIva: 21,
        impuestos,
        total,
        moneda: 'ARS',
        condicionesPago: 'Contado contra entrega',
        diasPlazo: 0,
        condicionesEntrega: 'Puesto en obra',
        tiempoEntrega: '5-7 días hábiles',
        titulo: cotData.titulo,
        descripcion: `Cotización para ${cotData.titulo.toLowerCase()}`,
        notas: 'Precios válidos hasta la fecha de validez indicada.',
        createdByUser: { connect: { id: adminUser.id } },
        items: {
          create: items,
        },
      },
    });

    console.log('  ✅ Cotización creada:', quote.numero, '-', cotData.estado);
  }

  // 5. Crear pedidos del portal
  console.log('\n📦 Creando pedidos del portal...');

  const pedidosData = [
    {
      numero: 'PED-2026-00001',
      estado: 'PENDIENTE',
      items: [
        { productIdx: 0, cantidad: 200 },
        { productIdx: 2, cantidad: 10 },
      ],
      notas: 'Entregar en horario de mañana',
    },
    {
      numero: 'PED-2026-00002',
      estado: 'EN_REVISION',
      items: [
        { productIdx: 3, cantidad: 3 },
        { productIdx: 4, cantidad: 3 },
      ],
      notas: 'Urgente para obra',
    },
    {
      numero: 'PED-2026-00003',
      estado: 'CONFIRMADO',
      items: [
        { productIdx: 6, cantidad: 50 },
        { productIdx: 7, cantidad: 30 },
      ],
      notas: null,
    },
    {
      numero: 'PED-2026-00004',
      estado: 'CONVERTIDO',
      items: [
        { productIdx: 1, cantidad: 1000 },
      ],
      notas: 'Convertido a orden de venta',
    },
  ];

  for (const pedData of pedidosData) {
    const existing = await prisma.clientPortalOrder.findFirst({
      where: { numero: pedData.numero, companyId: company.id },
    });

    if (existing) {
      console.log('  ℹ️ Pedido existente:', pedData.numero);
      continue;
    }

    // Calcular items y totales
    let subtotal = 0;
    const items = pedData.items.map((item) => {
      const prod = createdProducts[item.productIdx];
      const itemSubtotal = prod.price * item.cantidad;
      subtotal += itemSubtotal;
      return {
        productId: prod.product.id,
        descripcion: prod.product.name,
        cantidad: item.cantidad,
        unidad: prod.product.unit,
        precioUnitario: prod.price,
        subtotal: itemSubtotal,
      };
    });

    const order = await prisma.clientPortalOrder.create({
      data: {
        numero: pedData.numero,
        company: { connect: { id: company.id } },
        client: { connect: { id: client.id } },
        createdByUser: { connect: { id: portalUser.id } },
        clientRequestId: crypto.randomUUID(),
        estado: pedData.estado,
        subtotal,
        total: subtotal * 1.21,
        moneda: 'ARS',
        notasCliente: pedData.notas,
        direccionEntrega: client.address || 'Sin dirección especificada',
        items: {
          create: items,
        },
      },
    });

    console.log('  ✅ Pedido creado:', order.numero, '-', pedData.estado);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ DATOS DE PRUEBA CREADOS EXITOSAMENTE');
  console.log('='.repeat(60));
  console.log('\n📊 Resumen:');
  console.log('   - 10 Productos con precios de venta');
  console.log('   - 5 Cotizaciones (ENVIADA, EN_NEGOCIACION, ACEPTADA, CONVERTIDA, VENCIDA)');
  console.log('   - 4 Pedidos (PENDIENTE, EN_REVISION, CONFIRMADO, CONVERTIDO)');
  console.log('\n🔗 Accede al portal: http://localhost:3000/portal');
  console.log('='.repeat(60));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
