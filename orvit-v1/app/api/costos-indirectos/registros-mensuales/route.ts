import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Usar instancia global de prisma desde @/lib/prisma

// GET /api/costos-indirectos/registros-mensuales - Obtener registros mensuales
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const fecha_imputacion = searchParams.get('fecha_imputacion');
    const costBaseId = searchParams.get('costBaseId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    // Usar SQL directo para evitar problemas con modelos
    let query = `
      SELECT 
        icmr.id,
        icmr.cost_base_id as "costBaseId",
        icmr.fecha_imputacion as "fechaImputacion",
        icmr.fecha_imputacion as "month",
        icmr.amount,
        icmr.status,
        icmr.due_date as "dueDate",
        icmr.notes,
        icb.name as "costName",
        icb.description as "costDescription",
        icc.name as "categoryName",
        icc.type as "categoryType",
        icmr.created_at as "createdAt",
        icmr.updated_at as "updatedAt",
        icmr.company_id as "companyId"
      FROM indirect_cost_monthly_records icmr
      LEFT JOIN indirect_cost_base icb ON icmr.cost_base_id = icb.id
      LEFT JOIN indirect_cost_categories icc ON icb.category_id = icc.id
      WHERE icmr.company_id = $1
    `;

    const params = [parseInt(companyId)];

    if (fecha_imputacion) {
      query += ` AND icmr.fecha_imputacion = $${params.length + 1}`;
      params.push(fecha_imputacion);
    }

    if (costBaseId) {
      query += ` AND icmr.cost_base_id = $${params.length + 1}`;
      params.push(parseInt(costBaseId));
    }

    query += ` ORDER BY icmr.fecha_imputacion DESC, icmr.created_at DESC`;

    const registros = await prisma.$queryRawUnsafe(query, ...params);

    return NextResponse.json(registros || []);

  } catch (error) {
    console.error('Error obteniendo registros mensuales:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/costos-indirectos/registros-mensuales - Crear nuevo registro mensual
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { costBaseId, fecha_imputacion, amount, status, dueDate, notes, companyId } = body;

    if (!costBaseId || !fecha_imputacion || !amount || !companyId) {
      return NextResponse.json(
        { error: 'costBaseId, fecha_imputacion, amount y companyId son requeridos' },
        { status: 400 }
      );
    }

    // Crear nuevo registro usando SQL directo
    const result = await prisma.$executeRaw`
      INSERT INTO indirect_cost_monthly_records (
        cost_base_id, fecha_imputacion, amount, status, due_date, notes, company_id, created_at, updated_at
      ) VALUES (
        ${parseInt(costBaseId)}, 
        ${fecha_imputacion}, 
        ${parseFloat(amount)}, 
        ${status || 'pending'}, 
        ${dueDate ? new Date(dueDate) : null}, 
        ${notes || ''}, 
        ${parseInt(companyId)}, 
        CURRENT_TIMESTAMP, 
        CURRENT_TIMESTAMP
      )
    `;

    // Obtener el ID del registro creado
    const newRecord = await prisma.$queryRaw`
      SELECT id FROM indirect_cost_monthly_records 
      WHERE cost_base_id = ${parseInt(costBaseId)} 
        AND fecha_imputacion = ${fecha_imputacion} 
        AND company_id = ${parseInt(companyId)}
      ORDER BY created_at DESC 
      LIMIT 1
    `;

    const recordId = (newRecord as any[])[0].id;

    // Crear registro en el historial
    await prisma.$queryRaw`
      INSERT INTO indirect_cost_change_history (
        cost_base_id, monthly_record_id, change_type, old_amount, new_amount, reason, company_id, created_at
      ) VALUES (
        ${parseInt(costBaseId)}, 
        ${recordId}, 
        'monthly_record_created', 
        0, 
        ${parseFloat(amount)}, 
        'Registro mensual creado', 
        ${parseInt(companyId)}, 
        CURRENT_TIMESTAMP
      )
    `;

    return NextResponse.json({
      success: true,
      message: 'Registro mensual creado exitosamente'
    }, { status: 201 });

  } catch (error) {
    console.error('Error creando registro mensual:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}