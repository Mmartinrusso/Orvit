import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const supplierId = parseInt(params.id);
    const body = await request.json();
    const { name, contactPerson, phone, email, address } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Nombre es requerido' },
        { status: 400 }
      );
    }

    const updatedSupplier = await prisma.$queryRaw`
      UPDATE suppliers 
      SET 
        name = ${name}, 
        contact_person = ${contactPerson || null}, 
        phone = ${phone || null}, 
        email = ${email || null}, 
        address = ${address || null},
        updated_at = NOW()
      WHERE id = ${supplierId}
      RETURNING 
        id, 
        name, 
        contact_person as "contactPerson", 
        phone, 
        email, 
        address, 
        company_id as "companyId", 
        created_at as "createdAt", 
        updated_at as "updatedAt"
    `;

    if ((updatedSupplier as any[]).length === 0) {
      return NextResponse.json(
        { error: 'Proveedor no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json((updatedSupplier as any[])[0]);

  } catch (error) {
    console.error('Error actualizando proveedor:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const supplierId = parseInt(params.id);

    // Verificar si hay insumos asociados
    const suppliesWithSupplier = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM supplies WHERE supplier_id = ${supplierId}
    `;

    if ((suppliesWithSupplier as any[])[0].count > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar un proveedor que tiene insumos asociados' },
        { status: 400 }
      );
    }

    // Eliminar el proveedor
    const deletedSupplier = await prisma.$queryRaw`
      DELETE FROM suppliers WHERE id = ${supplierId}
      RETURNING id, name
    `;

    if ((deletedSupplier as any[]).length === 0) {
      return NextResponse.json(
        { error: 'Proveedor no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      message: 'Proveedor eliminado exitosamente',
      deletedSupplier: (deletedSupplier as any[])[0]
    });

  } catch (error) {
    console.error('Error eliminando proveedor:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
