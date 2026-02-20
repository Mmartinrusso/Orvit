/**
 * Seed: Facturas con ítems para Costos → Ventas (mes actual)
 * Ejecutar: npx tsx prisma/seed-costos-ventas.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function uid() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).substring(2, 8)}`;
}

async function main() {
  console.log('🚀 Seed: facturas de ventas con ítems para Costos...\n');

  const company = await prisma.company.findFirst();
  if (!company) throw new Error('No hay company. Ejecutar seed principal primero.');
  console.log(`✅ Company: ${company.name} (ID: ${company.id})`);

  const vendedor = await prisma.user.findFirst({
    where: { companies: { some: { companyId: company.id } } }
  });
  if (!vendedor) throw new Error('No hay usuarios.');
  console.log(`✅ Vendedor: ${vendedor.name}`);

  // Obtener o crear categoría
  let cat = await prisma.category.findFirst({ where: { companyId: company.id } });
  if (!cat) {
    cat = await prisma.category.create({
      data: { name: 'General', companyId: company.id, createdById: vendedor.id }
    });
  }

  // Clientes
  const clientesData = [
    { name: 'Dist. Norte Test', legalName: 'Distribuidora Norte Test SA', email: `dnorte-${Date.now()}@seed.test`, creditLimit: 500000 },
    { name: 'Com. Sur Test',    legalName: 'Comercial Sur Test SRL',       email: `csur-${Date.now()}@seed.test`,   creditLimit: 300000 },
    { name: 'May. Centro Test', legalName: 'Mayorista Centro Test SA',     email: `mcentro-${Date.now()}@seed.test`, creditLimit: 800000 },
  ];

  const clientes: any[] = [];
  for (const c of clientesData) {
    const nuevo = await prisma.client.create({
      data: { id: uid(), ...c, companyId: company.id, taxCondition: 'responsable_inscripto', isActive: true, postalCode: '1000' }
    });
    clientes.push(nuevo);
    console.log(`  ✅ Cliente: ${nuevo.legalName}`);
  }

  // Productos
  const productosData = [
    { name: 'Aceite Girasol 1.5L',  code: `SEED-ACE-${Date.now()}`, costPrice: 1800, precio: 2520 },
    { name: 'Arroz Largo Fino 1kg', code: `SEED-ARR-${Date.now()}`, costPrice: 850,  precio: 1190 },
    { name: 'Fideos 500g',          code: `SEED-FID-${Date.now()}`, costPrice: 550,  precio: 770  },
    { name: 'Harina 000 1kg',       code: `SEED-HAR-${Date.now()}`, costPrice: 400,  precio: 560  },
    { name: 'Yerba Mate 1kg',       code: `SEED-YER-${Date.now()}`, costPrice: 2500, precio: 3500 },
  ];

  const prods: any[] = [];
  for (const p of productosData) {
    const nuevo = await prisma.product.create({
      data: {
        id: uid(), name: p.name, code: p.code, description: p.name,
        costPrice: p.costPrice, unit: 'UN', minStock: 10, currentStock: 100,
        volume: 0, weight: 0, location: 'A1',
        companyId: company.id, categoryId: cat.id, createdById: vendedor.id, isActive: true,
      }
    });
    prods.push({ ...nuevo, precio: p.precio });
  }
  console.log(`  ✅ ${prods.length} productos creados\n`);

  // Facturas del mes actual con ítems
  const ahora = new Date();
  const year = ahora.getFullYear();
  const month = ahora.getMonth(); // 0-indexed

  const escenarios = [
    { cli: 0, dias: 2,  items: [0, 2, 4], cant: [20, 15, 10], estado: 'EMITIDA'               },
    { cli: 1, dias: 5,  items: [1, 3],    cant: [30, 25],     estado: 'EMITIDA'               },
    { cli: 2, dias: 8,  items: [0, 1, 3], cant: [50, 40, 20], estado: 'COBRADA'               },
    { cli: 0, dias: 10, items: [2, 4],    cant: [15, 8],      estado: 'EMITIDA'               },
    { cli: 1, dias: 12, items: [0, 2],    cant: [25, 20],     estado: 'COBRADA'               },
    { cli: 2, dias: 15, items: [1, 3, 4], cant: [60, 30, 12], estado: 'PARCIALMENTE_COBRADA'  },
    { cli: 0, dias: 17, items: [0, 1, 2], cant: [10, 20, 15], estado: 'EMITIDA'               },
  ];

  const base = Date.now();
  console.log('📄 Creando facturas con ítems...');

  for (let i = 0; i < escenarios.length; i++) {
    const esc = escenarios[i];
    const fecha = new Date(year, month, esc.dias);
    const cliente = clientes[esc.cli];

    const itemsCalc = esc.items.map((pi, idx) => {
      const p = prods[pi];
      const cantidad = esc.cant[idx];
      const subtotal = cantidad * p.precio;
      return { p, cantidad, precioUnitario: p.precio, subtotal };
    });

    const netoGravado = itemsCalc.reduce((s, it) => s + it.subtotal, 0);
    const iva21 = Math.round(netoGravado * 0.21);
    const total = netoGravado + iva21;
    const saldoPendiente = esc.estado === 'COBRADA' ? 0
      : esc.estado === 'PARCIALMENTE_COBRADA' ? Math.round(total * 0.4)
      : total;

    const numero = String(base + i).slice(-8).padStart(8, '0');
    const numeroCompleto = `A-00001-${numero}`;

    const factura = await prisma.salesInvoice.create({
      data: {
        tipo: 'A', letra: 'A', puntoVenta: '00001',
        numero, numeroCompleto,
        clientId: cliente.id,
        estado: esc.estado as any,
        fechaEmision: fecha,
        fechaVencimiento: new Date(fecha.getTime() + 30 * 86400000),
        netoGravado, iva21, total, saldoPendiente,
        docType: 'T1',
        companyId: company.id,
        createdBy: vendedor.id,
        items: {
          create: itemsCalc.map(it => ({
            productId: it.p.id,
            codigo: it.p.code,
            descripcion: it.p.name,
            cantidad: it.cantidad,
            unidad: 'UN',
            precioUnitario: it.precioUnitario,
            descuento: 0,
            alicuotaIVA: 21,
            subtotal: it.subtotal,
          }))
        }
      }
    });

    console.log(`  ✅ ${factura.numeroCompleto} | ${cliente.legalName} | $${total.toLocaleString('es-AR')} | ${esc.estado}`);
  }

  console.log('\n🎉 Seed completado. Abrí Costos → Ventas para ver los datos.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
