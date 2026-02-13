import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Función helper para obtener usuario del token
async function getUserFromToken(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;

  try {
    // Por ahora simulamos un usuario activo
    const user = await prisma.user.findFirst({
      where: { isActive: true }
    });
    return user;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

// GET - Obtener todos los controles de la empresa
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const type = searchParams.get('type');
    const isActive = searchParams.get('isActive');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 });
    }

    const where: any = {
      companyId: parseInt(companyId)
    };

    if (type) {
      where.type = type;
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const controls = await prisma.control.findMany({
      where,
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(controls);
  } catch (error) {
    console.error('Error fetching controls:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST - Crear nuevo control
export async function POST(request: NextRequest) {
  try {
    // Obtener usuario activo
    const user = await prisma.user.findFirst({
      where: { isActive: true }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'No se encontró usuario activo' }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, type, companyId } = body;

    // Validaciones
    if (!name || !type || !companyId) {
      return NextResponse.json({ 
        error: 'Faltan campos requeridos: name, type, companyId' 
      }, { status: 400 });
    }

    // Validar que el tipo sea uno de los permitidos
    const validTypes = ['tax', 'quality', 'production', 'financial', 'compliance', 'custom'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ 
        error: `Tipo de control inválido. Debe ser uno de: ${validTypes.join(', ')}` 
      }, { status: 400 });
    }

    // Verificar que no exista un control con el mismo nombre y tipo para la empresa
    const existingControl = await prisma.control.findFirst({
      where: {
        companyId: parseInt(companyId),
        name: name.trim(),
        type: type
      }
    });

    if (existingControl) {
      return NextResponse.json({ 
        error: 'Ya existe un control con este nombre y tipo para esta empresa' 
      }, { status: 409 });
    }

    // Crear el control
    const control = await prisma.control.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        type: type,
        companyId: parseInt(companyId),
        createdBy: user.id,
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

    return NextResponse.json(control, { status: 201 });
  } catch (error) {
    console.error('Error creating control:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

