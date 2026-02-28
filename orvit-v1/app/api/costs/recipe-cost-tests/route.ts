import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';
import { getUserAndCompany } from '@/lib/costs-auth';

export const dynamic = 'force-dynamic';


// POST /api/costs/recipe-cost-tests - Guardar una prueba de costos
export async function POST(request: NextRequest) {
  console.log('📝 POST /api/costs/recipe-cost-tests - Iniciando...');
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const auth = await getUserAndCompany();
    console.log('🔐 Auth obtenida:', { hasAuth: !!auth, companyId: auth?.companyId });
    if (!auth || !auth.companyId) {
      console.log('❌ No autorizado');
      return NextResponse.json({ error: 'No autorizado o sin empresa asociada' }, { status: 401 });
    }

    const body = await request.json();
    console.log('📦 Body recibido:', { 
      recipeId: body.recipeId, 
      testName: body.testName, 
      hasTestData: !!body.testData,
      totalCost: body.totalCost,
      costPerUnit: body.costPerUnit 
    });
    
    const { recipeId, testName, notes, testData, totalCost, costPerUnit } = body;

    // Validaciones
    if (!recipeId || !testName || !testData || totalCost === undefined || costPerUnit === undefined) {
      console.log('❌ Validación fallida:', {
        recipeId: !!recipeId,
        testName: !!testName,
        testData: !!testData,
        totalCost: totalCost !== undefined,
        costPerUnit: costPerUnit !== undefined
      });
      return NextResponse.json(
        { error: 'Faltan campos requeridos: recipeId, testName, testData, totalCost, costPerUnit' },
        { status: 400 }
      );
    }

    // Verificar que la receta existe y pertenece a la empresa
    // El componente Recetas.tsx usa el modelo viejo "recipes" (id como Int)
    // Intentamos buscar primero en recipes (viejo), y si no existe, en Recipe (nuevo)
    console.log('🔍 Buscando receta con ID:', recipeId, 'tipo:', typeof recipeId);
    
    // Convertir recipeId a número para buscar en el modelo viejo
    const recipeIdNum = typeof recipeId === 'number' ? recipeId : parseInt(recipeId.toString(), 10);
    
    // Buscar en el modelo viejo (recipes)
    let recipe = null;
    if (!isNaN(recipeIdNum)) {
      const recipesResult = await prisma.$queryRawUnsafe(`
        SELECT id FROM recipes 
        WHERE id = $1 AND company_id = $2
      `, recipeIdNum, auth.companyId);
      
      if (recipesResult && (recipesResult as any[]).length > 0) {
        recipe = { id: recipeIdNum.toString(), exists: true };
        console.log('✅ Receta encontrada en modelo viejo (recipes)');
      }
    }
    
    // Si no se encuentra en el modelo viejo, buscar en el modelo nuevo (Recipe)
    if (!recipe) {
      try {
        const newRecipe = await prisma.recipe.findFirst({
          where: {
            id: recipeId.toString(),
            companyId: auth.companyId
          }
        });
        if (newRecipe) {
          recipe = newRecipe;
          console.log('✅ Receta encontrada en modelo nuevo (Recipe)');
        }
      } catch (error) {
        console.log('⚠️ No se encontró en modelo nuevo:', error);
      }
    }

    if (!recipe) {
      console.log('❌ Receta no encontrada en ningún modelo');
      return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 });
    }

    // Convertir recipeId a número para guardar en recipe_id (Int)
    // Si el ID es un número, lo usamos directamente; si es UUID, guardamos 0
    let recipeIdInt = 0;
    try {
      if (typeof recipeId === 'number') {
        recipeIdInt = recipeId;
      } else {
        const parsed = parseInt(recipeId.toString(), 10);
        if (!isNaN(parsed)) {
          recipeIdInt = parsed;
        }
      }
    } catch (e) {
      console.log('⚠️ Error convirtiendo recipeId a número, usando 0');
      recipeIdInt = 0;
    }
    
    console.log('💾 Recipe ID a guardar:', recipeIdInt, 'Recipe ID original:', recipeId);

    // Crear la prueba usando el método estándar de Prisma
    // Agregar el recipeId original (UUID) al test_data para referencia
    const enhancedTestData = {
      ...testData,
      recipeId: recipeId.toString() // Guardar el UUID original
    };

    // Usar $queryRawUnsafe como alternativa si el modelo no está disponible
    try {
      const savedTest = await prisma.recipe_cost_tests.create({
        data: {
          recipe_id: recipeIdInt, // Usar el ID convertido (o 0 si es UUID)
          test_name: testName,
          notes: notes || null,
          test_data: enhancedTestData,
          total_cost: parseFloat(totalCost),
          cost_per_unit: parseFloat(costPerUnit),
          created_by: auth.user.id,
          company_id: auth.companyId,
        },
        select: {
          id: true,
          recipe_id: true,
          test_name: true,
          notes: true,
          test_data: true,
          total_cost: true,
          cost_per_unit: true,
          created_at: true,
          created_by: true,
          company_id: true,
        }
      });

      console.log('✅ Prueba guardada exitosamente (Prisma):', savedTest.id);
      return NextResponse.json(savedTest, { status: 201 });
    } catch (prismaError: any) {
      // Si falla con Prisma, intentar con SQL directo
      console.error('Error con Prisma create, intentando SQL directo:', prismaError);
      
      const result = await prisma.$queryRawUnsafe(`
        INSERT INTO recipe_cost_tests (
          recipe_id, test_name, notes, test_data, total_cost, cost_per_unit,
          created_by, company_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, recipe_id, test_name, notes, test_data, total_cost, 
                  cost_per_unit, created_at, created_by, company_id
      `,
        recipeIdInt,
        testName,
        notes || null,
        JSON.stringify(enhancedTestData),
        parseFloat(totalCost),
        parseFloat(costPerUnit),
        auth.user.id,
        auth.companyId
      );

      const savedTest = (result as any[])[0];
      console.log('✅ Prueba guardada exitosamente (SQL directo):', savedTest.id);
      return NextResponse.json(savedTest, { status: 201 });
    }
  } catch (error: any) {
    console.error('❌ Error guardando prueba de costos:', error);
    console.error('Stack:', error?.stack);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor', 
        details: error?.message || 'Error desconocido',
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}

