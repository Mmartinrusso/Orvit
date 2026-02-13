import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schema
const templateSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(255),
  descripcion: z.string().max(500).optional(),
  categoria: z.string().max(100).optional(),

  // Pre-configured content
  titulo: z.string().max(500).optional(),
  condicionesPago: z.string().optional(),
  condicionesEntrega: z.string().optional(),
  tiempoEntrega: z.string().max(255).optional(),
  validezDias: z.number().int().positive().default(30),
  notas: z.string().optional(),
  notasInternas: z.string().optional(),

  descuentoDefault: z.number().min(0).max(100).optional(),
  moneda: z.string().default('ARS'),
  tasaIva: z.number().min(0).max(100).default(21),

  // Items
  items: z.array(z.object({
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
 * GET - List all quote templates
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_VIEW);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const categoria = searchParams.get('categoria');
    const activo = searchParams.get('activo');
    const includeItems = searchParams.get('includeItems') === 'true';

    const templates = await prisma.$queryRaw<any[]>`
      SELECT
        t.*,
        u.name as "createdByName",
        ${includeItems ? `
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
              'productCurrentPrice', p."salePrice"
            ) ORDER BY ti.orden
          )
          FROM quote_template_items ti
          LEFT JOIN "Product" p ON p.id = ti."productId"
          WHERE ti."templateId" = t.id
        ) as items
        ` : 'NULL as items'}
      FROM quote_templates t
      LEFT JOIN "User" u ON u.id = t."createdBy"
      WHERE t."companyId" = ${user!.companyId}
        ${categoria ? `AND t.categoria = ${categoria}` : ''}
        ${activo === 'true' ? 'AND t."isActive" = true' : ''}
        ${activo === 'false' ? 'AND t."isActive" = false' : ''}
      ORDER BY t."timesUsed" DESC, t."createdAt" DESC
    `;

    // Parse JSON fields
    const parsedTemplates = templates.map(t => ({
      ...t,
      items: t.items || []
    }));

    return NextResponse.json({
      templates: parsedTemplates,
      total: templates.length
    });
  } catch (error) {
    console.error('Error fetching quote templates:', error);
    return NextResponse.json(
      { error: 'Error al obtener plantillas' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create new quote template
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_CREATE);
    if (error) return error;

    const body = await request.json();
    const validation = templateSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return NextResponse.json(
        { error: 'Datos inválidos', details: errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Create template with items in transaction
    const template = await prisma.$transaction(async (tx) => {
      // Create template
      const created = await tx.$executeRaw`
        INSERT INTO quote_templates (
          "companyId", nombre, descripcion, categoria, "isActive",
          titulo, "condicionesPago", "condicionesEntrega", "tiempoEntrega",
          "validezDias", notas, "notasInternas", "descuentoDefault",
          moneda, "tasaIva", "createdBy"
        ) VALUES (
          ${user!.companyId}, ${data.nombre}, ${data.descripcion}, ${data.categoria}, true,
          ${data.titulo}, ${data.condicionesPago}, ${data.condicionesEntrega}, ${data.tiempoEntrega},
          ${data.validezDias}, ${data.notas}, ${data.notasInternas}, ${data.descuentoDefault || 0},
          ${data.moneda}, ${data.tasaIva}, ${user!.id}
        )
        RETURNING id
      `;

      // Get created template ID
      const templateResult = await tx.$queryRaw<any[]>`
        SELECT id FROM quote_templates
        WHERE "companyId" = ${user!.companyId} AND nombre = ${data.nombre}
        ORDER BY "createdAt" DESC LIMIT 1
      `;

      const templateId = templateResult[0].id;

      // Create items if provided
      if (data.items && data.items.length > 0) {
        for (const item of data.items) {
          await tx.$executeRaw`
            INSERT INTO quote_template_items (
              "templateId", "productId", descripcion, cantidad, unidad,
              "usarPrecioActual", "precioFijo", descuento, orden, notas
            ) VALUES (
              ${templateId}, ${item.productId}, ${item.descripcion}, ${item.cantidad}, ${item.unidad},
              ${item.usarPrecioActual}, ${item.precioFijo}, ${item.descuento}, ${item.orden}, ${item.notas}
            )
          `;
        }
      }

      // Return created template with items
      const fullTemplate = await tx.$queryRaw<any[]>`
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
        WHERE t.id = ${templateId}
      `;

      return fullTemplate[0];
    });

    return NextResponse.json({
      success: true,
      template: {
        ...template,
        items: template.items || []
      },
      message: 'Plantilla creada exitosamente'
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating quote template:', error);

    if (error.message?.includes('duplicate key')) {
      return NextResponse.json(
        { error: 'Ya existe una plantilla con ese nombre' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Error al crear plantilla' },
      { status: 500 }
    );
  }
}
