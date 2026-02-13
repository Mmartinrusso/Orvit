import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { generateQuoteNumber } from '@/lib/ventas/document-number';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const fromTemplateSchema = z.object({
  templateId: z.number().int().positive(),
  clientId: z.string().min(1, 'Cliente requerido'),
  sellerId: z.number().int().optional(),

  // Override template values
  titulo: z.string().max(500).optional(),
  condicionesPago: z.string().optional(),
  condicionesEntrega: z.string().optional(),
  tiempoEntrega: z.string().max(255).optional(),
  validezDias: z.number().int().positive().optional(),
  notas: z.string().optional(),
  notasInternas: z.string().optional(),

  // Items adjustments
  ajustarPrecios: z.boolean().default(true),
  descuentoGlobal: z.number().min(0).max(100).optional(),
  itemsExcluir: z.array(z.number()).optional(), // IDs de items a excluir
  itemsModificar: z.array(z.object({
    templateItemId: z.number(),
    cantidad: z.number().positive().optional(),
    precioUnitario: z.number().optional(),
    descuento: z.number().min(0).max(100).optional(),
  })).optional(),
});

/**
 * POST - Create quote from template
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_CREATE);
    if (error) return error;

    const body = await request.json();
    const validation = fromTemplateSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return NextResponse.json(
        { error: 'Datos inválidos', details: errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Fetch template with items
    const template = await prisma.$queryRaw<any[]>`
      SELECT
        t.*,
        (SELECT json_agg(
          json_build_object(
            'id', ti.id,
            'productId', ti."productId",
            'descripcion', ti.descripcion,
            'cantidad', ti.cantidad,
            'unidad', ti.unidad,
            'usarPrecioActual', ti."usarPrecioActual",
            'precioFijo', ti."precioFijo",
            'descuento', ti.descuento,
            'orden', ti.orden,
            'notas', ti.notas
          ) ORDER BY ti.orden
        )
        FROM quote_template_items ti
        WHERE ti."templateId" = t.id
        ) as items
      FROM quote_templates t
      WHERE t.id = ${data.templateId} AND t."companyId" = ${user!.companyId} AND t."isActive" = true
    `;

    if (template.length === 0) {
      return NextResponse.json(
        { error: 'Plantilla no encontrada o inactiva' },
        { status: 404 }
      );
    }

    const templateData = template[0];
    const templateItems: any[] = templateData.items || [];

    if (templateItems.length === 0) {
      return NextResponse.json(
        { error: 'La plantilla no tiene items configurados' },
        { status: 400 }
      );
    }

    // Verify client exists
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, companyId: user!.companyId },
      select: { id: true, legalName: true, name: true }
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Cliente no encontrado' },
        { status: 404 }
      );
    }

    // Create items map for modifications
    const itemsModifyMap = new Map(
      (data.itemsModificar || []).map(m => [m.templateItemId, m])
    );
    const itemsExcludeSet = new Set(data.itemsExcluir || []);

    // Calculate items with current prices
    let subtotal = 0;
    const quoteItems: any[] = [];

    for (const templateItem of templateItems) {
      // Skip excluded items
      if (itemsExcludeSet.has(templateItem.id)) {
        continue;
      }

      // Get product current price if needed
      let precio = 0;
      let costo = 0;
      let productData = null;

      if (templateItem.productId) {
        productData = await prisma.product.findUnique({
          where: { id: templateItem.productId },
          select: {
            id: true,
            name: true,
            sku: true,
            salePrice: true,
            cost: true,
          }
        });

        if (productData) {
          // Use current price or fixed price from template
          if (data.ajustarPrecios && templateItem.usarPrecioActual) {
            precio = Number(productData.salePrice || 0);
          } else {
            precio = Number(templateItem.precioFijo || productData.salePrice || 0);
          }
          costo = Number(productData.cost || 0);
        }
      } else {
        // No product, use fixed price
        precio = Number(templateItem.precioFijo || 0);
      }

      // Apply modifications if any
      const modification = itemsModifyMap.get(templateItem.id);
      const cantidad = modification?.cantidad || Number(templateItem.cantidad);
      if (modification?.precioUnitario !== undefined) {
        precio = modification.precioUnitario;
      }

      // Calculate descuento
      let descuento = modification?.descuento !== undefined
        ? modification.descuento
        : Number(templateItem.descuento || 0);

      // Apply global discount if specified
      if (data.descuentoGlobal !== undefined && data.descuentoGlobal > 0) {
        descuento = Math.max(descuento, data.descuentoGlobal);
      }

      const itemSubtotal = cantidad * precio * (1 - descuento / 100);
      subtotal += itemSubtotal;

      const margen = precio > 0 && costo > 0
        ? ((precio - costo) / precio) * 100
        : 0;

      quoteItems.push({
        productId: templateItem.productId,
        descripcion: templateItem.descripcion,
        cantidad,
        unidad: templateItem.unidad,
        precioUnitario: precio,
        descuento,
        subtotal: itemSubtotal,
        costo,
        margen,
        notas: templateItem.notas,
      });
    }

    if (quoteItems.length === 0) {
      return NextResponse.json(
        { error: 'No hay items válidos para crear la cotización' },
        { status: 400 }
      );
    }

    // Calculate totals
    const tasaIva = templateData.tasaIva || 21;
    const impuestos = subtotal * (tasaIva / 100);
    const total = subtotal + impuestos;

    // Calculate validity date
    const validezDias = data.validezDias || templateData.validezDias || 30;
    const fechaValidez = new Date();
    fechaValidez.setDate(fechaValidez.getDate() + validezDias);

    // Create quote in transaction
    const quote = await prisma.$transaction(async (tx) => {
      // Generate quote number
      const numero = await generateQuoteNumber(user!.companyId);

      // Create quote
      const created = await tx.quote.create({
        data: {
          numero,
          companyId: user!.companyId,
          clientId: data.clientId,
          sellerId: data.sellerId || user!.id,
          createdBy: user!.id,

          // Use template values or overrides
          titulo: data.titulo || templateData.titulo || `Cotización para ${client.legalName || client.name}`,
          condicionesPago: data.condicionesPago || templateData.condicionesPago,
          condicionesEntrega: data.condicionesEntrega || templateData.condicionesEntrega,
          tiempoEntrega: data.tiempoEntrega || templateData.tiempoEntrega,
          notas: data.notas || templateData.notas,
          notasInternas: data.notasInternas || templateData.notasInternas,

          fechaEmision: new Date(),
          fechaValidez,
          moneda: templateData.moneda,
          subtotal,
          tasaIva,
          impuestos,
          total,

          estado: 'BORRADOR',
          version: 1,
        }
      });

      // Create quote items
      await tx.quoteItem.createMany({
        data: quoteItems.map(item => ({
          quoteId: created.id,
          productId: item.productId,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          unidad: item.unidad,
          precioUnitario: item.precioUnitario,
          descuento: item.descuento,
          subtotal: item.subtotal,
          costoUnitario: item.costo,
          margenItem: item.margen,
          notas: item.notas,
        }))
      });

      // Update template usage stats
      await tx.$executeRaw`
        UPDATE quote_templates
        SET "timesUsed" = "timesUsed" + 1,
            "lastUsedAt" = NOW()
        WHERE id = ${data.templateId}
      `;

      return created;
    });

    // Fetch complete quote with items
    const completeQuote = await prisma.quote.findUnique({
      where: { id: quote.id },
      include: {
        client: {
          select: {
            id: true,
            legalName: true,
            name: true,
            email: true,
          }
        },
        seller: {
          select: { id: true, name: true }
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true }
            }
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      quote: completeQuote,
      templateUsed: {
        id: templateData.id,
        nombre: templateData.nombre,
        itemsOriginales: templateItems.length,
        itemsCreados: quoteItems.length,
      },
      message: `Cotización ${quote.numero} creada desde plantilla "${templateData.nombre}"`
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating quote from template:', error);
    return NextResponse.json(
      { error: 'Error al crear cotización desde plantilla', details: error.message },
      { status: 500 }
    );
  }
}
