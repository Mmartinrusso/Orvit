import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const month = searchParams.get('month'); // Opcional: filtrar por mes

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    let query = `
      SELECT 
        ic.id,
        ic.name,
        ic.category_id as "categoryId",
        icc.name as "categoryName",
        ic.amount,
        ic.fecha_imputacion as month,
        ic.description,
        ic.status,
        ic.due_date as "dueDate",
        ic.created_at as "createdAt",
        ic.updated_at as "updatedAt"
      FROM indirect_costs ic
      INNER JOIN indirect_cost_categories icc ON ic.category_id = icc.id
      WHERE ic.company_id = $1
    `;

    const params = [parseInt(companyId)];

    if (month) {
      query += ` AND ic.fecha_imputacion = $2`;
      params.push(month);
    }

    query += ` ORDER BY ic.created_at DESC`;

    const costs = await prisma.$queryRawUnsafe(query, ...params);

    return NextResponse.json(costs);

  } catch (error) {
    console.error('Error obteniendo costos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, categoryId, amount, month, description, dueDate, status, companyId } = body;

    if (!name || !categoryId || !amount || !month || !companyId) {
      return NextResponse.json(
        { error: 'Nombre, categoría, monto, mes y companyId son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que la categoría existe
    const categoryExists = await prisma.$queryRaw`
      SELECT id FROM indirect_cost_categories 
      WHERE id = ${parseInt(categoryId)} AND company_id = ${parseInt(companyId)}
    `;

    if (!categoryExists || (categoryExists as any[]).length === 0) {
      return NextResponse.json(
        { error: 'La categoría especificada no existe' },
        { status: 400 }
      );
    }

    // Crear el costo
    await prisma.$executeRaw`
      INSERT INTO indirect_costs (name, category_id, amount, fecha_imputacion, description, due_date, status, company_id)
      VALUES (${name}, ${parseInt(categoryId)}, ${parseFloat(amount)}, ${month}, ${description || null}, ${dueDate ? new Date(dueDate) : null}, ${status || 'pending'}, ${parseInt(companyId)})
    `;

    // Obtener el costo creado
    const newCost = await prisma.$queryRaw`
      SELECT 
        ic.id,
        ic.name,
        ic.category_id as "categoryId",
        icc.name as "categoryName",
        ic.amount,
        ic.fecha_imputacion as month,
        ic.description,
        ic.status,
        ic.due_date as "dueDate",
        ic.created_at as "createdAt",
        ic.updated_at as "updatedAt"
      FROM indirect_costs ic
      INNER JOIN indirect_cost_categories icc ON ic.category_id = icc.id
      WHERE ic.company_id = ${parseInt(companyId)} AND ic.name = ${name} AND ic.fecha_imputacion = ${month}
      ORDER BY ic.id DESC
      LIMIT 1
    `;

    // Registrar en el historial
    await prisma.$executeRaw`
      INSERT INTO indirect_cost_history (cost_id, old_amount, new_amount, change_type, reason, company_id)
      VALUES (${(newCost[0] as any).id}, NULL, ${parseFloat(amount)}, 'created', 'Costo creado', ${parseInt(companyId)})
    `;

    return NextResponse.json(newCost[0], { status: 201 });

  } catch (error) {
    console.error('Error creando costo:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
