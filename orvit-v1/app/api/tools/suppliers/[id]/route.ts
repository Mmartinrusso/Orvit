import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/tools/suppliers/[id] - Obtener un proveedor específico
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supplierId = parseInt(params.id);
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }
    
    // Obtener proveedor específico
    const supplier = await prisma.toolSupplier.findFirst({
      where: {
        id: supplierId,
        companyId: parseInt(companyId)
      }
    });
    
    if (!supplier) {
      return NextResponse.json(
        { error: 'Proveedor no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      supplier: supplier
    });

  } catch (error) {
    console.error('Error en GET /api/tools/suppliers/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/tools/suppliers/[id] - Actualizar un proveedor
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supplierId = parseInt(params.id);
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }
    
    const { name, contact, phone, email } = body;

    // Validaciones básicas
    if (!name) {
      return NextResponse.json(
        { error: 'El nombre del proveedor es requerido' },
        { status: 400 }
      );
    }

    // Verificar que el proveedor existe y pertenece a la compañía
    const existingSupplier = await prisma.toolSupplier.findFirst({
      where: {
        id: supplierId,
        companyId: parseInt(companyId)
      }
    });

    if (!existingSupplier) {
      return NextResponse.json(
        { error: 'Proveedor no encontrado' },
        { status: 404 }
      );
    }

    // Verificar si ya existe otro proveedor con el mismo nombre
    const duplicateSupplier = await prisma.toolSupplier.findFirst({
      where: {
        name: name,
        companyId: parseInt(companyId),
        id: {
          not: supplierId
        }
      }
    });

    if (duplicateSupplier) {
      return NextResponse.json(
        { error: 'Ya existe un proveedor con ese nombre' },
        { status: 400 }
      );
    }

    // Actualizar proveedor
    const updatedSupplier = await prisma.toolSupplier.update({
      where: {
        id: supplierId
      },
      data: {
        name: name,
        contact: contact || '',
        phone: phone || '',
        email: email || ''
      }
    });

    return NextResponse.json({
      success: true,
      supplier: updatedSupplier,
      message: 'Proveedor actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error en PUT /api/tools/suppliers/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/tools/suppliers/[id] - Eliminar un proveedor
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supplierId = parseInt(params.id);
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }
    
    // Verificar que el proveedor existe y pertenece a la compañía
    const existingSupplier = await prisma.toolSupplier.findFirst({
      where: {
        id: supplierId,
        companyId: parseInt(companyId)
      }
    });

    if (!existingSupplier) {
      return NextResponse.json(
        { error: 'Proveedor no encontrado' },
        { status: 404 }
      );
    }

    // Verificar si el proveedor tiene herramientas asociadas
    const toolsUsingSupplier = await prisma.tool.count({
      where: {
        supplier: existingSupplier.name,
        companyId: parseInt(companyId)
      }
    });

    if (toolsUsingSupplier > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar el proveedor "${existingSupplier.name}" porque tiene ${toolsUsingSupplier} herramientas asociadas. Primero reasigna o elimina las herramientas.` },
        { status: 400 }
      );
    }

    // Eliminar el proveedor
    await prisma.toolSupplier.delete({
      where: {
        id: supplierId
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Proveedor eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error en DELETE /api/tools/suppliers/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 