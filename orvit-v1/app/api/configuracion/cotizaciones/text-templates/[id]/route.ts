import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  tipo: z.enum(['NOTA', 'PAGO', 'ENTREGA']).optional(),
  nombre: z.string().min(1).max(100).optional(),
  contenido: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
  orden: z.number().int().optional(),
});

// PUT - Actualizar plantilla de texto
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const body = await request.json();
    const validation = updateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.errors },
        { status: 400 }
      );
    }

    // Verificar que pertenece a la empresa
    const existing = await (prisma as any).quoteTextTemplate.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const updated = await (prisma as any).quoteTextTemplate.update({
      where: { id },
      data: { ...validation.data, updatedAt: new Date() },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating text template:', error);
    return NextResponse.json({ error: 'Error al actualizar plantilla' }, { status: 500 });
  }
}

// DELETE - Eliminar plantilla de texto
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const existing = await (prisma as any).quoteTextTemplate.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    await (prisma as any).quoteTextTemplate.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting text template:', error);
    return NextResponse.json({ error: 'Error al eliminar plantilla' }, { status: 500 });
  }
}
