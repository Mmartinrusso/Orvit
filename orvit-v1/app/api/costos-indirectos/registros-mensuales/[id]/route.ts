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

    const recordId = parseInt(params.id);

    // Verificar que el registro existe y pertenece a la empresa
    const recordExists = await prisma.$queryRaw`
      SELECT id, cost_base_id FROM indirect_cost_monthly_records
      WHERE id = ${recordId} AND company_id = ${parseInt(companyId)}
    `;

    if (!recordExists || (recordExists as any[]).length === 0) {
      return NextResponse.json(
        { error: 'El registro especificado no existe' },
        { status: 404 }
      );
    }

    const costBaseId = (recordExists[0] as any).cost_base_id;

    // Eliminar registros del historial relacionados
    await prisma.$executeRaw`
      DELETE FROM indirect_cost_change_history
      WHERE monthly_record_id = ${recordId}
    `;

    // Eliminar el registro mensual
    await prisma.$executeRaw`
      DELETE FROM indirect_cost_monthly_records
      WHERE id = ${recordId}
    `;

    // Registrar en el historial que se eliminó
    await prisma.$queryRaw`
      INSERT INTO indirect_cost_change_history (
        cost_base_id, monthly_record_id, change_type, old_amount, new_amount, reason, company_id, created_at
      ) VALUES (
        ${costBaseId}, 
        ${recordId}, 
        'monthly_record_deleted', 
        0, 
        0, 
        'Registro mensual eliminado', 
        ${parseInt(companyId)}, 
        CURRENT_TIMESTAMP
      )
    `;

    return NextResponse.json({ message: 'Registro mensual eliminado exitosamente' });

  } catch (error) {
    console.error('Error eliminando registro mensual:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { fecha_imputacion, amount, status, dueDate, notes, companyId } = body;

    if (!fecha_imputacion || !amount || !status || !companyId) {
      return NextResponse.json(
        { error: 'Fecha de imputación, monto, estado y companyId son requeridos' },
        { status: 400 }
      );
    }

    const recordId = parseInt(params.id);

    // Verificar que el registro existe y pertenece a la empresa
    const existingRecord = await prisma.$queryRaw`
      SELECT id, cost_base_id FROM indirect_cost_monthly_records
      WHERE id = ${recordId} AND company_id = ${parseInt(companyId)}
    `;

    if (!existingRecord || (existingRecord as any[]).length === 0) {
      return NextResponse.json(
        { error: 'El registro especificado no existe' },
        { status: 404 }
      );
    }

    const costBaseId = (existingRecord as any[])[0].cost_base_id;

    // Verificar que no exista otro registro para el mismo mes y costo
    const duplicateRecord = await prisma.$queryRaw`
      SELECT id FROM indirect_cost_monthly_records
      WHERE cost_base_id = ${costBaseId} AND fecha_imputacion = ${fecha_imputacion} AND id != ${recordId}
    `;

    if (duplicateRecord && (duplicateRecord as any[]).length > 0) {
      return NextResponse.json(
        { error: 'Ya existe un registro para este mes y costo' },
        { status: 400 }
      );
    }

    // Actualizar el registro mensual
    const updatedRecord = await prisma.$queryRaw`
      UPDATE indirect_cost_monthly_records
      SET fecha_imputacion = ${fecha_imputacion}, amount = ${amount}, status = ${status}, 
          due_date = ${dueDate || null}, notes = ${notes || null}, updated_at = NOW()
      WHERE id = ${recordId}
      RETURNING id, cost_base_id, fecha_imputacion as month, amount, status, due_date, notes, created_at, updated_at
    `;

    // Registrar en el historial
    await prisma.$queryRaw`
      INSERT INTO indirect_cost_change_history (
        cost_base_id, monthly_record_id, change_type, old_amount, new_amount, reason, company_id, created_at
      ) VALUES (
        ${costBaseId}, 
        ${recordId}, 
        'monthly_record_updated', 
        0, 
        ${parseFloat(amount)}, 
        'Registro mensual actualizado', 
        ${parseInt(companyId)}, 
        CURRENT_TIMESTAMP
      )
    `;

    return NextResponse.json((updatedRecord as any[])[0]);

  } catch (error) {
    console.error('Error actualizando registro mensual:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
