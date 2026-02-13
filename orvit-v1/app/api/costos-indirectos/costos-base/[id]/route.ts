import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    const costId = parseInt(params.id);

    // Verificar que el costo existe y pertenece a la empresa
    const costExists = await prisma.$queryRaw`
      SELECT id FROM indirect_cost_base
      WHERE id = ${costId} AND company_id = ${parseInt(companyId)}
    `;

    if (!costExists || (costExists as any[]).length === 0) {
      return NextResponse.json(
        { error: 'El costo especificado no existe' },
        { status: 404 }
      );
    }

    // Eliminar TODO el historial relacionado (registros mensuales y cambios)
    console.log(`🗑️ Eliminando todo el historial para costo base ID: ${costId}`);
    
    // 1. Eliminar registros del historial de cambios relacionados con registros mensuales
    await prisma.$executeRaw`
      DELETE FROM indirect_cost_change_history
      WHERE cost_base_id = ${costId} AND monthly_record_id IS NOT NULL
    `;
    
    // 2. Eliminar registros mensuales
    await prisma.$executeRaw`
      DELETE FROM indirect_cost_monthly_records
      WHERE cost_base_id = ${costId}
    `;
    
    // 3. Eliminar registros del historial de cambios del costo base
    await prisma.$executeRaw`
      DELETE FROM indirect_cost_change_history
      WHERE cost_base_id = ${costId}
    `;

    // 4. Eliminar el costo base
    await prisma.$executeRaw`
      DELETE FROM indirect_cost_base
      WHERE id = ${costId}
    `;
    
    console.log(`✅ Costo base ${costId} y todo su historial eliminados exitosamente`);

    return NextResponse.json({ message: 'Costo eliminado exitosamente' });

  } catch (error) {
    console.error('Error eliminando costo:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
