import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  nombre: z.string().min(1).max(100).optional(),
  isDefault: z.boolean().optional(),
  logoPosition: z.enum(['top-left', 'top-center', 'top-right', 'none']).optional(),
  logoSize: z.enum(['small', 'medium', 'large']).optional(),
  headerLayout: z.enum(['classic', 'centered', 'banner', 'compact']).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  fontFamily: z.enum(['sans', 'serif', 'mono']).optional(),
  showBorder: z.boolean().optional(),
  watermark: z.string().max(100).optional().nullable(),
  separatorStyle: z.enum(['solid', 'dashed', 'double', 'none']).optional(),
  separatorWeight: z.enum(['thin', 'medium', 'thick']).optional(),
  tableZebraRows: z.boolean().optional(),
  tableHeaderFill: z.boolean().optional(),
  tableBorderRadius: z.enum(['none', 'sm', 'md']).optional(),
  preset: z.string().max(50).optional().nullable(),
  labelDocumento: z.string().max(50).optional(),
  showNumero: z.boolean().optional(),
  showFecha: z.boolean().optional(),
  showVencimiento: z.boolean().optional(),
  columns: z.array(z.any()).optional(),
  showSubtotal: z.boolean().optional(),
  showIVA: z.boolean().optional(),
  showTotal: z.boolean().optional(),
  showCondiciones: z.boolean().optional(),
  notasFooter: z.string().optional().nullable(),
  firmaHabilitada: z.boolean().optional(),
  firmaNombre: z.string().max(100).optional().nullable(),
  firmaCargo: z.string().max(100).optional().nullable(),
  firmaImagen: z.string().optional().nullable(),
  allowOnlineApproval: z.boolean().optional(),
  approvalMessage: z.string().optional().nullable(),
  paymentConditionPresets: z.array(z.any()).optional(),
  notasPosition: z.enum(['before_items', 'after_totals']).optional(),
  logoUrl: z.string().url().optional().nullable(),
});

type Params = { params: { id: string } };

// GET - Obtener template por ID
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_VIEW);
    if (error) return error;

    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const template = await prisma.quoteTemplate.findFirst({
      where: { id, companyId: user!.companyId },
    });

    if (!template) return NextResponse.json({ error: 'Template no encontrado' }, { status: 404 });

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error fetching quote design template:', error);
    return NextResponse.json({ error: 'Error al obtener template' }, { status: 500 });
  }
}

// PATCH - Actualizar template
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_EDIT);
    if (error) return error;

    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const existing = await prisma.quoteTemplate.findFirst({
      where: { id, companyId: user!.companyId },
    });
    if (!existing) return NextResponse.json({ error: 'Template no encontrado' }, { status: 404 });

    const body = await request.json();
    const validation = updateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    const template = await prisma.$transaction(async (tx) => {
      // Si se marca como default, quitar default a los demás
      if (data.isDefault) {
        await tx.quoteTemplate.updateMany({
          where: { companyId: user!.companyId, id: { not: id } },
          data: { isDefault: false },
        });
      }

      return tx.quoteTemplate.update({
        where: { id },
        data,
      });
    });

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error updating quote design template:', error);
    return NextResponse.json({ error: 'Error al actualizar template' }, { status: 500 });
  }
}

// DELETE - Eliminar template
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_EDIT);
    if (error) return error;

    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const existing = await prisma.quoteTemplate.findFirst({
      where: { id, companyId: user!.companyId },
    });
    if (!existing) return NextResponse.json({ error: 'Template no encontrado' }, { status: 404 });

    if (existing.isDefault) {
      return NextResponse.json(
        { error: 'No se puede eliminar el template por defecto. Primero asigná otro como default.' },
        { status: 409 }
      );
    }

    await prisma.quoteTemplate.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting quote design template:', error);
    return NextResponse.json({ error: 'Error al eliminar template' }, { status: 500 });
  }
}
