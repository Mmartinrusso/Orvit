/**
 * Seed de Órdenes de Compra para pruebas
 *
 * Este script crea órdenes de compra de prueba con items para testing.
 * Incluye OC en diferentes estados: BORRADOR, APROBADA, ENVIADA_PROVEEDOR, CONFIRMADA
 *
 * Ejecutar: npx ts-node prisma/seed-ordenes-compra.ts
 */

import { PrismaClient, PurchaseOrderStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Items de ejemplo para compras
const ITEMS_CATALOGO = [
  { nombre: 'Aceite lubricante 20W-50', unidad: 'LT', precio: 8500 },
  { nombre: 'Filtro de aire industrial', unidad: 'UN', precio: 15000 },
  { nombre: 'Rodamiento 6205-2RS', unidad: 'UN', precio: 4500 },
  { nombre: 'Correa dentada HTD 5M', unidad: 'MT', precio: 3200 },
  { nombre: 'Grasa multipropósito EP2', unidad: 'KG', precio: 6800 },
  { nombre: 'Tornillo M10x40 inox', unidad: 'UN', precio: 120 },
  { nombre: 'Arandela plana M10 inox', unidad: 'UN', precio: 25 },
  { nombre: 'Tuerca M10 inox', unidad: 'UN', precio: 35 },
  { nombre: 'Manguera hidráulica 3/4"', unidad: 'MT', precio: 12500 },
  { nombre: 'Sello mecánico 25mm', unidad: 'UN', precio: 28000 },
  { nombre: 'Válvula check 1"', unidad: 'UN', precio: 18500 },
  { nombre: 'Empaque NBR DN50', unidad: 'UN', precio: 850 },
];

async function seedOrdenesCompra() {
  console.log('🛒 Iniciando seed de Órdenes de Compra...\n');

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

    // 2. Obtener o crear proveedores de prueba
    const proveedores = await getOrCreateProveedores(company.id);
    console.log(`✅ Proveedores disponibles: ${proveedores.length}\n`);

    if (proveedores.length === 0) {
      console.log('⚠️  No hay proveedores. Creando proveedores de prueba...');
      return;
    }

    // 3. Obtener o crear SupplierItems para cada proveedor
    for (const proveedor of proveedores) {
      await getOrCreateSupplierItems(proveedor.id, company.id);
    }
    console.log('✅ Items de proveedores verificados/creados\n');

    // 4. Obtener usuario para createdBy
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

    // 5. Crear órdenes de compra de prueba
    const ordenesCreadas = await crearOrdenesCompra(company.id, proveedores, user.id);

    console.log('\n' + '='.repeat(60));
    console.log('🎉 Seed completado!');
    console.log(`   - Órdenes creadas: ${ordenesCreadas}`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error durante el seed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function getOrCreateProveedores(companyId: number) {
  // Buscar proveedores existentes
  let proveedores = await prisma.suppliers.findMany({
    where: { company_id: companyId },
    take: 3,
    select: { id: true, name: true }
  });

  // Si no hay suficientes, crear algunos de prueba
  if (proveedores.length < 2) {
    const proveedoresPrueba = [
      { name: 'Ferretería Industrial SRL', cuit: '30-71234567-0', email: 'ventas@ferreteria.com', telefono: '011-4555-1234' },
      { name: 'Suministros Técnicos SA', cuit: '30-71234568-1', email: 'contacto@suministros.com', telefono: '011-4555-5678' },
      { name: 'Repuestos del Sur', cuit: '20-28765432-9', email: 'info@repuestosdelsur.com', telefono: '011-4555-9999' },
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
            phone: prov.telefono,
            company_id: companyId,
            active: true,
          }
        });
        console.log(`   + Proveedor creado: ${prov.name}`);
      }
    }

    // Recargar proveedores
    proveedores = await prisma.suppliers.findMany({
      where: { company_id: companyId },
      take: 3,
      select: { id: true, name: true }
    });
  }

  return proveedores;
}

async function getOrCreateSupplierItems(proveedorId: number, companyId: number) {
  // Verificar si ya tiene items
  const itemsExistentes = await prisma.supplierItem.count({
    where: { supplierId: proveedorId, companyId }
  });

  if (itemsExistentes >= 5) {
    return; // Ya tiene suficientes items
  }

  // Crear supplies si no existen
  for (const item of ITEMS_CATALOGO) {
    // Verificar si existe el supply
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

    // Verificar si existe el supplierItem
    const supplierItemExiste = await prisma.supplierItem.findFirst({
      where: {
        supplierId: proveedorId,
        supplyId: supply.id,
        companyId
      }
    });

    if (!supplierItemExiste) {
      // Precio con variación aleatoria por proveedor
      const precioVariado = item.precio * (0.9 + Math.random() * 0.2);

      await prisma.supplierItem.create({
        data: {
          supplierId: proveedorId,
          supplyId: supply.id,
          nombre: item.nombre,
          unidad: item.unidad,
          precioUnitario: precioVariado,
          activo: true,
          companyId,
        }
      });
    }
  }
}

