import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Usar instancia global de prisma desde @/lib/prisma

// Almacenamiento temporal de categorías creadas (en producción esto debería ser una tabla)
const tempCategories = new Map<number, Set<string>>();

// GET /api/tools/categories
export async function GET(request: NextRequest) {
  try {
    // Obtener companyId de los headers o query params
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    // Obtener categorías únicas de la tabla Tool
    const categories = await prisma.tool.groupBy({
      by: ['category'],
      where: {
        companyId: parseInt(companyId),
        category: {
          not: null
        }
      },
      _count: {
        category: true
      }
    });

    // Transformar el resultado al formato esperado
    const categoriesWithCount = categories.map(cat => ({
      id: cat.category,
      name: cat.category,
      toolCount: cat._count.category
    }));

    // Agregar categorías temporales que no tienen herramientas
    const companyTempCategories = tempCategories.get(parseInt(companyId)) || new Set();
    companyTempCategories.forEach(catName => {
      // Solo agregar si no existe ya en las categorías de herramientas
      if (!categoriesWithCount.find(cat => cat.name === catName)) {
        categoriesWithCount.push({
          id: catName,
          name: catName,
          toolCount: 0
        });
      }
    });

    return NextResponse.json({
      success: true,
      categories: categoriesWithCount,
      total: categoriesWithCount.length
    });

  } catch (error) {
    console.error('Error en GET /api/tools/categories:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
  // ✅ OPTIMIZADO: Removido $disconnect()
}

// POST /api/tools/categories
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, companyId } = body;

    if (!name || !companyId) {
      return NextResponse.json(
        { error: 'El nombre y companyId son requeridos' },
        { status: 400 }
      );
    }

    // Verificar si ya existe una herramienta con esa categoría
    const existingTool = await prisma.tool.findFirst({
      where: {
        category: name,
        companyId: parseInt(companyId)
      }
    });

    if (existingTool) {
      return NextResponse.json(
        { error: 'Ya existe una categoría con ese nombre' },
        { status: 400 }
      );
    }

    // Agregar la categoría al almacenamiento temporal
    const companyIdInt = parseInt(companyId);
    if (!tempCategories.has(companyIdInt)) {
      tempCategories.set(companyIdInt, new Set());
    }
    tempCategories.get(companyIdInt)!.add(name);

    const newCategory = {
      id: name,
        name: name,
        description: description || '',
      toolCount: 0
    };

    return NextResponse.json({
      success: true,
      category: newCategory,
      message: 'Categoría creada exitosamente'
    }, { status: 201 });

  } catch (error) {
    console.error('Error en POST /api/tools/categories:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
  // ✅ OPTIMIZADO: Removido $disconnect()
} 