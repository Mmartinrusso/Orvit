import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateTemplateSchema = z.object({
  nombre: z.string().min(1).max(255).optional(),
  descripcion: z.string().max(500).optional(),
  categoria: z.string().max(100).optional(),
  isActive: z.boolean().optional(),

  titulo: z.string().max(500).optional(),
  condicionesPago: z.string().optional(),
  condicionesEntrega: z.string().optional(),
  tiempoEntrega: z.string().max(255).optional(),
  validezDias: z.number().int().positive().optional(),
  notas: z.string().optional(),
  notasInternas: z.string().optional(),

  descuentoDefault: z.number().min(0).max(100).optional(),
  moneda: z.string().optional(),
  tasaIva: z.number().min(0).max(100).optional(),

  items: z.array(z.object({
    id: z.number().optional(),
    productId: z.string().optional(),
    descripcion: z.string().min(1).max(500),
    cantidad: z.number().positive(),
    unidad: z.string().default('UN'),
    usarPrecioActual: z.boolean().default(true),
    precioFijo: z.number().optional(),
    descuento: z.number().min(0).max(100).default(0),
    orden: z.number().int().default(0),
    notas: z.string().optional(),
  })).optional(),
});

/**
 * GET - Get template by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_VIEW);
    if (error) return error;

    const { id: idParam } = await params;
    const id = parseInt(idParam);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const template = await prisma.$queryRaw<any[]>`
      SELECT
        t.*,
        u.name as "createdByName",
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
            'notas', ti.notas,
            'productName', p.name,
            'productSku', p.sku,
            'productCurrentPrice', p."salePrice",
            'productCost', p.cost
          ) ORDER BY ti.orden
        )
        FROM quote_template_items ti
        LEFT JOIN "Product" p ON p.id = ti."productId"
        WHERE ti."templateId" = t.id
        ) as items
      FROM quote_templates t
      LEFT JOIN "User" u ON u.id = t."createdBy"
      WHERE t.id = ${id} AND t."companyId" = ${user!.companyId}
    `;

    if (template.length === 0) {
      return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      ...template[0],
      items: template[0].items || []
    });

  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json(
      { error: 'Error al obtener plantilla' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update template
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_EDIT);
    if (error) return error;

    const { id: idParam } = await params;
    const id = parseInt(idParam);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json();
    const validation = updateTemplateSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return NextResponse.json(
        { error: 'Datos inválidos', details: errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Update template with items in transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Check template exists
      const existing = await tx.$queryRaw<any[]>`
        SELECT id FROM quote_templates WHERE id = ${id} AND "companyId" = ${user!.companyId}
      `;

      if (existing.length === 0) {
        throw new Error('NOT_FOUND');
      }

      // Build update fields dynamically
      const updates: string[] = [];
      if (data.nombre !== undefined) updates.push(`nombre = '${data.nombre}'`);
      if (data.descripcion !== undefined) updates.push(`descripcion = ${data.descripcion ? `'${data.descripcion}'` : 'NULL'}`);
      if (data.categoria !== undefined) updates.push(`categoria = ${data.categoria ? `'${data.categoria}'` : 'NULL'}`);
      if (data.isActive !== undefined) updates.push(`"isActive" = ${data.isActive}`);
      if (data.titulo !== undefined) updates.push(`titulo = ${data.titulo ? `'${data.titulo}'` : 'NULL'}`);
      if (data.condicionesPago !== undefined) updates.push(`"condicionesPago" = ${data.condicionesPago ? `'${data.condicionesPago}'` : 'NULL'}`);
      if (data.condicionesEntrega !== undefined) updates.push(`"condicionesEntrega" = ${data.condicionesEntrega ? `'${data.condicionesEntrega}'` : 'NULL'}`);
      if (data.tiempoEntrega !== undefined) updates.push(`"tiempoEntrega" = ${data.tiempoEntrega ? `'${data.tiempoEntrega}'` : 'NULL'}`);
      if (data.validezDias !== undefined) updates.push(`"validezDias" = ${data.validezDias}`);
      if (data.notas !== undefined) updates.push(`notas = ${data.notas ? `'${data.notas}'` : 'NULL'}`);
      if (data.notasInternas !== undefined) updates.push(`"notasInternas" = ${data.notasInternas ? `'${data.notasInternas}'` : 'NULL'}`);
      if (data.descuentoDefault !== undefined) updates.push(`"descuentoDefault" = ${data.descuentoDefault}`);
      if (data.moneda !== undefined) updates.push(`moneda = '${data.moneda}'`);
      if (data.tasaIva !== undefined) updates.push(`"tasaIva" = ${data.tasaIva}`);

      if (updates.length > 0) {
        updates.push(`"updatedAt" = NOW()`);
        await tx.$executeRawUnsafe(`
          UPDATE quote_templates SET ${updates.join(', ')}
          WHERE id = ${id}
        `);
      }

      // Update items if provided
      if (data.items) {
        // Delete existing items
        await tx.$executeRaw`DELETE FROM quote_template_items WHERE "templateId" = ${id}`;

        // Insert new items
        for (const item of data.items) {
          await tx.$executeRaw`
            INSERT INTO quote_template_items (
              "templateId", "productId", descripcion, cantidad, unidad,
              "usarPrecioActual", "precioFijo", descuento, orden, notas
            ) VALUES (
              ${id}, ${item.productId}, ${item.descripcion}, ${item.cantidad}, ${item.unidad},
              ${item.usarPrecioActual}, ${item.precioFijo}, ${item.descuento}, ${item.orden}, ${item.notas}
            )
          `;
        }
      }

      // Return updated template
      const result = await tx.$queryRaw<any[]>`
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
        WHERE t.id = ${id}
      `;

      return result[0];
    });

    return NextResponse.json({
      success: true,
      template: {
        ...updated,
        items: updated.items || []
      },
      message: 'Plantilla actualizada exitosamente'
    });

  } catch (error: any) {
    console.error('Error updating template:', error);

    if (error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Error al actualizar plantilla' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete template
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_DELETE);
    if (error) return error;

    const { id: idParam } = await params;
    const id = parseInt(idParam);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Check if template exists and belongs to company
    const template = await prisma.$queryRaw<any[]>`
      SELECT id FROM quote_templates WHERE id = ${id} AND "companyId" = ${user!.companyId}
    `;

    if (template.length === 0) {
      return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });
    }

    // Delete template (cascade will delete items)
    await prisma.$executeRaw`DELETE FROM quote_templates WHERE id = ${id}`;

    return NextResponse.json({
      success: true,
      message: 'Plantilla eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { error: 'Error al eliminar plantilla' },
      { status: 500 }
    );
  }
}
