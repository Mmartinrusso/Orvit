import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    const historyId = parseInt(params.id);

    // Verificar que la entrada del historial existe y pertenece a la empresa
    const historyExists = await prisma.$queryRaw`
      SELECT id FROM indirect_cost_change_history
      WHERE id = ${historyId} AND company_id = ${parseInt(companyId)}
    `;

    if (!historyExists || (historyExists as any[]).length === 0) {
      return NextResponse.json(
        { error: 'La entrada del historial especificada no existe' },
        { status: 404 }
      );
    }

    // Eliminar la entrada del historial
    await prisma.$executeRaw`
      DELETE FROM indirect_cost_change_history
      WHERE id = ${historyId}
    `;

    return NextResponse.json({ message: 'Entrada del historial eliminada exitosamente' });

  } catch (error) {
    console.error('Error eliminando entrada del historial:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
