import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const followUpSchema = z.object({
  tipo: z.enum(['AUTO', 'MANUAL']).default('MANUAL'),
  canal: z.enum(['EMAIL', 'WHATSAPP', 'LLAMADA', 'INTERNO']),
  asunto: z.string().max(255).optional(),
  mensaje: z.string().min(1, 'El mensaje es requerido'),
  programadoPara: z.string().refine(val => !isNaN(Date.parse(val)), 'Fecha inválida'),
});

/**
 * GET - List follow-ups for a quote
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_VIEW);
    if (error) return error;

    const { id: idParam } = await params;
    const quoteId = parseInt(idParam);

    if (isNaN(quoteId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verify quote belongs to company
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, companyId: user!.companyId },
      select: { id: true, numero: true }
    });

    if (!quote) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    const followUps = await prisma.$queryRaw<any[]>`
      SELECT
        f.*,
        u.name as "createdByName"
      FROM quote_follow_ups f
      LEFT JOIN "User" u ON u.id = f."createdBy"
      WHERE f."quoteId" = ${quoteId}
      ORDER BY f."programadoPara" DESC
    `;

    return NextResponse.json({
      quoteId,
      quoteNumber: quote.numero,
      followUps,
      total: followUps.length,
      pending: followUps.filter(f => !f.enviado).length,
      completed: followUps.filter(f => f.enviado).length,
    });

  } catch (error) {
    console.error('Error fetching follow-ups:', error);
    return NextResponse.json(
      { error: 'Error al obtener seguimientos' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create follow-up
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_EDIT);
    if (error) return error;

    const { id: idParam } = await params;
    const quoteId = parseInt(idParam);

    if (isNaN(quoteId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json();
    const validation = followUpSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return NextResponse.json(
        { error: 'Datos inválidos', details: errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Verify quote exists
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, companyId: user!.companyId },
      select: { id: true, numero: true, estado: true }
    });

    if (!quote) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    // Create follow-up
    const followUp = await prisma.$queryRaw<any[]>`
      INSERT INTO quote_follow_ups (
        "quoteId", "companyId", tipo, canal, asunto, mensaje,
        "programadoPara", "createdBy"
      ) VALUES (
        ${quoteId}, ${user!.companyId}, ${data.tipo}, ${data.canal},
        ${data.asunto}, ${data.mensaje}, ${new Date(data.programadoPara)}, ${user!.id}
      )
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      followUp: followUp[0],
      message: 'Seguimiento programado exitosamente'
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating follow-up:', error);
    return NextResponse.json(
      { error: 'Error al crear seguimiento' },
      { status: 500 }
    );
  }
}
