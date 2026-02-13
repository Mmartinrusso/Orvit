import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding datos completos de Ventas (T1 y T2)...\n');

  // Get company
  const company = await prisma.company.findFirst();
  if (!company) {
    console.error('❌ No se encontró ninguna empresa.');
    return;
  }
  console.log(`✅ Empresa: ${company.name} (ID: ${company.id})\n`);

  // Get a user for createdBy (via UserOnCompany relation)
  const userOnCompany = await prisma.userOnCompany.findFirst({
    where: { companyId: company.id },
    select: { userId: true }
  });

  if (!userOnCompany) {
    console.error('❌ No se encontró ningún usuario en la empresa.');
    return;
  }

  const userId = userOnCompany.userId;
  console.log(`✅ Usuario ID: ${userId}\n`);

  // ============================================
  // 1. PRODUCTOS
  // ============================================
  console.log('📦 Creando Productos...');

  // Get or create a category for products
  let productCategory = await prisma.category.findFirst({
    where: { companyId: company.id }
  });

  if (!productCategory) {
    productCategory = await prisma.category.create({
      data: {
        name: 'General',
        description: 'Categoría general de productos',
        companyId: company.id,
        createdById: userId,
      }
    });
    console.log('  ✅ Categoría General creada');
  }

  const productos = [
    { codigo: 'PROD-001', nombre: 'Cemento Portland 50kg', precioBase: 8500, unidad: 'BOLSA', stock: 1000 },
    { codigo: 'PROD-002', nombre: 'Arena Fina 1m³', precioBase: 15000, unidad: 'M3', stock: 500 },
    { codigo: 'PROD-003', nombre: 'Ladrillo Común x1000', precioBase: 25000, unidad: 'MILLAR', stock: 300 },
    { codigo: 'PROD-004', nombre: 'Hierro 8mm x12m', precioBase: 12000, unidad: 'BARRA', stock: 800 },
    { codigo: 'PROD-005', nombre: 'Hierro 10mm x12m', precioBase: 18000, unidad: 'BARRA', stock: 600 },
    { codigo: 'PROD-006', nombre: 'Hierro 12mm x12m', precioBase: 26000, unidad: 'BARRA', stock: 400 },
    { codigo: 'PROD-007', nombre: 'Chapa Trapezoidal 1.10x6m', precioBase: 45000, unidad: 'UNIDAD', stock: 200 },
    { codigo: 'PROD-008', nombre: 'Chapa Lisa 1.22x2.44m', precioBase: 35000, unidad: 'UNIDAD', stock: 150 },
    { codigo: 'PROD-009', nombre: 'Pintura Látex Interior 20L', precioBase: 28000, unidad: 'BALDE', stock: 250 },
    { codigo: 'PROD-010', nombre: 'Pintura Látex Exterior 20L', precioBase: 35000, unidad: 'BALDE', stock: 200 },
    { codigo: 'PROD-011', nombre: 'Caño Estructural 40x40x2mm', precioBase: 22000, unidad: 'BARRA', stock: 300 },
    { codigo: 'PROD-012', nombre: 'Caño Estructural 50x50x2mm', precioBase: 32000, unidad: 'BARRA', stock: 250 },
  ];

  const productosCreados = [];
  for (const prod of productos) {
    const existing = await prisma.product.findFirst({
      where: { companyId: company.id, code: prod.codigo }
    });

    if (existing) {
      console.log(`  ⏭️  Producto ya existe: ${prod.nombre}`);
      productosCreados.push(existing);
    } else {
      const producto = await prisma.product.create({
        data: {
          companyId: company.id,
          code: prod.codigo,
          name: prod.nombre,
          description: `Descripción de ${prod.nombre}`,
          categoryId: productCategory.id,
          costPrice: prod.precioBase * 0.6,
          costCurrency: 'ARS',
          unit: prod.unidad,
          currentStock: prod.stock,
          minStock: Math.floor(prod.stock * 0.2),
          volume: 0,
          weight: 0,
          location: 'A1',
          isActive: true,
          costType: 'MANUAL',
          saleCurrency: 'ARS',
          createdById: userId,
        }
      });
      console.log(`  ✅ Producto creado: ${producto.name}`);
      productosCreados.push(producto);
    }
  }

  // ============================================
  // 2. LISTA DE PRECIOS
  // ============================================
  console.log('\n💰 Creando Listas de Precios...');

  let listaPrecioGeneral = await prisma.salesPriceList.findFirst({
    where: { companyId: company.id, nombre: 'General' }
  });

  if (!listaPrecioGeneral) {
    listaPrecioGeneral = await prisma.salesPriceList.create({
      data: {
        companyId: company.id,
        nombre: 'General',
        descripcion: 'Lista de precios estándar',
        isActive: true,
      }
    });

    // Agregar items a la lista
    for (let i = 0; i < productosCreados.length; i++) {
      const prod = productosCreados[i];
      const precioBase = productos[i].precioBase;
      await prisma.salesPriceListItem.create({
        data: {
          priceListId: listaPrecioGeneral.id,
          productId: prod.id,
          precioUnitario: Number(precioBase),
        }
      });
    }
    console.log('  ✅ Lista General creada con todos los productos');
  } else {
    console.log('  ⏭️  Lista General ya existe');
  }

  let listaPreMayorista = await prisma.salesPriceList.findFirst({
    where: { companyId: company.id, nombre: 'Mayorista' }
  });

  if (!listaPreMayorista) {
    listaPreMayorista = await prisma.salesPriceList.create({
      data: {
        companyId: company.id,
        nombre: 'Mayorista',
        descripcion: 'Lista de precios para mayoristas (10% descuento)',
        isActive: true,
      }
    });

    for (let i = 0; i < productosCreados.length; i++) {
      const prod = productosCreados[i];
      const precioBase = productos[i].precioBase;
      await prisma.salesPriceListItem.create({
        data: {
          priceListId: listaPreMayorista.id,
          productId: prod.id,
          precioUnitario: Number(precioBase) * 0.9,
        }
      });
    }
    console.log('  ✅ Lista Mayorista creada con descuento');
  } else {
    console.log('  ⏭️  Lista Mayorista ya existe');
  }

  // ============================================
  // 3. OBTENER CLIENTES
  // ============================================
  console.log('\n👥 Obteniendo Clientes...');
  const clientes = await prisma.client.findMany({
    where: { companyId: company.id },
    take: 5
  });

  if (clientes.length === 0) {
    console.error('❌ No hay clientes. Ejecuta seed-clientes-test.ts primero.');
    return;
  }
  console.log(`  ✅ ${clientes.length} clientes encontrados`);

  // ============================================
  // 4. COTIZACIONES (T1 y T2)
  // ============================================
  console.log('\n📝 Creando Cotizaciones...');

  const cotizaciones = [
    {
      clienteIdx: 0,
      items: [
        { prodIdx: 0, cantidad: 50, precio: productos[0].precioBase },
        { prodIdx: 3, cantidad: 100, precio: productos[3].precioBase },
      ],
      docType: 'T1',
      estado: 'ACEPTADA'
    },
    {
      clienteIdx: 1,
      items: [
        { prodIdx: 1, cantidad: 10, precio: productos[1].precioBase },
        { prodIdx: 2, cantidad: 5, precio: productos[2].precioBase },
      ],
      docType: 'T2',
      estado: 'ACEPTADA'
    },
    {
      clienteIdx: 2,
      items: [
        { prodIdx: 6, cantidad: 20, precio: productos[6].precioBase },
        { prodIdx: 7, cantidad: 15, precio: productos[7].precioBase },
      ],
      docType: 'T1',
      estado: 'BORRADOR'
    },
    {
      clienteIdx: 3,
      items: [
        { prodIdx: 8, cantidad: 30, precio: productos[8].precioBase },
        { prodIdx: 9, cantidad: 25, precio: productos[9].precioBase },
      ],
      docType: 'T2',
      estado: 'ACEPTADA'
    },
  ];

  const cotizacionesCreadas = [];
  let cotNum = 1;

  for (const cotData of cotizaciones) {
    const numero = `COT-2024-${String(cotNum).padStart(5, '0')}`;

    const existing = await prisma.quote.findFirst({
      where: { companyId: company.id, numero }
    });

    if (existing) {
      console.log(`  ⏭️  Cotización ya existe: ${numero}`);
      cotizacionesCreadas.push(existing);
      cotNum++;
      continue;
    }

    const subtotal = cotData.items.reduce((sum, item) => sum + (item.cantidad * item.precio), 0);
    const total = subtotal;

    const cotizacion = await prisma.quote.create({
      data: {
        numero,
        estado: cotData.estado,
        docType: cotData.docType,
        fechaEmision: new Date(),
        fechaValidez: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal,
        total,
        notas: `Cotización ${cotData.docType} de ejemplo`,
        client: {
          connect: { id: clientes[cotData.clienteIdx].id }
        },
        company: {
          connect: { id: company.id }
        },
        createdByUser: {
          connect: { id: userId }
        },
        items: {
          create: cotData.items.map(item => {
            const producto = productosCreados[item.prodIdx];
            return {
              productId: producto.id,
              descripcion: producto.name,
              cantidad: item.cantidad,
              unidad: producto.unit,
              precioUnitario: item.precio,
              subtotal: item.cantidad * item.precio,
            };
          })
        }
      }
    });

    console.log(`  ✅ Cotización creada: ${numero} (${cotData.docType}, ${cotData.estado})`);
    cotizacionesCreadas.push(cotizacion);
    cotNum++;
  }

  // ============================================
  // 5. ÓRDENES DE VENTA (de cotizaciones aprobadas)
  // ============================================
  console.log('\n🛒 Creando Órdenes de Venta...');

  const cotizacionesAprobadas = cotizacionesCreadas.filter(c => c.estado === 'ACEPTADA');
  const ordenesCreadas = [];
  let ordenNum = 1;

  for (const cot of cotizacionesAprobadas) {
    const numero = `OV-2024-${String(ordenNum).padStart(5, '0')}`;

    const existing = await prisma.sale.findFirst({
      where: { companyId: company.id, numero }
    });

    if (existing) {
      console.log(`  ⏭️  Orden ya existe: ${numero}`);
      ordenesCreadas.push(existing);
      ordenNum++;
      continue;
    }

    const cotConItems = await prisma.quote.findUnique({
      where: { id: cot.id },
      include: { items: true }
    });

    const orden = await prisma.sale.create({
      data: {
        companyId: company.id,
        numero,
        quoteId: cot.id,
        clientId: cot.clientId,
        estado: 'CONFIRMADA',
        docType: cot.docType,
        fechaEmision: new Date(),
        subtotal: cot.subtotal,
        total: cot.total,
        notas: `Orden generada desde ${cot.numero}`,
        createdBy: userId,
        items: {
          create: cotConItems!.items.map(item => ({
            productId: item.productId,
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            cantidadPendiente: item.cantidad,
            cantidadEntregada: 0,
            unidad: item.unidad,
            precioUnitario: item.precioUnitario,
            subtotal: item.subtotal,
          }))
        }
      }
    });

    console.log(`  ✅ Orden creada: ${numero} (${cot.docType})`);
    ordenesCreadas.push(orden);
    ordenNum++;
  }

  // ============================================
  // 6. ENTREGAS
  // ============================================
  console.log('\n🚚 Creando Entregas...');

  const entregasCreadas = [];
  let entregaNum = 1;

  for (const orden of ordenesCreadas.slice(0, 2)) {
    const numero = `ENT-2024-${String(entregaNum).padStart(5, '0')}`;

    const existing = await prisma.saleDelivery.findFirst({
      where: { companyId: company.id, numero }
    });

    if (existing) {
      console.log(`  ⏭️  Entrega ya existe: ${numero}`);
      entregasCreadas.push(existing);
      entregaNum++;
      continue;
    }

    const ordenConItems = await prisma.sale.findUnique({
      where: { id: orden.id },
      include: { items: true, client: true }
    });

    console.log(`  DEBUG: Orden ${orden.numero} has ${ordenConItems?.items.length} items`);
    ordenConItems?.items.forEach(item => {
      console.log(`    - Item ID: ${item.id}, ProductId: ${item.productId}`);
    });

    const entrega = await prisma.saleDelivery.create({
      data: {
        companyId: company.id,
        numero,
        saleId: orden.id,
        clientId: orden.clientId,
        estado: entregaNum === 1 ? 'ENTREGADA' : 'EN_TRANSITO',
        docType: orden.docType,
        fechaProgramada: new Date(),
        fechaEntrega: entregaNum === 1 ? new Date() : null,
        direccionEntrega: `${ordenConItems!.client.address || 'Sin dirección'}, ${ordenConItems!.client.city || ''}`,
        transportista: 'Transporte Ejemplo SA',
        vehiculo: 'ABC 123',
        conductorNombre: 'Juan Pérez',
        conductorDNI: '30123456',
        notas: `Entrega de orden ${orden.numero}`,
        createdBy: userId,
        items: {
          create: ordenConItems!.items.map(item => ({
            saleItemId: item.id,
            productId: item.productId,
            cantidad: item.cantidad,
          }))
        }
      }
    });

    // Si está entregada, actualizar cantidades en orden
    if (entregaNum === 1) {
      for (const item of ordenConItems!.items) {
        await prisma.saleItem.update({
          where: { id: item.id },
          data: { cantidadEntregada: item.cantidad }
        });
      }

      await prisma.sale.update({
        where: { id: orden.id },
        data: { estado: 'ENTREGADA' }
      });
    }

    console.log(`  ✅ Entrega creada: ${numero} (${entrega.estado}, ${orden.docType})`);
    entregasCreadas.push(entrega);
    entregaNum++;
  }

  // ============================================
  // 7. FACTURAS (solo T1)
  // ============================================
  console.log('\n🧾 Creando Facturas (T1)...');

  const ordenesT1Entregadas = ordenesCreadas.filter(o => o.docType === 'T1');
  const facturasCreadas = [];
  let facturaNum = 1;

  for (const orden of ordenesT1Entregadas.slice(0, 2)) {
    const numero = `FC-0001-${String(facturaNum).padStart(8, '0')}`;

    const existing = await prisma.salesInvoice.findFirst({
      where: { companyId: company.id, numero }
    });

    if (existing) {
      console.log(`  ⏭️  Factura ya existe: ${numero}`);
      facturasCreadas.push(existing);
      facturaNum++;
      continue;
    }

    console.log(`  DEBUG: Creating invoice for Sale ID: ${orden.id}`);

    const ordenConItems = await prisma.sale.findUnique({
      where: { id: orden.id },
      include: { items: true, client: true }
    });

    if (!ordenConItems) {
      console.log(`  ⚠️  Sale ${orden.id} not found, skipping invoice`);
      continue;
    }

    const letra = ordenConItems!.client.taxCondition === 'responsable_inscripto' ? 'A' : 'B';
    const puntoVenta = '0001';
    const numeroFactura = String(facturaNum).padStart(8, '0');
    const numeroCompleto = `${letra}-${puntoVenta}-${numeroFactura}`;

    const factura = await prisma.salesInvoice.create({
      data: {
        companyId: company.id,
        tipo: letra as any, // A or B
        letra,
        puntoVenta,
        numero: numeroFactura,
        numeroCompleto,
        saleId: orden.id,
        clientId: orden.clientId,
        estado: facturaNum === 1 ? 'COBRADA' : 'EMITIDA',
        docType: 'T1',
        fechaEmision: new Date(),
        fechaVencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        netoGravado: orden.subtotal,
        total: orden.total,
        saldoPendiente: facturaNum === 1 ? 0 : Number(orden.total),
        notas: `Factura de orden ${orden.numero}`,
        createdBy: userId,
      }
    });

    console.log(`  ✅ Factura creada: ${numero} (${factura.estado})`);
    facturasCreadas.push(factura);
    facturaNum++;
  }

  // ============================================
  // 8. PAGOS/COBRANZAS (COMENTADO - tabla client_payments no existe)
  // ============================================
  console.log('\n💵 Pagos - SALTADO (tabla no existe en DB)');

  /* COMENTADO - tabla client_payments no existe en DB
  const facturaCobrada = facturasCreadas.find(f => f.estado === 'COBRADA');
  if (facturaCobrada) {
    const numero = `PAG-2024-00001`;

    const existing = await prisma.clientPayment.findFirst({
      where: { companyId: company.id, numero }
    });

    if (!existing) {
      const pago = await prisma.clientPayment.create({
        data: {
          numero,
          fechaPago: new Date(),
          totalPago: Number(facturaCobrada.total),
          transferencia: Number(facturaCobrada.total),
          estado: 'CONFIRMADO',
          docType: 'T1',
          notas: 'Pago de factura de ejemplo',
          client: {
            connect: { id: facturaCobrada.clientId }
          },
          company: {
            connect: { id: company.id }
          },
          createdByUser: {
            connect: { id: userId }
          },
          allocations: {
            create: {
              invoiceId: facturaCobrada.id,
              montoAplicado: Number(facturaCobrada.total),
            }
          }
        }
      });
      console.log(`  ✅ Pago creado: ${numero}`);
    } else {
      console.log(`  ⏭️  Pago ya existe: ${numero}`);
    }
  }
  */

  // ============================================
  // 9. RMAs (POSTVENTA)
  // ============================================
  console.log('\n🔄 Creando RMAs...');

  if (ordenesCreadas.length > 0) {
    const numero = `RMA-2024-00001`;

    const existing = await prisma.saleRMA.findFirst({
      where: { companyId: company.id, numero }
    });

    if (!existing) {
      const orden = ordenesCreadas[0];
      const ordenConItems = await prisma.sale.findUnique({
        where: { id: orden.id },
        include: { items: true }
      });

      const rma = await prisma.saleRMA.create({
        data: {
          companyId: company.id,
          numero,
          clientId: orden.clientId,
          saleId: orden.id,
          tipo: 'DEVOLUCION',
          estado: 'APROBADO',
          categoriaMotivo: 'DEFECTO_FABRICACION',
          motivo: 'Producto defectuoso',
          docType: orden.docType,
          fechaSolicitud: new Date(),
          fechaAprobacion: new Date(),
          solicitadoPor: userId,
          aprobadoPor: userId,
          items: {
            create: ordenConItems!.items.slice(0, 1).map(item => ({
              saleItemId: item.id,
              productId: item.productId,
              cantidad: 1,
              motivoDetalle: 'Material defectuoso',
            }))
          }
        }
      });

      await prisma.saleRMAHistory.create({
        data: {
          rmaId: rma.id,
          estadoAnterior: 'SOLICITADO',
          estadoNuevo: 'APROBADO',
          userId: userId,
          notas: 'RMA aprobado automáticamente para ejemplo',
        }
      });

      console.log(`  ✅ RMA creado: ${numero}`);
    } else {
      console.log(`  ⏭️  RMA ya existe: ${numero}`);
    }
  }

  // ============================================
  // 10. ACOPIO (MERCADERÍA PENDIENTE) - COMENTADO
  // ============================================
  console.log('\n📦 Acopio - SALTADO (tablas no existen en DB)');

  /* COMENTADO - tablas saleAcopio, client_payments no existen
  // Get sales config
  const salesConfig = await prisma.salesConfig.findFirst({
    where: { companyId: company.id },
    select: {
      diasVencimientoAcopioDefault: true,
      diasAlertaAcopioDefault: true,
    }
  });

  if (!salesConfig) {
    console.log('  ⚠️  No hay configuración de ventas, saltando Acopio');
  } else {
    // Cliente que paga mercadería y la deja almacenada
    const clienteAcopio = clientes[0]; // Cliente Excelente SA

    // Crear un pago que será la base del acopio
    const numeroPagoAcopio = `PAG-2024-00002`;
    const existingPagoAcopio = await prisma.clientPayment.findFirst({
      where: { companyId: company.id, numero: numeroPagoAcopio }
    });

    let pagoAcopio;
    if (!existingPagoAcopio) {
      pagoAcopio = await prisma.clientPayment.create({
        data: {
          numero: numeroPagoAcopio,
          fechaPago: new Date(),
          totalPago: 500000,
          transferencia: 500000,
          estado: 'CONFIRMADO',
          docType: 'T1',
          notas: 'Pago anticipado para mercadería en acopio',
          client: {
            connect: { id: clienteAcopio.id }
          },
          company: {
            connect: { id: company.id }
          },
          createdByUser: {
            connect: { id: userId }
          },
        }
      });
      console.log(`  ✅ Pago para acopio creado: ${numeroPagoAcopio}`);
    } else {
      pagoAcopio = existingPagoAcopio;
      console.log(`  ⏭️  Pago para acopio ya existe: ${numeroPagoAcopio}`);
    }

    // Crear Acopio ACTIVO
    const numeroAcopio1 = `ACO-2024-00001`;
    const existingAcopio1 = await prisma.saleAcopio.findFirst({
      where: { companyId: company.id, numero: numeroAcopio1 }
    });

    if (!existingAcopio1) {
      const fechaIngreso = new Date();
      const diasVencimiento = salesConfig.diasVencimientoAcopioDefault || 90;
      const fechaVencimiento = new Date();
      fechaVencimiento.setDate(fechaVencimiento.getDate() + diasVencimiento);

      const acopio1 = await prisma.saleAcopio.create({
        data: {
          companyId: company.id,
          numero: numeroAcopio1,
          clientId: clienteAcopio.id,
          saleId: ordenesCreadas[0].id,
          paymentId: pagoAcopio.id,
          estado: 'ACTIVO',
          fechaIngreso,
          fechaVencimiento,
          diasVencimiento,
          valorTotal: 500000,
          valorPendiente: 500000,
          observaciones: 'Cliente pagó mercadería y la deja almacenada para retiro gradual',
          alertaEnviada: false,
          docType: 'T1',
          createdBy: userId,
          items: {
            create: [
              {
                productId: productosCreados[0].id,
                cantidadIngresada: 100,
                cantidadRetirada: 0,
                cantidadPendiente: 100,
                precioUnitario: 8500,
                subtotal: 850000,
              },
              {
                productId: productosCreados[3].id,
                cantidadIngresada: 50,
                cantidadRetirada: 0,
                cantidadPendiente: 50,
                precioUnitario: 12000,
                subtotal: 600000,
              }
            ]
          }
        }
      });

      // Actualizar acopioActual del cliente
      await prisma.client.update({
        where: { id: clienteAcopio.id },
        data: { acopioActual: 500000 }
      });

      console.log(`  ✅ Acopio creado: ${numeroAcopio1} (ACTIVO, vence en ${diasVencimiento} días)`);
    } else {
      console.log(`  ⏭️  Acopio ya existe: ${numeroAcopio1}`);
    }

    // Crear Acopio PARCIAL (con retiros)
    const numeroAcopio2 = `ACO-2024-00002`;
    const existingAcopio2 = await prisma.saleAcopio.findFirst({
      where: { companyId: company.id, numero: numeroAcopio2 }
    });

    if (!existingAcopio2) {
      const fechaIngreso = new Date();
      fechaIngreso.setDate(fechaIngreso.getDate() - 30); // Hace 30 días
      const diasVencimiento = salesConfig.diasVencimientoAcopioDefault || 90;
      const fechaVencimiento = new Date(fechaIngreso);
      fechaVencimiento.setDate(fechaVencimiento.getDate() + diasVencimiento);

      const acopio2 = await prisma.saleAcopio.create({
        data: {
          companyId: company.id,
          numero: numeroAcopio2,
          clientId: clientes[1].id,
          saleId: ordenesCreadas[0].id,
          estado: 'PARCIAL',
          fechaIngreso,
          fechaVencimiento,
          diasVencimiento,
          valorTotal: 300000,
          valorPendiente: 150000,
          observaciones: 'Cliente retiró 50% de la mercadería',
          alertaEnviada: false,
          docType: 'T1',
          createdBy: userId,
          items: {
            create: [
              {
                productId: productosCreados[1].id,
                cantidadIngresada: 20,
                cantidadRetirada: 10,
                cantidadPendiente: 10,
                precioUnitario: 15000,
                subtotal: 300000,
              }
            ]
          }
        }
      });

      // Crear retiro parcial
      const retiro = await prisma.acopioRetiro.create({
        data: {
          companyId: company.id,
          numero: `RET-2024-00001`,
          acopioId: acopio2.id,
          fechaRetiro: new Date(fechaIngreso.getTime() + 15 * 24 * 60 * 60 * 1000), // 15 días después
          docType: 'T1',
          observaciones: 'Primer retiro parcial',
          createdBy: userId,
          items: {
            create: [
              {
                acopioItemId: (await prisma.saleAcopioItem.findFirst({ where: { acopioId: acopio2.id } }))!.id,
                productId: productosCreados[1].id,
                cantidadRetirada: 10,
                precioUnitario: 15000,
                subtotal: 150000,
              }
            ]
          }
        }
      });

      console.log(`  ✅ Acopio creado: ${numeroAcopio2} (PARCIAL, con retiro ${retiro.numero})`);
    } else {
      console.log(`  ⏭️  Acopio ya existe: ${numeroAcopio2}`);
    }

    // Crear Acopio próximo a vencer (alerta)
    const numeroAcopio3 = `ACO-2024-00003`;
    const existingAcopio3 = await prisma.saleAcopio.findFirst({
      where: { companyId: company.id, numero: numeroAcopio3 }
    });

    if (!existingAcopio3) {
      const fechaIngreso = new Date();
      const diasVencimiento = salesConfig.diasVencimientoAcopioDefault || 90;
      fechaIngreso.setDate(fechaIngreso.getDate() - (diasVencimiento - 20)); // Vence en 20 días
      const fechaVencimiento = new Date(fechaIngreso);
      fechaVencimiento.setDate(fechaVencimiento.getDate() + diasVencimiento);

      const acopio3 = await prisma.saleAcopio.create({
        data: {
          companyId: company.id,
          numero: numeroAcopio3,
          clientId: clientes[2].id,
          saleId: ordenesCreadas[0].id,
          estado: 'ACTIVO',
          fechaIngreso,
          fechaVencimiento,
          diasVencimiento,
          valorTotal: 200000,
          valorPendiente: 200000,
          observaciones: 'Acopio próximo a vencer - alerta pendiente',
          alertaEnviada: true,
          docType: 'T1',
          createdBy: userId,
          items: {
            create: [
              {
                productId: productosCreados[2].id,
                cantidadIngresada: 8,
                cantidadRetirada: 0,
                cantidadPendiente: 8,
                precioUnitario: 25000,
                subtotal: 200000,
              }
            ]
          }
        }
      });

      console.log(`  ✅ Acopio creado: ${numeroAcopio3} (ACTIVO, alerta enviada, vence en ~20 días)`);
    } else {
      console.log(`  ⏭️  Acopio ya existe: ${numeroAcopio3}`);
    }
  }
  */

  // ============================================
  // 11. FACTURAS DE CRÉDITO/DÉBITO (FCAs) - COMENTADO
  // ============================================
  console.log('\n📝 NC/ND - SALTADO (tabla creditNote puede no existir)');

  /* COMENTADO - tabla creditNote puede no existir


  if (facturasCreadas.length > 0) {
    // Nota de Crédito (devolución parcial)
    const numeroNC = `NC-0001-00000001`;
    const existingNC = await prisma.creditNote.findFirst({
      where: { companyId: company.id, numero: numeroNC }
    });

    if (!existingNC) {
      const facturaOriginal = facturasCreadas[0];
      const notaCredito = await prisma.creditNote.create({
        data: {
          companyId: company.id,
          numero: numeroNC,
          tipo: 'NOTA_CREDITO',
          invoiceId: facturaOriginal.id,
          clientId: facturaOriginal.clientId,
          saleId: facturaOriginal.saleId,
          motivo: 'DEVOLUCION_PARCIAL',
          motivoDetalle: 'Devolución de producto defectuoso',
          docType: facturaOriginal.docType,
          fechaEmision: new Date(),
          subtotal: 50000,
          impuestos: 10500,
          total: 60500,
          estado: 'APLICADA',
          observaciones: 'Nota de crédito por devolución parcial',
          createdBy: userId,
        }
      });

      // Actualizar saldo de factura
      await prisma.salesInvoice.update({
        where: { id: facturaOriginal.id },
        data: {
          saldo: { decrement: 60500 },
        }
      });

      console.log(`  ✅ Nota de Crédito creada: ${numeroNC}`);
    } else {
      console.log(`  ⏭️  Nota de Crédito ya existe: ${numeroNC}`);
    }

    // Nota de Débito (interés por mora)
    const numeroND = `ND-0001-00000001`;
    const existingND = await prisma.creditNote.findFirst({
      where: { companyId: company.id, numero: numeroND }
    });

    if (!existingND && facturasCreadas.length > 1) {
      const facturaOriginal = facturasCreadas[1];
      const notaDebito = await prisma.creditNote.create({
        data: {
          companyId: company.id,
          numero: numeroND,
          tipo: 'NOTA_DEBITO',
          invoiceId: facturaOriginal.id,
          clientId: facturaOriginal.clientId,
          saleId: facturaOriginal.saleId,
          motivo: 'INTERES_MORA',
          motivoDetalle: 'Interés por pago fuera de término',
          docType: facturaOriginal.docType,
          fechaEmision: new Date(),
          subtotal: 15000,
          impuestos: 3150,
          total: 18150,
          estado: 'APLICADA',
          observaciones: 'Interés 3% por pago fuera de término',
          createdBy: userId,
        }
      });

      // Actualizar saldo de factura
      await prisma.salesInvoice.update({
        where: { id: facturaOriginal.id },
        data: {
          saldo: { increment: 18150 },
        }
      });

      console.log(`  ✅ Nota de Débito creada: ${numeroND}`);
    } else {
      console.log(`  ⏭️  Nota de Débito ya existe o no hay facturas: ${numeroND}`);
    }
  }
  */

  // ============================================
  // 12. MÁS FACTURAS PENDIENTES DE PAGO - COMENTADO
  // ============================================
  console.log('\n🧾 Más Facturas - SALTADO (dependen de órdenes T1)');

  /* COMENTADO - depende de órdenes T1 entregadas

  if (ordenesT1Entregadas.length > 2) {
    for (let i = 2; i < Math.min(ordenesT1Entregadas.length, 4); i++) {
      const orden = ordenesT1Entregadas[i];
      const numero = `FC-0001-${String(i + 1).padStart(8, '0')}`;

      const existing = await prisma.salesInvoice.findFirst({
        where: { companyId: company.id, numero }
      });

      if (existing) {
        console.log(`  ⏭️  Factura ya existe: ${numero}`);
        continue;
      }

      const ordenConItems = await prisma.sale.findUnique({
        where: { id: orden.id },
        include: { items: true, client: true }
      });

      // Crear facturas con diferentes estados
      const estados = ['EMITIDA', 'PARCIALMENTE_COBRADA', 'VENCIDA'];
      const estado = estados[i % 3];
      const saldo = estado === 'PARCIALMENTE_COBRADA' ? Number(orden.total) * 0.6 : Number(orden.total);

      const factura = await prisma.salesInvoice.create({
        data: {
          companyId: company.id,
          numero,
          saleId: orden.id,
          clientId: orden.clientId,
          tipo: ordenConItems!.client.taxCondition === 'responsable_inscripto' ? 'FACTURA_A' : 'FACTURA_B',
          estado,
          docType: 'T1',
          fechaEmision: new Date(Date.now() - (i * 15 * 24 * 60 * 60 * 1000)), // Hace 15, 30, 45 días
          fechaVencimiento: new Date(Date.now() + ((10 - i * 5) * 24 * 60 * 60 * 1000)), // Vencen en 10, 5, 0 días
          subtotal: orden.subtotal,
          total: orden.total,
          saldo,
          observaciones: `Factura ${estado.toLowerCase()} de orden ${orden.numero}`,
          createdBy: userId,
        }
      });

      console.log(`  ✅ Factura creada: ${numero} (${estado}, saldo: $${saldo})`);
    }
  }
  */

  // ============================================
  // 13. METAS - COMENTADO
  // ============================================
  console.log('\n🎯 Metas - SALTADO (tabla sales_goals no existe)');

  /* COMENTADO - tabla sales_goals no existe

  const metas = [
    {
      nombre: 'Meta Mensual Ventas - Diciembre 2024',
      tipo: 'VENTAS_MONTO',
      nivel: 'EMPRESA',
      periodo: 'MENSUAL',
      metaValor: 5000000,
      fechaInicio: new Date('2024-12-01'),
      fechaFin: new Date('2024-12-31'),
      tieneIncentivo: true,
      incentivoPorcentaje: 5,
    },
    {
      nombre: 'Meta Anual Clientes Nuevos 2024',
      tipo: 'CLIENTES_NUEVOS',
      nivel: 'EMPRESA',
      periodo: 'ANUAL',
      metaValor: 50,
      fechaInicio: new Date('2024-01-01'),
      fechaFin: new Date('2024-12-31'),
      tieneIncentivo: false,
    },
    {
      nombre: 'Meta Trimestral Margen Q4',
      tipo: 'MARGEN',
      nivel: 'EMPRESA',
      periodo: 'TRIMESTRAL',
      metaValor: 25,
      fechaInicio: new Date('2024-10-01'),
      fechaFin: new Date('2024-12-31'),
      tieneIncentivo: true,
      incentivoPorcentaje: 10,
    },
  ];

  for (const metaData of metas) {
    const existing = await prisma.salesGoal.findFirst({
      where: { companyId: company.id, nombre: metaData.nombre }
    });

    if (!existing) {
      const meta = await prisma.salesGoal.create({
        data: {
          ...metaData,
          companyId: company.id,
          isActive: true,
          isClosed: false,
          createdBy: userId,
        }
      });

      // Agregar progreso de ejemplo
      const valorAlcanzado = metaData.metaValor * 0.65;
      await prisma.salesGoalProgress.create({
        data: {
          goalId: meta.id,
          fecha: new Date(),
          valorAlcanzado,
          porcentajeCumplimiento: 65,
          cantidadVentas: 45,
          montoVentas: valorAlcanzado,
        }
      });

      console.log(`  ✅ Meta creada: ${metaData.nombre} (65% cumplimiento)`);
    } else {
      console.log(`  ⏭️  Meta ya existe: ${metaData.nombre}`);
    }
  }
  */

  // ============================================
  // RESUMEN FINAL
  // ============================================
  console.log('\n\n📊 RESUMEN DE DATOS CREADOS:');
  console.log('================================');

  const stats = {
    productos: await prisma.product.count({ where: { companyId: company.id } }),
    clientes: await prisma.client.count({ where: { companyId: company.id } }),
    listas: await prisma.salesPriceList.count({ where: { companyId: company.id } }),
    cotizaciones: await prisma.quote.count({ where: { companyId: company.id } }),
    // ordenes: await prisma.sale.count({ where: { companyId: company.id } }),
    // entregas: await prisma.saleDelivery.count({ where: { companyId: company.id } }),
    // facturas: await prisma.salesInvoice.count({ where: { companyId: company.id } }),
    // Tables that don't exist in DB:
    // pagos: await prisma.clientPayment.count({ where: { companyId: company.id } }),
    // acopio: await prisma.saleAcopio.count({ where: { companyId: company.id } }),
    // retiros: await prisma.acopioRetiro.count({ where: { companyId: company.id } }),
    // creditNotes: await prisma.creditNote.count({ where: { companyId: company.id } }),
    // rmas: await prisma.saleRMA.count({ where: { companyId: company.id } }),
    // metas: await prisma.salesGoal.count({ where: { companyId: company.id } }),
  };

  console.log(`📦 Productos:      ${stats.productos}`);
  console.log(`👥 Clientes:       ${stats.clientes}`);
  console.log(`💰 Listas Precios: ${stats.listas}`);
  console.log(`📝 Cotizaciones:   ${stats.cotizaciones}`);
  // console.log(`🛒 Órdenes:        ${stats.ordenes}`);
  // console.log(`🚚 Entregas:       ${stats.entregas}`);
  // console.log(`🧾 Facturas:       ${stats.facturas}`);
  console.log(`\n⚠️  Las siguientes tablas no existen en la base de datos:`);
  console.log(`   - sales_orders, sales_deliveries, invoices`);
  console.log(`   - client_payments, sale_acopio, acopio_retiro`);
  console.log(`   - credit_notes, sales_goals, sale_rma`);

  /* COMENTADO - tablas no existen en DB
  console.log('\n✨ Datos T1 (Formal - con facturación)');
  const t1Orders = await prisma.sale.count({ where: { companyId: company.id, docType: 'T1' } });
  const t1Invoices = await prisma.salesInvoice.count({ where: { companyId: company.id, docType: 'T1' } });
  console.log(`   Órdenes T1: ${t1Orders}`);
  console.log(`   Facturas T1: ${t1Invoices}`);

  console.log('\n✨ Datos T2 (Informal - sin facturación)');
  const t2Orders = await prisma.sale.count({ where: { companyId: company.id, docType: 'T2' } });
  console.log(`   Órdenes T2: ${t2Orders}`);

  console.log('\n📦 Acopio (Mercadería Pendiente)');
  const acopioActivo = await prisma.saleAcopio.count({ where: { companyId: company.id, estado: 'ACTIVO' } });
  const acopioParcial = await prisma.saleAcopio.count({ where: { companyId: company.id, estado: 'PARCIAL' } });
  console.log(`   ACTIVO: ${acopioActivo}`);
  console.log(`   PARCIAL: ${acopioParcial}`);

  console.log('\n📋 Facturas Pendientes');
  const facturasEmitidas = await prisma.salesInvoice.count({ where: { companyId: company.id, estado: 'EMITIDA' } });
  const facturasParciales = await prisma.salesInvoice.count({ where: { companyId: company.id, estado: 'PARCIALMENTE_COBRADA' } });
  const facturasVencidas = await prisma.salesInvoice.count({ where: { companyId: company.id, estado: 'VENCIDA' } });
  console.log(`   EMITIDA: ${facturasEmitidas}`);
  console.log(`   PARCIALMENTE_COBRADA: ${facturasParciales}`);
  console.log(`   VENCIDA: ${facturasVencidas}`);

  console.log('\n📝 Notas de Crédito/Débito');
  const notasCredito = await prisma.creditNote.count({ where: { companyId: company.id, tipo: 'NOTA_CREDITO' } });
  const notasDebito = await prisma.creditNote.count({ where: { companyId: company.id, tipo: 'NOTA_DEBITO' } });
  console.log(`   Notas de Crédito: ${notasCredito}`);
  console.log(`   Notas de Débito: ${notasDebito}`);
  */

  console.log('\n🎉 Seed completo exitoso!\n');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
