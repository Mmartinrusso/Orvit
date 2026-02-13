import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/recetas/[id] - Obtener una receta específica
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🔍 API Recetas GET by ID - Iniciando...');
    
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const recipeId = params.id;
    
    console.log('📥 Recipe ID:', recipeId, 'Company ID:', companyId);

    if (!companyId || !recipeId) {
      return NextResponse.json(
        { error: 'Recipe ID y Company ID son requeridos' },
        { status: 400 }
      );
    }

    // Obtener la receta con información completa
        const recipe = await prisma.$queryRaw`
          SELECT 
            r.id,
            r.name,
            r.product_id as "productId",
            p.name as "productName",
            r.subcategory_id as "subcategoryId",
            ps.name as "subcategoryName",
            r.base_type as "baseType",
            r.version,
            r.description,
            r.notes,
            r.output_quantity as "outputQuantity",
            r.output_unit_label as "outputUnitLabel",
            r.intermediate_quantity as "intermediateQuantity",
            r.intermediate_unit_label as "intermediateUnitLabel",
            r.metros_utiles as "metrosUtiles",
            r.cantidad_pastones as "cantidadPastones",
            r.is_active as "isActive",
            r.created_at as "createdAt",
            r.updated_at as "updatedAt"
          FROM recipes r
          LEFT JOIN products p ON r.product_id::integer = p.id
          LEFT JOIN product_subcategories ps ON r.subcategory_id = ps.id
          WHERE r.id = ${parseInt(recipeId)} AND r.company_id = ${parseInt(companyId)}
        `;

    if (!recipe || (recipe as any[]).length === 0) {
      return NextResponse.json(
        { error: 'Receta no encontrada' },
        { status: 404 }
      );
    }

    // Obtener los ingredientes de la receta (NO del banco)
    const ingredients = await prisma.$queryRaw`
      SELECT 
        ri.id,
        ri.supply_id as "supplyId",
        s.name as "supplyName",
        ri.quantity,
        ri.unit_measure as "unitMeasure",
        ri.pulsos,
        ri.kg_por_pulso as "kgPorPulso"
      FROM recipe_items ri
      LEFT JOIN supplies s ON ri.supply_id = s.id
      WHERE ri.recipe_id = ${parseInt(recipeId)} 
        AND ri.company_id = ${parseInt(companyId)}
        AND (ri.is_bank_ingredient = false OR ri.is_bank_ingredient IS NULL)
    `;

    // Obtener los ingredientes del banco por separado
    const bankIngredients = await prisma.$queryRaw`
      SELECT 
        ri.id,
        ri.supply_id as "supplyId",
        s.name as "supplyName",
        ri.quantity,
        ri.unit_measure as "unitMeasure",
        ri.pulsos,
        ri.kg_por_pulso as "kgPorPulso"
      FROM recipe_items ri
      LEFT JOIN supplies s ON ri.supply_id = s.id
      WHERE ri.recipe_id = ${parseInt(recipeId)} 
        AND ri.company_id = ${parseInt(companyId)}
        AND ri.is_bank_ingredient = true
    `;

    const recipeData = (recipe as any[])[0];
    recipeData.ingredients = ingredients;
    recipeData.bankIngredients = bankIngredients;

    console.log('📊 Receta obtenida:', recipeData);
    return NextResponse.json(recipeData);

  } catch (error) {
    console.error('❌ Error obteniendo receta:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/recetas/[id] - Actualizar una receta
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🔍 API Recetas PUT - Iniciando...');
    
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const recipeId = params.id;
    
    const body = await request.json();
    console.log('📥 Body recibido:', JSON.stringify(body, null, 2));
    
    const {
      name,
      productId,
      subcategoryId,
      baseType,
      version,
      description,
      outputQuantity,
      outputUnitLabel,
      intermediateQuantity,
      intermediateUnitLabel,
      unitsPerItem,
      ingredients,
      bankIngredients,
      isActive,
      metrosUtiles,
      cantidadPastones,
      notes
    } = body;

    if (!companyId || !recipeId) {
      return NextResponse.json(
        { error: 'Recipe ID y Company ID son requeridos' },
        { status: 400 }
      );
    }

    // Validar tipos de datos - outputQuantity solo es requerido para recetas que no son PER_BANK
    if (baseType !== 'PER_BANK' && outputQuantity !== undefined && typeof outputQuantity !== 'number' && isNaN(parseFloat(outputQuantity))) {
      return NextResponse.json(
        { error: 'outputQuantity debe ser un número válido' },
        { status: 400 }
      );
    }

    if (intermediateQuantity && typeof intermediateQuantity !== 'number' && isNaN(parseFloat(intermediateQuantity))) {
      return NextResponse.json(
        { error: 'intermediateQuantity debe ser un número válido' },
        { status: 400 }
      );
    }

    console.log('🔍 Validando ingredientes:', {
      isArray: Array.isArray(ingredients),
      length: ingredients?.length,
      ingredients: ingredients
    });

    // Validar campos requeridos para recetas PER_BANK
    if (baseType === 'PER_BANK') {
      console.log('🔍 Validando campos PER_BANK:', {
        metrosUtiles,
        metrosUtilesType: typeof metrosUtiles,
        cantidadPastones,
        cantidadPastonesType: typeof cantidadPastones
      });
      
      if (!metrosUtiles || isNaN(parseFloat(metrosUtiles))) {
        console.log('❌ Error: metrosUtiles inválido para receta PER_BANK');
        return NextResponse.json(
          { error: 'metrosUtiles es requerido para recetas PER_BANK' },
          { status: 400 }
        );
      }
      if (!cantidadPastones || isNaN(parseInt(cantidadPastones))) {
        console.log('❌ Error: cantidadPastones inválido para receta PER_BANK');
        return NextResponse.json(
          { error: 'cantidadPastones es requerido para recetas PER_BANK' },
          { status: 400 }
        );
      }
    }

    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      console.log('❌ Error: ingredientes inválidos');
      return NextResponse.json(
        { error: 'La receta debe ser un array válido con al menos un ingrediente' },
        { status: 400 }
      );
    }

    // Verificar que la receta existe y obtener sus datos actuales
    const existingRecipe = await prisma.$queryRaw`
      SELECT id, subcategory_id, product_id FROM recipes WHERE id = ${parseInt(recipeId)} AND company_id = ${parseInt(companyId)}
    `;

    if (!existingRecipe || (existingRecipe as any[]).length === 0) {
      return NextResponse.json(
        { error: 'Receta no encontrada' },
        { status: 404 }
      );
    }

    const currentRecipe = existingRecipe[0];
    console.log('📋 Receta actual:', currentRecipe);

    // Preservar subcategory_id y product_id si no se proporcionan nuevos valores
    const finalSubcategoryId = subcategoryId ? parseInt(subcategoryId) : currentRecipe.subcategory_id;
    const finalProductId = productId ? parseInt(productId) : currentRecipe.product_id;

    // Actualizar la receta
        // Construir la consulta de actualización dinámicamente según el tipo de receta
        if (baseType === 'PER_BANK') {
          // Para recetas "Por Banco", actualizar metros_utiles y cantidad_pastones
          await prisma.$executeRaw`
            UPDATE recipes SET
              name = ${name},
              product_id = ${finalProductId},
              subcategory_id = ${finalSubcategoryId},
              base_type = ${baseType},
              version = ${version},
              description = ${description || null},
              notes = ${notes || null},
              metros_utiles = ${metrosUtiles ? parseFloat(metrosUtiles) : null},
              cantidad_pastones = ${cantidadPastones ? parseInt(cantidadPastones) : null},
              is_active = ${isActive !== undefined ? isActive : true},
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ${parseInt(recipeId)} AND company_id = ${parseInt(companyId)}
          `;
        } else {
          // Para recetas normales, actualizar campos de configuración de rendimiento
          await prisma.$executeRaw`
            UPDATE recipes SET
              name = ${name},
              product_id = ${finalProductId},
              subcategory_id = ${finalSubcategoryId},
              base_type = ${baseType},
              version = ${version},
              description = ${description || null},
              notes = ${notes || null},
              output_quantity = ${parseFloat(outputQuantity)},
              output_unit_label = ${outputUnitLabel || 'unidades'},
              intermediate_quantity = ${intermediateQuantity ? parseFloat(intermediateQuantity) : null},
              intermediate_unit_label = ${intermediateUnitLabel || 'placas'},
              units_per_item = ${unitsPerItem ? parseFloat(unitsPerItem) : null},
              is_active = ${isActive !== undefined ? isActive : true},
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ${parseInt(recipeId)} AND company_id = ${parseInt(companyId)}
          `;
        }

    // Eliminar ingredientes existentes
    await prisma.$executeRaw`
      DELETE FROM recipe_items WHERE recipe_id = ${parseInt(recipeId)} AND company_id = ${parseInt(companyId)}
    `;

    // Crear nuevos ingredientes regulares
    for (const ingredient of ingredients) {
      // Calcular pulsos y kg/pulsos a partir de la cantidad en toneladas
      const toneladas = parseFloat(ingredient.quantity) || 0;
      const kilos = toneladas * 1000;
      const pulsos = ingredient.pulsos || 100; // Valor por defecto si no se proporciona
      const kgPorPulso = ingredient.kgPorPulso || (toneladas > 0 ? kilos / pulsos : 0);
      
      await prisma.$executeRaw`
        INSERT INTO recipe_items (
          recipe_id, supply_id, quantity, unit_measure, company_id, pulsos, kg_por_pulso, is_bank_ingredient
        ) VALUES (
          ${parseInt(recipeId)}, ${parseInt(ingredient.supplyId)}, ${parseFloat(ingredient.quantity)}, 
          ${ingredient.unitMeasure}, ${parseInt(companyId)}, ${parseInt(pulsos)}, ${parseFloat(kgPorPulso)}, false
        )
      `;
    }

    // Crear ingredientes del banco si existen
    if (bankIngredients && Array.isArray(bankIngredients) && bankIngredients.length > 0) {
      console.log('🏦 Procesando ingredientes del banco:', bankIngredients.length);
      for (const ingredient of bankIngredients) {
        // Calcular pulsos y kg/pulsos a partir de la cantidad en toneladas
        const toneladas = parseFloat(ingredient.quantity) || 0;
        const kilos = toneladas * 1000;
        const pulsos = ingredient.pulsos || 100; // Valor por defecto si no se proporciona
        const kgPorPulso = ingredient.kgPorPulso || (toneladas > 0 ? kilos / pulsos : 0);
        
        await prisma.$executeRaw`
          INSERT INTO recipe_items (
            recipe_id, supply_id, quantity, unit_measure, company_id, pulsos, kg_por_pulso, is_bank_ingredient
          ) VALUES (
            ${parseInt(recipeId)}, ${parseInt(ingredient.supplyId)}, ${parseFloat(ingredient.quantity)}, 
            ${ingredient.unitMeasure}, ${parseInt(companyId)}, ${parseInt(pulsos)}, ${parseFloat(kgPorPulso)}, true
          )
        `;
      }
    }

    // Registrar en historial
    await prisma.$executeRaw`
      INSERT INTO recipe_change_history (
        recipe_id, change_type, reason, company_id
      ) VALUES (
        ${parseInt(recipeId)}, 'receta_actualizada', 'Receta actualizada', ${parseInt(companyId)}
      )
    `;

    console.log('✅ Receta actualizada exitosamente');
    return NextResponse.json({
      success: true,
      message: 'Receta actualizada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error actualizando receta:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/recetas/[id] - Eliminar una receta
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🔍 API Recetas DELETE - Iniciando...');
    
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const recipeId = params.id;
    
    console.log('📥 Recipe ID:', recipeId, 'Company ID:', companyId);

    if (!companyId || !recipeId) {
      return NextResponse.json(
        { error: 'Recipe ID y Company ID son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que la receta existe
    const existingRecipe = await prisma.$queryRaw`
      SELECT id FROM recipes WHERE id = ${parseInt(recipeId)} AND company_id = ${parseInt(companyId)}
    `;

    if (!existingRecipe || (existingRecipe as any[]).length === 0) {
      return NextResponse.json(
        { error: 'Receta no encontrada' },
        { status: 404 }
      );
    }

    // Eliminar ingredientes primero
    await prisma.$executeRaw`
      DELETE FROM recipe_items WHERE recipe_id = ${parseInt(recipeId)} AND company_id = ${parseInt(companyId)}
    `;

    // Eliminar historial
    await prisma.$executeRaw`
      DELETE FROM recipe_change_history WHERE recipe_id = ${parseInt(recipeId)} AND company_id = ${parseInt(companyId)}
    `;

    // Eliminar la receta
    await prisma.$executeRaw`
      DELETE FROM recipes WHERE id = ${parseInt(recipeId)} AND company_id = ${parseInt(companyId)}
    `;

    console.log('✅ Receta eliminada exitosamente');
    return NextResponse.json({
      success: true,
      message: 'Receta eliminada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error eliminando receta:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
