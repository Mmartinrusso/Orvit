import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Usar instancia global de prisma desde @/lib/prisma

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const productId = searchParams.get('productId');
    const includeIngredients = searchParams.get('includeIngredients') === 'true';

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 });
    }

    // ✅ MEGA OPTIMIZADO: Una sola query con filtro condicional usando parámetros preparados
    const recipes = productId 
      ? await prisma.$queryRaw<any[]>`
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
            r.units_per_item as "unitsPerItem",
            r.metros_utiles as "metrosUtiles",
            r.cantidad_pastones as "cantidadPastones",
            r.is_active as "isActive",
            r.created_at as "createdAt",
            r.updated_at as "updatedAt",
            (SELECT COUNT(*) FROM recipe_items WHERE recipe_id = r.id) as "ingredientCount"
          FROM recipes r
          LEFT JOIN products p ON r.product_id IS NOT NULL AND r.product_id ~ '^[0-9]+$' AND r.product_id::integer = p.id
          LEFT JOIN product_subcategories ps ON r.subcategory_id = ps.id
          WHERE r.company_id = ${parseInt(companyId)}
            AND r.product_id = ${productId}
          ORDER BY r.created_at DESC
        `
      : await prisma.$queryRaw<any[]>`
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
            r.units_per_item as "unitsPerItem",
            r.metros_utiles as "metrosUtiles",
            r.cantidad_pastones as "cantidadPastones",
            r.is_active as "isActive",
            r.created_at as "createdAt",
            r.updated_at as "updatedAt",
            (SELECT COUNT(*) FROM recipe_items WHERE recipe_id = r.id) as "ingredientCount"
          FROM recipes r
          LEFT JOIN products p ON r.product_id IS NOT NULL AND r.product_id ~ '^[0-9]+$' AND r.product_id::integer = p.id
          LEFT JOIN product_subcategories ps ON r.subcategory_id = ps.id
          WHERE r.company_id = ${parseInt(companyId)}
          ORDER BY r.created_at DESC
        `;
    
    // ✅ OPTIMIZACIÓN: Si se piden ingredientes, obtenerlos todos de una vez
    if (includeIngredients && recipes.length > 0) {
      const recipeIds = recipes.map(r => r.id);
      
      // ✅ MEGA OPTIMIZADO: Obtener todos los ingredientes de todas las recetas en una sola query con parámetros preparados
      let allIngredients: any[] = [];
      if (recipeIds.length > 0) {
        // Usar ANY con array para mejor rendimiento y seguridad
        allIngredients = await prisma.$queryRaw<any[]>`
          SELECT 
            ri.id,
            ri.recipe_id as "recipeId",
            ri.supply_id as "supplyId",
            s.name as "supplyName",
            ri.quantity,
            ri.unit_measure as "unitMeasure",
            ri.pulsos,
            ri.kg_por_pulso as "kgPorPulso",
            COALESCE(ri.is_bank_ingredient, false) as "isBankIngredient",
            (
              SELECT sp.price_per_unit + COALESCE(sp.freight_cost, 0)
              FROM supply_monthly_prices sp 
              WHERE sp.supply_id = ri.supply_id 
                AND sp.company_id = ${parseInt(companyId)}
              ORDER BY sp.fecha_imputacion DESC 
              LIMIT 1
            ) as "currentPrice"
          FROM recipe_items ri
          LEFT JOIN supplies s ON ri.supply_id = s.id
          WHERE ri.recipe_id = ANY(${recipeIds}::int[])
          ORDER BY ri.recipe_id, ri.id
        `;
      }
      
      // Agrupar ingredientes por receta
      const ingredientsByRecipe = new Map<number, any[]>();
      const bankIngredientsByRecipe = new Map<number, any[]>();
      
      for (const ing of allIngredients) {
        const recipeId = ing.recipeId;
        if (ing.isBankIngredient) {
          if (!bankIngredientsByRecipe.has(recipeId)) {
            bankIngredientsByRecipe.set(recipeId, []);
          }
          bankIngredientsByRecipe.get(recipeId)!.push(ing);
        } else {
          if (!ingredientsByRecipe.has(recipeId)) {
            ingredientsByRecipe.set(recipeId, []);
          }
          ingredientsByRecipe.get(recipeId)!.push(ing);
        }
      }
      
      // Agregar ingredientes a cada receta
      for (const recipe of recipes) {
        recipe.ingredients = ingredientsByRecipe.get(recipe.id) || [];
        recipe.bankIngredients = bankIngredientsByRecipe.get(recipe.id) || [];
        recipe.ingredientCount = Number(recipe.ingredientCount) || 0;
      }
    } else {
      // Convertir ingredientCount a número
      for (const recipe of recipes) {
        recipe.ingredientCount = Number(recipe.ingredientCount) || 0;
      }
    }

    return NextResponse.json(recipes);

  } catch (error) {
    console.error('❌ Error obteniendo recetas:', error);
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      name: error instanceof Error ? error.name : 'Unknown error type'
    });
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 API Recetas POST - Iniciando...');
    
    const body = await request.json();
    console.log('📥 Body recibido:', JSON.stringify(body, null, 2));
    
    const {
      name,
      productId,
      subcategoryId,
      baseType,
      version,
      description,
      notes,
      outputQuantity,
      outputUnitLabel,
      intermediateQuantity,
      intermediateUnitLabel,
      unitsPerItem,
      ingredients,
      bankIngredients = [], // Insumos del banco (por defecto array vacío)
      companyId,
      metrosUtiles,
      cantidadPastones
    } = body;

    console.log('🔍 Datos extraídos:');
    console.log('- name:', name);
    console.log('- productId:', productId, 'tipo:', typeof productId);
    console.log('- subcategoryId:', subcategoryId, 'tipo:', typeof subcategoryId);
    console.log('- baseType:', baseType);
    console.log('- version:', version);
    console.log('- outputQuantity:', outputQuantity);
    console.log('- companyId:', companyId, 'tipo:', typeof companyId);
    console.log('- metrosUtiles:', metrosUtiles, 'tipo:', typeof metrosUtiles);
    console.log('- cantidadPastones:', cantidadPastones, 'tipo:', typeof cantidadPastones);
    console.log('- ingredients:', ingredients);
    console.log('- ingredients.length:', ingredients?.length);

    // Validaciones básicas
    if (!name || !baseType || !version || !companyId) {
      console.log('❌ Validación falló - campos básicos faltantes');
      return NextResponse.json(
        { error: 'Nombre, tipo base, versión y companyId son requeridos' },
        { status: 400 }
      );
    }

    // Validación de cantidad de salida solo para recetas que NO son "Por Banco"
    if (baseType !== 'PER_BANK' && !outputQuantity) {
      console.log('❌ Validación falló - cantidad de salida faltante');
      return NextResponse.json(
        { error: 'La cantidad de salida es requerida para este tipo de receta' },
        { status: 400 }
      );
    }

    // Debe tener producto O subcategoría
    if (!productId && !subcategoryId) {
      console.log('❌ Validación falló - debe especificar producto o subcategoría');
      return NextResponse.json(
        { error: 'Debe especificar un producto o una subcategoría' },
        { status: 400 }
      );
    }

    // Validación especial para recetas "Por Banco"
    if (baseType === 'PER_BANK') {
      if (!metrosUtiles || !cantidadPastones) {
        console.log('❌ Validación falló - campos de banco faltantes');
        return NextResponse.json(
          { error: 'Para recetas "Por Banco" debe especificar metros útiles y cantidad de pastones' },
          { status: 400 }
        );
      }
    }

    if (!ingredients || ingredients.length === 0) {
      console.log('❌ Validación falló - no hay ingredientes');
      return NextResponse.json(
        { error: 'La receta debe tener al menos un insumo' },
        { status: 400 }
      );
    }
    
    console.log('✅ Validaciones pasaron');

    // Verificar que el producto o subcategoría existe
    if (productId) {
      console.log('🔍 Verificando producto...');
      console.log('- Buscando producto con ID:', productId);
      console.log('- Company ID:', companyId);
      
      const product = await prisma.$queryRaw`
        SELECT id FROM products WHERE id = ${parseInt(productId)} AND company_id = ${parseInt(companyId)}
      `;
      
      console.log('📊 Resultado de búsqueda de producto:', product);

      if (!product || (product as any[]).length === 0) {
        console.log('❌ Producto no encontrado');
        return NextResponse.json(
          { error: 'Producto no encontrado' },
          { status: 404 }
        );
      }
      
      console.log('✅ Producto encontrado:', (product as any[])[0]);
    } else if (subcategoryId) {
      console.log('🔍 Verificando subcategoría...');
      console.log('- Buscando subcategoría con ID:', subcategoryId);
      console.log('- Company ID:', companyId);
      
      const subcategory = await prisma.$queryRaw`
        SELECT id FROM product_subcategories WHERE id = ${parseInt(subcategoryId)} AND company_id = ${parseInt(companyId)}
      `;
      
      console.log('📊 Resultado de búsqueda de subcategoría:', subcategory);

      if (!subcategory || (subcategory as any[]).length === 0) {
        console.log('❌ Subcategoría no encontrada');
        return NextResponse.json(
          { error: 'Subcategoría no encontrada' },
          { status: 404 }
        );
      }
      
      console.log('✅ Subcategoría encontrada:', (subcategory as any[])[0]);
    }

    // Crear la receta
    console.log('🔍 Creando receta en la base de datos...');
    
    // Construir la consulta SQL dinámicamente según el tipo de receta
    let insertQuery;
    let insertValues;
    
    if (baseType === 'PER_BANK') {
      // Para recetas "Por Banco", incluir metros_utiles y cantidad_pastones
      insertQuery = `
        INSERT INTO recipes (
          name, product_id, subcategory_id, base_type, version, description, notes,
          metros_utiles, cantidad_pastones, company_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        ) RETURNING id
      `;
      insertValues = [
        name,
        productId ? parseInt(productId) : null,
        subcategoryId ? parseInt(subcategoryId) : null,
        baseType,
        version,
        description || null,
        notes || null,
        metrosUtiles ? parseFloat(metrosUtiles) : null,
        cantidadPastones ? parseInt(cantidadPastones) : null,
        parseInt(companyId)
      ];
    } else {
      // Para recetas normales, incluir todos los campos
      insertQuery = `
        INSERT INTO recipes (
          name, product_id, subcategory_id, base_type, version, description, notes,
          output_quantity, output_unit_label, intermediate_quantity, intermediate_unit_label, units_per_item,
          company_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        ) RETURNING id
      `;
      insertValues = [
        name,
        productId ? parseInt(productId) : null,
        subcategoryId ? parseInt(subcategoryId) : null,
        baseType,
        version,
        description || null,
        notes || null,
        outputQuantity,
        outputUnitLabel || 'unidades',
        intermediateQuantity || null,
        intermediateUnitLabel || 'placas',
        unitsPerItem || null,
        parseInt(companyId)
      ];
    }
    
    const recipe = await prisma.$queryRawUnsafe(insertQuery, ...insertValues);
    
    console.log('📊 Receta creada:', recipe);

    const recipeId = (recipe as any[])[0].id;
    console.log('✅ ID de receta generado:', recipeId);

    // Crear los insumos de la receta
    console.log('🔍 Creando ingredientes de la receta...');
    console.log('- Total de ingredientes a crear:', ingredients.length);
    
    for (const ingredient of ingredients) {
      console.log('📝 Creando ingrediente:', ingredient);
      
      // Calcular pulsos y kg/pulsos a partir de la cantidad en toneladas
      const toneladas = parseFloat(ingredient.quantity) || 0;
      const kilos = toneladas * 1000;
      const pulsos = ingredient.pulsos || 100; // Valor por defecto si no se proporciona
      const kgPorPulso = ingredient.kgPorPulso || (toneladas > 0 ? kilos / pulsos : 0);
      
      await prisma.$queryRaw`
        INSERT INTO recipe_items (
          recipe_id, supply_id, quantity, unit_measure, company_id, pulsos, kg_por_pulso
        ) VALUES (
          ${recipeId}, ${ingredient.supplyId}, ${ingredient.quantity}, ${ingredient.unitMeasure}, 
          ${parseInt(companyId)}, ${parseInt(pulsos)}, ${parseFloat(kgPorPulso)}
        )
      `;
      
      console.log('✅ Ingrediente creado:', ingredient.supplyName, 'con pulsos:', pulsos, 'kg/pulso:', kgPorPulso);
    }
    
    console.log('✅ Todos los ingredientes creados');

    // Insertar insumos del banco (solo para recetas "Por Banco")
    console.log('🔍 Insertando insumos del banco:', bankIngredients.length);
    for (const ingredient of bankIngredients) {
      console.log('🔍 Procesando insumo del banco:', ingredient.supplyName);
      
      // Calcular pulsos y kg/pulsos a partir de la cantidad en toneladas
      const toneladas = parseFloat(ingredient.quantity) || 0;
      const kilos = toneladas * 1000;
      const pulsos = ingredient.pulsos || 100; // Valor por defecto si no se proporciona
      const kgPorPulso = ingredient.kgPorPulso || (toneladas > 0 ? kilos / pulsos : 0);
      
      await prisma.$queryRaw`
        INSERT INTO recipe_items (
          recipe_id, supply_id, quantity, unit_measure, company_id, pulsos, kg_por_pulso, is_bank_ingredient
        ) VALUES (
          ${recipeId}, ${ingredient.supplyId}, ${ingredient.quantity}, ${ingredient.unitMeasure}, 
          ${parseInt(companyId)}, ${parseInt(pulsos)}, ${parseFloat(kgPorPulso)}, true
        )
      `;
      
      console.log('✅ Insumo del banco creado:', ingredient.supplyName, 'con pulsos:', pulsos, 'kg/pulso:', kgPorPulso);
    }
    
    console.log('✅ Todos los insumos del banco creados');

    // Registrar en historial
    await prisma.$queryRaw`
      INSERT INTO recipe_change_history (
        recipe_id, change_type, reason, company_id
      ) VALUES (
        ${recipeId}, 'receta_creada', 'Nueva receta creada', ${parseInt(companyId)}
      )
    `;

    console.log('🎉 Receta creada exitosamente con ID:', recipeId);
    
    return NextResponse.json({
      success: true,
      message: 'Receta creada exitosamente',
      recipeId
    });

  } catch (error: any) {
    console.error('❌ Error creando receta:', error);
    console.error('❌ Error details:', {
      message: error?.message || 'Unknown error',
      stack: error?.stack || 'No stack trace',
      name: error?.name || 'Unknown error type',
      code: error?.code,
      constraint: error?.meta?.target,
      field: error?.meta?.field_name
    });

    const isDevelopment = process.env.NODE_ENV === 'development';
    const errorMessage = error?.message || 'Error desconocido';
    
    // Detectar errores de constraint único (versión duplicada)
    if (error?.code === '23505' || errorMessage.includes('unique constraint') || errorMessage.includes('duplicate key')) {
      return NextResponse.json(
        { 
          error: 'Ya existe una receta con el mismo nombre, versión y producto. Por favor, usa una versión diferente.',
          details: isDevelopment ? errorMessage : undefined
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        ...(isDevelopment && {
          details: errorMessage,
          stack: error?.stack
        })
      },
      { status: 500 }
    );
  }
}