async function crearOrdenesCompra(
  companyId: number,
  proveedores: { id: number; name: string }[],
  userId: number
): Promise<number> {
  let ordenesCreadas = 0;

  // Verificar si ya hay órdenes de compra
  const ordenesExistentes = await prisma.purchaseOrder.count({
    where: { companyId }
  });

  if (ordenesExistentes > 5) {
    console.log(`ℹ️  Ya existen ${ordenesExistentes} órdenes. Omitiendo creación.`);
    return 0;
  }

  // Órdenes a crear con diferentes estados
  const ordenesConfig = [
    { provIndex: 0, estado: 'BORRADOR' as PurchaseOrderStatus, itemsCount: 3, dias: -5 },
    { provIndex: 0, estado: 'APROBADA' as PurchaseOrderStatus, itemsCount: 4, dias: -10 },
    { provIndex: 1, estado: 'ENVIADA_PROVEEDOR' as PurchaseOrderStatus, itemsCount: 2, dias: -7 },
    { provIndex: 1, estado: 'CONFIRMADA' as PurchaseOrderStatus, itemsCount: 5, dias: -15 },
    { provIndex: 2 % proveedores.length, estado: 'BORRADOR' as PurchaseOrderStatus, itemsCount: 2, dias: -1, esEmergencia: true },
  ];

  for (const config of ordenesConfig) {
    const proveedor = proveedores[config.provIndex];
    if (!proveedor) continue;

    // Obtener items del proveedor
    const supplierItems = await prisma.supplierItem.findMany({
      where: { supplierId: proveedor.id, companyId, activo: true },
      take: config.itemsCount,
    });

    if (supplierItems.length === 0) {
      console.log(`⚠️  Proveedor ${proveedor.name} no tiene items. Saltando...`);
      continue;
    }

    // Calcular subtotal
    let subtotal = 0;
    const itemsData = supplierItems.map((item, index) => {
      const cantidad = Math.floor(Math.random() * 10) + 1;
      const precioUnitario = Number(item.precioUnitario) || 1000;
      const itemSubtotal = cantidad * precioUnitario;
      subtotal += itemSubtotal;

      return {
        supplierItemId: item.id,
        descripcion: item.nombre,
        cantidad,
        cantidadRecibida: 0,
        cantidadPendiente: cantidad,
        unidad: item.unidad || 'UN',
        precioUnitario,
        descuento: 0,
        subtotal: itemSubtotal,
      };
    });

    const impuestos = subtotal * 0.21;
    const total = subtotal + impuestos;

    // Generar número único
    const año = new Date().getFullYear();
    const count = await prisma.purchaseOrder.count({ where: { companyId } });
    const numero = `OC-${año}-${String(count + 1).padStart(5, '0')}`;

    const fechaEmision = new Date();
    fechaEmision.setDate(fechaEmision.getDate() + config.dias);

    const fechaEntrega = new Date(fechaEmision);
    fechaEntrega.setDate(fechaEntrega.getDate() + 7);

    try {
      await prisma.$transaction(async (tx) => {
        const orden = await tx.purchaseOrder.create({
          data: {
            numero,
            proveedorId: proveedor.id,
            estado: config.estado,
            fechaEmision,
            fechaEntregaEsperada: fechaEntrega,
            condicionesPago: 'Contado',
            moneda: 'ARS',
            subtotal,
            impuestos,
            total,
            notas: `Orden de prueba - ${config.estado}`,
            esEmergencia: config.esEmergencia || false,
            motivoEmergencia: config.esEmergencia ? 'Urgencia operativa' : null,
            requiereAprobacion: false,
            companyId,
            createdBy: userId,
          }
        });

        await tx.purchaseOrderItem.createMany({
          data: itemsData.map(item => ({
            purchaseOrderId: orden.id,
            ...item,
          }))
        });

        console.log(`   ✅ ${numero} - ${proveedor.name} - ${config.estado} - $${total.toFixed(2)}`);
      });

      ordenesCreadas++;
    } catch (err) {
      console.error(`   ❌ Error creando orden para ${proveedor.name}:`, err);
    }
  }

  return ordenesCreadas;
}

// Ejecutar seed
seedOrdenesCompra()
  .then(() => {
    console.log('✨ Proceso finalizado con éxito');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Proceso finalizado con errores:', error);
    process.exit(1);
  });
