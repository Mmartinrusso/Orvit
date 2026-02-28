import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/seed-ventas
 * Crea facturas de prueba con ítems para el mes actual.
 * Solo para desarrollo o SUPERADMIN.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    const { user, error } = await requireAuth();
    if (error) return error;
    if (user!.role.toUpperCase() !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Solo SUPERADMIN puede ejecutar seeds en producción' }, { status: 403 });
    }
  }

  try {
    const company = await prisma.company.findFirst();
    if (!company) {
      return NextResponse.json({ error: 'No hay company en la DB' }, { status: 400 });
    }

    const vendedor = await prisma.user.findFirst({
      where: { companies: { some: { companyId: company.id } } }
    });
    if (!vendedor) {
      return NextResponse.json({ error: 'No hay usuarios en la DB' }, { status: 400 });
    }

    // Obtener o crear categoría
    let categoria = await prisma.category.findFirst({ where: { companyId: company.id } });
    if (!categoria) {
      categoria = await prisma.category.create({
        data: { name: 'Productos General', companyId: company.id, createdById: vendedor.id }
      });
    }

    // Clientes de prueba
    const clientesData = [
      { legalName: 'Distribuidora Norte SA', name: 'Dist. Norte', email: 'seed-norte@test.com', creditLimit: 500000 },
      { legalName: 'Comercial del Sur SRL',  name: 'Com. Sur',    email: 'seed-sur@test.com',   creditLimit: 300000 },
      { legalName: 'Mayorista Centro SA',    name: 'May. Centro', email: 'seed-centro@test.com', creditLimit: 1000000 },
    ];

    const clientes: any[] = [];
    for (const c of clientesData) {
      let cliente = await prisma.client.findFirst({ where: { email: c.email, companyId: company.id } });
      if (!cliente) {
        const ts = Date.now().toString(36);
        const rnd = Math.random().toString(36).substring(2, 8);
        cliente = await prisma.client.create({
          data: {
            id: `c${ts}${rnd}`,
            ...c,
            companyId: company.id,
            taxCondition: 'responsable_inscripto',
            isActive: true,
          }
        });
      }
      clientes.push(cliente);
    }

    // Productos de prueba
    const productosData = [
      { name: 'Aceite de Girasol 1.5L',    code: 'SEED-ACE', costPrice: 1800, precioVenta: 2520 },
      { name: 'Arroz Largo Fino 1kg',       code: 'SEED-ARR', costPrice: 850,  precioVenta: 1190 },
      { name: 'Fideos Spaghetti 500g',      code: 'SEED-FID', costPrice: 550,  precioVenta: 770  },
      { name: 'Harina 000 1kg',             code: 'SEED-HAR', costPrice: 400,  precioVenta: 560  },
      { name: 'Yerba Mate 1kg',             code: 'SEED-YER', costPrice: 2500, precioVenta: 3500 },
    ];

    const productos: any[] = [];
    for (const p of productosData) {
      let prod = await prisma.product.findFirst({ where: { code: p.code, companyId: company.id } });
      if (!prod) {
        const ts = Date.now().toString(36);
        const rnd = Math.random().toString(36).substring(2, 8);
        prod = await prisma.product.create({
          data: {
            id: `c${ts}${rnd}`,
            name: p.name,
            code: p.code,
            description: p.name,
            costPrice: p.costPrice,
            unit: 'UN',
            minStock: 10,
            currentStock: 100,
            volume: 0,
            weight: 0,
            location: 'A1',
            companyId: company.id,
            categoryId: categoria.id,
            createdById: vendedor.id,
            isActive: true,
          }
        });
      }
      productos.push({ ...prod, precioVenta: p.precioVenta });
    }

    // Fechas del mes actual (Febrero 2026)
    const ahora = new Date();
    const year = ahora.getFullYear();
    const month = ahora.getMonth(); // 0-indexed

    const facturasCreadas: string[] = [];
    let nextNumero = 90000 + Math.floor(Math.random() * 1000);

    const escenarios = [
      { clientIdx: 0, dias: 2,  items: [0, 2, 4], cantidades: [20, 15, 10], estado: 'EMITIDA'            },
      { clientIdx: 1, dias: 5,  items: [1, 3],    cantidades: [30, 25],     estado: 'EMITIDA'            },
      { clientIdx: 2, dias: 8,  items: [0, 1, 3], cantidades: [50, 40, 20], estado: 'COBRADA'            },
      { clientIdx: 0, dias: 10, items: [2, 4],    cantidades: [15, 8],      estado: 'EMITIDA'            },
      { clientIdx: 1, dias: 12, items: [0, 2],    cantidades: [25, 20],     estado: 'COBRADA'            },
      { clientIdx: 2, dias: 15, items: [1, 3, 4], cantidades: [60, 30, 12], estado: 'PARCIALMENTE_COBRADA' },
      { clientIdx: 0, dias: 17, items: [0, 1, 2], cantidades: [10, 20, 15], estado: 'EMITIDA'            },
    ];

    for (const esc of escenarios) {
      const fecha = new Date(year, month, esc.dias);
      const cliente = clientes[esc.clientIdx];
      const numero = String(nextNumero++).padStart(8, '0');
      const numeroCompleto = `A-00001-${numero}`;

      // Calcular ítems
      const itemsData = esc.items.map((pi, idx) => {
        const prod = productos[pi];
        const cantidad = esc.cantidades[idx];
        const precioUnitario = prod.precioVenta;
        const subtotal = cantidad * precioUnitario;
        return { prod, cantidad, precioUnitario, subtotal };
      });

      const netoGravado = itemsData.reduce((s, it) => s + it.subtotal, 0);
      const iva21 = Math.round(netoGravado * 0.21 * 100) / 100;
      const total = netoGravado + iva21;
      const saldoPendiente = esc.estado === 'COBRADA' ? 0
        : esc.estado === 'PARCIALMENTE_COBRADA' ? Math.round(total * 0.4 * 100) / 100
        : total;

      const factura = await prisma.salesInvoice.create({
        data: {
          tipo: 'A',
          letra: 'A',
          puntoVenta: '00001',
          numero,
          numeroCompleto,
          clientId: cliente.id,
          estado: esc.estado as any,
          fechaEmision: fecha,
          fechaVencimiento: new Date(fecha.getTime() + 30 * 24 * 60 * 60 * 1000),
          netoGravado,
          iva21,
          total,
          saldoPendiente,
          docType: 'T1',
          companyId: company.id,
          createdBy: vendedor.id,
          // ← Ítems incluidos en la misma transacción
          items: {
            create: itemsData.map(it => ({
              productId: it.prod.id,
              codigo: it.prod.code,
              descripcion: it.prod.name,
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

      facturasCreadas.push(`${factura.numeroCompleto} — $${total.toLocaleString('es-AR')} (${esc.estado})`);
    }

    return NextResponse.json({
      success: true,
      companyId: company.id,
      mes: `${year}-${String(month + 1).padStart(2, '0')}`,
      clientesCreados: clientes.length,
      productosCreados: productos.length,
      facturasCreadas,
    });

  } catch (error) {
    console.error('Error seed-ventas:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Error al crear seed', detail: msg }, { status: 500 });
  }
}