// GET /api/costs/recipe-cost-tests - Obtener pruebas guardadas
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const auth = await getUserAndCompany();
    if (!auth || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado o sin empresa asociada' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const recipeId = searchParams.get('recipeId');

    let tests;
    if (recipeId) {
      // Obtener pruebas de una receta específica
      // Como recipe_id puede ser Int pero el ID de Recipe es String (UUID),
      // buscamos en test_data donde guardamos el recipeId original
      const recipeIdStr = recipeId.toString();
      const allTests = await prisma.recipe_cost_tests.findMany({
        where: {
          company_id: auth.companyId
        },
        orderBy: {
          created_at: 'desc'
        },
        select: {
          id: true,
          recipe_id: true,
          test_name: true,
          notes: true,
          test_data: true,
          total_cost: true,
          cost_per_unit: true,
          created_at: true,
          created_by: true,
          company_id: true,
        }
      });
      
      // Filtrar por recipeId que está guardado en test_data.recipeId
      tests = allTests.filter((test: any) => {
        const testData = test.test_data as any;
        // Intentar buscar tanto por ID numérico como por UUID string
        const matchesId = testData?.recipeId === recipeIdStr || 
                         testData?.recipeId?.toString() === recipeIdStr ||
                         test.recipe_id?.toString() === recipeIdStr;
        return matchesId;
      });
      
      console.log(`🔍 Pruebas encontradas para recipeId ${recipeIdStr}:`, tests.length);
    } else {
      // Obtener todas las pruebas de la empresa
      tests = await prisma.recipe_cost_tests.findMany({
        where: {
          company_id: auth.companyId
        },
        orderBy: {
          created_at: 'desc'
        },
        select: {
          id: true,
          recipe_id: true,
          test_name: true,
          notes: true,
          test_data: true,
          total_cost: true,
          cost_per_unit: true,
          created_at: true,
          created_by: true,
          company_id: true,
        }
      });
    }

    // Transformar los datos de snake_case a camelCase para el frontend
    const transformedTests = tests.map((test: any) => ({
      id: test.id,
      recipeId: test.recipe_id,
      testName: test.test_name,
      notes: test.notes,
      testData: test.test_data,
      totalCost: parseFloat(test.total_cost?.toString() || '0'),
      costPerUnit: parseFloat(test.cost_per_unit?.toString() || '0'),
      createdAt: test.created_at,
      createdBy: test.created_by,
      companyId: test.company_id,
    }));

    console.log('📋 Pruebas transformadas:', transformedTests.length);
    return NextResponse.json(transformedTests);
  } catch (error: any) {
    console.error('Error obteniendo pruebas de costos:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error?.message || 'Error desconocido',
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}