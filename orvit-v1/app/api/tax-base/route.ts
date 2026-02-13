import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startPerf, endParse, startDb, endDb, startCompute, endCompute, startJson, endJson, withPerfHeaders } from '@/lib/perf';

export const dynamic = 'force-dynamic';


// GET - Obtener todas las bases de impuestos de la empresa
export async function GET(request: NextRequest) {
  const perfCtx = startPerf();
  const { searchParams } = new URL(request.url);
  
  try {
    // Por ahora, obtener el primer usuario activo sin autenticación
    const user = await prisma.user.findFirst({
      where: { isActive: true }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'No se encontró usuario activo' }, { status: 404 });
    }

    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 });
    }

    endParse(perfCtx);
    startDb(perfCtx);

    // ✨ FIX: Reducir payload - excluir taxRecords nested (se pueden obtener por separado)
    const taxBases = await prisma.taxBase.findMany({
      where: {
        companyId: parseInt(companyId),
        isActive: true
      },
      select: {
        id: true,
        name: true,
        description: true,
        recurringDay: true,
        companyId: true,
        isRecurring: true,
        isActive: true,
        notes: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        // ✨ FIX: Excluir taxRecords para reducir payload (se obtienen por separado)
        // taxRecords: {
        //   select: {
        //     id: true,
        //     month: true,
        //     status: true,
        //     amount: true
        //   }
        // }
      },
      orderBy: {
        name: 'asc'
      }
    });

    endDb(perfCtx);
    startCompute(perfCtx);
    endCompute(perfCtx);
    startJson(perfCtx);

    const response = NextResponse.json(taxBases);
    const metrics = endJson(perfCtx, taxBases);
    return withPerfHeaders(response, metrics, searchParams);
  } catch (error) {
    console.error('Error fetching tax bases:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST - Crear nueva base de impuesto
export async function POST(request: NextRequest) {
  try {
    // Por ahora, obtener el primer usuario activo sin autenticación
    const user = await prisma.user.findFirst({
      where: { isActive: true }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'No se encontró usuario activo' }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, recurringDay, companyId, notes } = body;

    if (!name || !recurringDay || !companyId) {
      return NextResponse.json({ 
        error: 'Faltan campos requeridos: name, recurringDay, companyId' 
      }, { status: 400 });
    }

    // Verificar si ya existe una base con el mismo nombre para esta empresa
    const existingBase = await prisma.taxBase.findFirst({
      where: {
        name: name,
        companyId: parseInt(companyId),
        isActive: true
      }
    });

    if (existingBase) {
      return NextResponse.json({ 
        error: 'Ya existe una base de impuesto con este nombre para esta empresa' 
      }, { status: 400 });
    }

    const taxBase = await prisma.taxBase.create({
      data: {
        name,
        description,
        recurringDay: parseInt(recurringDay),
        companyId: parseInt(companyId),
        createdBy: user.id,
        notes,
        isRecurring: true,
        isActive: true
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json(taxBase, { status: 201 });
  } catch (error) {
    console.error('Error creating tax base:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE - Eliminar una base de impuesto
export async function DELETE(request: NextRequest) {
  try {
    // Por ahora, obtener el primer usuario activo sin autenticación
    const user = await prisma.user.findFirst({
      where: { isActive: true }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'No se encontró usuario activo' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de base de impuesto es requerido' }, { status: 400 });
    }

    // Verificar que la base existe y pertenece a la empresa del usuario
    const taxBase = await prisma.taxBase.findUnique({
      where: { id: parseInt(id) },
      include: {
        company: true
      }
    });

    if (!taxBase) {
      return NextResponse.json({ error: 'Base de impuesto no encontrada' }, { status: 404 });
    }

    // Por ahora, permitir eliminación si el usuario está activo
    // TODO: Implementar verificación de permisos por empresa cuando esté disponible

            // Verificar si hay registros asociados
            const recordsCount = await prisma.taxRecord.count({
              where: { taxBaseId: parseInt(id) }
            });

            // Eliminar en cascada: primero los registros, luego la base
            if (recordsCount > 0) {
              // Eliminar todos los registros asociados
              await prisma.taxRecord.deleteMany({
                where: { taxBaseId: parseInt(id) }
              });
            }

            // Eliminar la base
            await prisma.taxBase.delete({
              where: { id: parseInt(id) }
            });

            return NextResponse.json({ 
              success: true, 
              message: `Base de impuesto eliminada exitosamente${recordsCount > 0 ? ` junto con ${recordsCount} registro${recordsCount !== 1 ? 's' : ''} asociado${recordsCount !== 1 ? 's' : ''}` : ''}` 
            });

  } catch (error) {
    console.error('Error deleting tax base:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
