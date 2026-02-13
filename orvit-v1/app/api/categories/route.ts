import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';


const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper function para obtener usuario desde JWT
async function getUserFromToken(request: NextRequest) {
  try {
    const token = cookies().get('token')?.value;
    
    if (!token) {
      console.log('❌ No hay token JWT');
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: {
            company: true
          }
        },
        ownedCompanies: true
      }
    });

    return user;
  } catch (error) {
    console.error('Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

// GET /api/categories - Obtener categorías de la empresa
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Obtener la empresa del usuario
    const userCompany = user.companies.find(uc => uc.isActive);

    if (!userCompany) {
      return NextResponse.json({ error: 'Usuario sin empresa asignada' }, { status: 400 });
    }

    const categories = await prisma.category.findMany({
      where: {
        companyId: userCompany.companyId,
        isActive: true
      },
      include: {
        _count: {
          select: {
            products: true
          }
        },
        children: {
          where: { isActive: true },
          orderBy: { name: 'asc' }
        },
        parent: {
          select: { id: true, name: true }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error in GET /api/categories:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/categories - Crear nueva categoría
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validaciones básicas
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      );
    }

    // Obtener la empresa del usuario
    const userCompany = user.companies.find(uc => uc.isActive);

    if (!userCompany) {
      return NextResponse.json({ error: 'Usuario sin empresa asignada' }, { status: 400 });
    }

    // Verificar que no existe otra categoría con el mismo nombre en la empresa
    const existingCategory = await prisma.category.findFirst({
      where: {
        companyId: userCompany.companyId,
        name: body.name.trim()
      }
    });

    if (existingCategory) {
      return NextResponse.json(
        { error: 'Ya existe una categoría con ese nombre' },
        { status: 400 }
      );
    }

    const newCategory = await prisma.category.create({
      data: {
        name: body.name.trim(),
        description: body.description?.trim() || null,
        companyId: userCompany.companyId,
        createdById: user.id,
        parentId: body.parentId ? parseInt(body.parentId) : null
      },
      include: {
        _count: {
          select: {
            products: true
          }
        },
        parent: {
          select: { id: true, name: true }
        }
      }
    });

    return NextResponse.json(newCategory, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/categories:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/categories - Actualizar categoría existente
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validaciones básicas
    if (!body.id || !body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'ID y nombre son requeridos' },
        { status: 400 }
      );
    }

    // Obtener la empresa del usuario
    const userCompany = user.companies.find(uc => uc.isActive);

    if (!userCompany) {
      return NextResponse.json({ error: 'Usuario sin empresa asignada' }, { status: 400 });
    }

    // Verificar que la categoría existe y pertenece a la empresa del usuario
    const existingCategory = await prisma.category.findFirst({
      where: {
        id: parseInt(body.id),
        companyId: userCompany.companyId
      }
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: 'Categoría no encontrada' },
        { status: 404 }
      );
    }

    // Verificar que no existe otra categoría con el mismo nombre en la empresa
    const duplicateCategory = await prisma.category.findFirst({
      where: {
        companyId: userCompany.companyId,
        name: body.name.trim(),
        id: { not: parseInt(body.id) }
      }
    });

    if (duplicateCategory) {
      return NextResponse.json(
        { error: 'Ya existe una categoría con ese nombre' },
        { status: 400 }
      );
    }

    const updatedCategory = await prisma.category.update({
      where: { id: parseInt(body.id) },
      data: {
        name: body.name.trim(),
        description: body.description?.trim() || null
      },
      include: {
        _count: {
          select: {
            products: true
          }
        }
      }
    });

    return NextResponse.json(updatedCategory);
  } catch (error) {
    console.error('Error in PUT /api/categories:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 