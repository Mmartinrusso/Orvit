import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/employee-distribution - Obtener configuraciones de distribución de empleados
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 API Employee Distribution GET - Iniciando...');
    
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    
    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    // Obtener todas las configuraciones de distribución de empleados para la empresa
    const distributions = await prisma.$queryRawUnsafe(`
      SELECT 
        edc.id,
        edc.employee_id as "employeeId",
        COALESCE(ec.name, 'Sin nombre') as "employeeName",
        COALESCE(ec.description, 'Sin descripción') as "employeeLastName",
        edc.product_category_id as "productCategoryId",
        COALESCE(pc.name, 'Sin categoría') as "productCategoryName",
        edc.percentage,
        edc.is_active as "isActive",
        edc.created_at as "createdAt",
        edc.updated_at as "updatedAt"
      FROM employee_distribution_config edc
      LEFT JOIN employee_categories ec ON edc.employee_id = ec.id
      LEFT JOIN product_categories pc ON edc.product_category_id = pc.id
      WHERE edc.company_id = $1
      ORDER BY ec.name, ec.description
    `, parseInt(companyId));

    console.log('📊 Configuraciones de empleados obtenidas:', distributions);
    return NextResponse.json(distributions);

  } catch (error) {
    console.error('❌ Error obteniendo configuraciones de empleados:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/employee-distribution - Crear nueva configuración de distribución de empleados
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 API Employee Distribution POST - Iniciando...');
    
    const body = await request.json();
    const { 
      companyId, 
      employeeId, 
      productCategoryId, 
      percentage 
    } = body;

    // Validaciones
    if (!companyId || !employeeId || !productCategoryId || percentage === undefined) {
      return NextResponse.json(
        { error: 'Todos los campos son requeridos' },
        { status: 400 }
      );
    }

    if (percentage < 0 || percentage > 100) {
      return NextResponse.json(
        { error: 'El porcentaje debe estar entre 0 y 100' },
        { status: 400 }
      );
    }

    // Verificar que no exista una configuración duplicada
    const existingConfig = await prisma.$queryRawUnsafe(`
      SELECT id FROM employee_distribution_config 
      WHERE company_id = $1 
      AND employee_id = $2 
      AND product_category_id = $3
    `, parseInt(companyId), parseInt(employeeId), parseInt(productCategoryId));

    if (existingConfig && (existingConfig as any[]).length > 0) {
      return NextResponse.json(
        { error: 'Ya existe una configuración para este empleado y categoría' },
        { status: 409 }
      );
    }

    // Crear la configuración
    const newConfig = await prisma.$queryRawUnsafe(`
      INSERT INTO employee_distribution_config (
        company_id, employee_id, product_category_id, percentage
      ) VALUES (
        $1, $2, $3, $4
      ) RETURNING id
    `, parseInt(companyId), parseInt(employeeId), parseInt(productCategoryId), parseFloat(percentage));

    console.log('✅ Configuración de empleado creada:', newConfig);
    
    return NextResponse.json({
      success: true,
      message: 'Configuración de empleado creada exitosamente',
      id: (newConfig as any[])[0].id
    });

  } catch (error) {
    console.error('❌ Error creando configuración de empleado:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
