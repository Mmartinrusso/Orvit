import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const columnSchema = z.object({
  field: z.enum(['codigo', 'descripcion', 'cantidad', 'unidad', 'precio_unitario', 'descuento', 'subtotal', 'peso', 'notas_item']),
  label: z.string().max(50),
  visible: z.boolean(),
  width: z.string().optional(),
  align: z.enum(['left', 'right', 'center']).optional(),
  format: z.enum(['currency', 'number', 'text', 'percentage']).optional(),
});

const paymentPresetSchema = z.object({
  label: z.string().max(100),
  value: z.string().max(500),
});

const quoteTemplateSchema = z.object({
  nombre: z.string().min(1).max(100),
  isDefault: z.boolean().optional(),

  // Layout visual
  logoPosition: z.enum(['top-left', 'top-center', 'top-right', 'none']).default('top-left'),
  logoSize: z.enum(['small', 'medium', 'large']).default('medium'),
  headerLayout: z.enum(['classic', 'centered', 'banner', 'compact']).default('classic'),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#000000'),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#666666'),
  fontFamily: z.enum(['sans', 'serif', 'mono']).default('sans'),
  showBorder: z.boolean().default(true),
  watermark: z.string().max(100).optional().nullable(),
  separatorStyle: z.enum(['solid', 'dashed', 'double', 'none']).default('solid'),
  separatorWeight: z.enum(['thin', 'medium', 'thick']).default('thin'),
  tableZebraRows: z.boolean().default(false),
  tableHeaderFill: z.boolean().default(true),
  tableBorderRadius: z.enum(['none', 'sm', 'md']).default('none'),
  preset: z.string().max(50).optional().nullable(),

  // Header
  labelDocumento: z.string().max(50).default('PRESUPUESTO'),
  showNumero: z.boolean().default(true),
  showFecha: z.boolean().default(true),
  showVencimiento: z.boolean().default(true),

  // Columnas
  columns: z.array(columnSchema).default([]),

  // Footer
  showSubtotal: z.boolean().default(true),
  showIVA: z.boolean().default(true),
  showTotal: z.boolean().default(true),
  showCondiciones: z.boolean().default(true),
  notasFooter: z.string().optional().nullable(),

  // Firma
  firmaHabilitada: z.boolean().default(false),
  firmaNombre: z.string().max(100).optional().nullable(),
  firmaCargo: z.string().max(100).optional().nullable(),
  firmaImagen: z.string().optional().nullable(),

  // Aprobación online
  allowOnlineApproval: z.boolean().default(false),
  approvalMessage: z.string().optional().nullable(),

  // Presets condiciones de pago
  paymentConditionPresets: z.array(paymentPresetSchema).default([]),

  // Posición de notas en el documento
  notasPosition: z.enum(['before_items', 'after_totals']).default('after_totals'),

  // Logo específico para cotizaciones (independiente del logo general de la empresa)
  logoUrl: z.string().url().optional().nullable(),
});

// GET - Listar todos los templates de diseño de la empresa
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_VIEW);
    if (error) return error;

    const templates = await prisma.quoteTemplate.findMany({
      where: { companyId: user!.companyId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Error fetching quote design templates:', error);
    return NextResponse.json({ error: 'Error al obtener templates' }, { status: 500 });
  }
}

// POST - Crear nuevo template de diseño
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_EDIT);
    if (error) return error;

    const body = await request.json();
    const validation = quoteTemplateSchema.safeParse(body);

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
          where: { companyId: user!.companyId },
          data: { isDefault: false },
        });
      }

      return tx.quoteTemplate.create({
        data: {
          companyId: user!.companyId,
          nombre: data.nombre,
          isDefault: data.isDefault ?? false,
          logoPosition: data.logoPosition,
          logoSize: data.logoSize,
          headerLayout: data.headerLayout,
          primaryColor: data.primaryColor,
          accentColor: data.accentColor,
          fontFamily: data.fontFamily,
          showBorder: data.showBorder,
          watermark: data.watermark,
          separatorStyle: data.separatorStyle,
          separatorWeight: data.separatorWeight,
          tableZebraRows: data.tableZebraRows,
          tableHeaderFill: data.tableHeaderFill,
          tableBorderRadius: data.tableBorderRadius,
          preset: data.preset,
          labelDocumento: data.labelDocumento,
          showNumero: data.showNumero,
          showFecha: data.showFecha,
          showVencimiento: data.showVencimiento,
          columns: data.columns,
          showSubtotal: data.showSubtotal,
          showIVA: data.showIVA,
          showTotal: data.showTotal,
          showCondiciones: data.showCondiciones,
          notasFooter: data.notasFooter,
          firmaHabilitada: data.firmaHabilitada,
          firmaNombre: data.firmaNombre,
          firmaCargo: data.firmaCargo,
          firmaImagen: data.firmaImagen,
          allowOnlineApproval: data.allowOnlineApproval,
          approvalMessage: data.approvalMessage,
          paymentConditionPresets: data.paymentConditionPresets,
          notasPosition: data.notasPosition,
          logoUrl: data.logoUrl ?? null,
        },
      });
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Error creating quote design template:', error);
    return NextResponse.json({ error: 'Error al crear template' }, { status: 500 });
  }
}
