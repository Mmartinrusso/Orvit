import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// GET /api/tools/suppliers - Obtener todos los proveedores
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('tools.view');
    if (error) return error;

    // Obtener parámetros
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    let query = `
      SELECT * FROM "ToolSupplier" 
      WHERE "companyId" = ${parseInt(companyId)}
    `;

    // Agregar filtro de búsqueda si se proporciona
    if (search) {
      query += ` AND (
        name ILIKE '%${search}%' OR 
        contact ILIKE '%${search}%' OR 
        email ILIKE '%${search}%'
      )`;
    }

    query += ` ORDER BY name ASC`;

    const suppliers = await prisma.$queryRawUnsafe(query) as any[];

    return NextResponse.json({
      success: true,
      suppliers,
      total: suppliers.length
    });

  } catch (error) {
    console.error('Error en GET /api/tools/suppliers:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
  // ✅ OPTIMIZADO: Removido $disconnect()
}

// POST /api/tools/suppliers - Crear nuevo proveedor
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('tools.create');
    if (error) return error;

    const body = await request.json();
    const { name, contact, phone, email, companyId } = body;

    // Validaciones básicas
    if (!name || !companyId) {
      return NextResponse.json(
        { error: 'El nombre y companyId son requeridos' },
        { status: 400 }
      );
    }

    // Verificar si ya existe un proveedor con el mismo nombre
    const existingSupplier = await prisma.$queryRaw`
      SELECT id FROM "ToolSupplier" 
      WHERE name = ${name} AND "companyId" = ${parseInt(companyId)}
      LIMIT 1
    ` as any[];

    if (existingSupplier.length > 0) {
      return NextResponse.json(
        { error: 'Ya existe un proveedor con ese nombre' },
        { status: 400 }
      );
    }

    // Crear nuevo proveedor
    const newSupplier = await prisma.$queryRaw`
      INSERT INTO "ToolSupplier" (name, contact, phone, email, "companyId", "createdAt", "updatedAt")
      VALUES (${name}, ${contact || ''}, ${phone || ''}, ${email || ''}, ${parseInt(companyId)}, NOW(), NOW())
      RETURNING *
    ` as any[];

    return NextResponse.json({
      success: true,
      supplier: newSupplier[0],
      message: 'Proveedor creado exitosamente'
    });

  } catch (error) {
    console.error('Error en POST /api/tools/suppliers:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
  // ✅ OPTIMIZADO: Removido $disconnect()
} 