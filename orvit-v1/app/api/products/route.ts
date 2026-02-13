import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth/getAuthFromRequest';
import { validateRequest } from '@/lib/validations/helpers';
import { CreateProductSchema, UpdateProductSchema } from '@/lib/validations/products';
import { cached, invalidateCache } from '@/lib/cache/cache-manager';
import { comprasKeys, invalidationPatterns, TTL } from '@/lib/cache/cache-keys';
import { purifyText } from '@/lib/validation/sanitization';

export const dynamic = 'force-dynamic';

// GET /api/products - Obtener lista de productos (ventas + costos)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyIdParam = searchParams.get('companyId');
    const companyId = companyIdParam ? parseInt(companyIdParam) : 1;
    const cacheKey = comprasKeys.productCatalog(companyId);

    const allProducts = await cached(cacheKey, async () => {
    // Obtener productos de ventas (tabla Product)
    let ventasProducts: any[] = [];
    try {
      ventasProducts = await prisma.product.findMany({
        where: {
          companyId: companyId,
          isActive: true
        },
        include: {
          category: true,
          productionSector: {
            select: { id: true, name: true }
          },
        },
        orderBy: {
          name: 'asc'
        }
      });

      // Intentar cargar relaciones adicionales si existen
      for (const product of ventasProducts) {
        if (product.recipeId) {
          try {
            const recipe = await prisma.recipe.findUnique({
              where: { id: product.recipeId },
              select: { id: true, name: true, totalCost: true }
            });
            product.recipe = recipe;
          } catch (e) {
            // Ignorar si no existe
          }
        }
        if (product.purchaseInputId) {
          try {
            const input = await prisma.inputItem.findUnique({
              where: { id: product.purchaseInputId },
              select: { id: true, name: true, currentPrice: true, supplier: true }
            });
            product.purchaseInput = input;
          } catch (e) {
            // Ignorar si no existe
          }
        }
      }
    } catch (error) {
      console.error('Error obteniendo productos de ventas:', error);
      ventasProducts = [];
    }

    // Obtener productos de costos (tabla products)
    // Intentar incluir location, weight, volume y volume_unit si existen las columnas
    let costosProducts: any[];
    try {
      costosProducts = await prisma.$queryRaw`
        SELECT 
          p.id,
          p.name,
          p.description,
          p.sku as code,
          p.category_id as "categoryId",
          p.subcategory_id as "subcategoryId",
          p.company_id as "companyId",
          p.unit_price as "costPrice",
          p.unit_cost as "unitCost",
          p.stock_quantity as "currentStock",
          p.min_stock_level as "minStock",
          p.is_active as "isActive",
          p.created_at as "createdAt",
          p.updated_at as "updatedAt",
          COALESCE(p.location, '') as location,
          COALESCE(p.weight, 0) as weight,
          COALESCE(p.volume, 0) as volume,
          COALESCE(p.volume_unit, 'metros_lineales') as "volumeUnit",
          COALESCE(p.images, '[]'::jsonb) as images,
          pc.name as "categoryName"
        FROM products p
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        WHERE p.company_id = ${companyId}
        AND p.is_active = true
        ORDER BY p.name
      ` as any[];
    } catch (error) {
      // Si falla porque no existen algunas columnas, intentar sin ellas
      const errMsg = error instanceof Error ? error.message : '';
      if (errMsg.includes('column')) {
        console.log('⚠️ [PRODUCTS API] Algunas columnas no existen en products, obteniendo sin ellas');
        try {
          costosProducts = await prisma.$queryRaw`
            SELECT
              p.id,
              p.name,
              p.description,
              p.sku as code,
              p.category_id as "categoryId",
              p.subcategory_id as "subcategoryId",
              p.company_id as "companyId",
              p.unit_price as "costPrice",
              p.unit_cost as "unitCost",
              p.stock_quantity as "currentStock",
              p.min_stock_level as "minStock",
              p.is_active as "isActive",
              p.created_at as "createdAt",
              p.updated_at as "updatedAt",
              COALESCE(p.location, '') as location,
              COALESCE(p.images, '[]'::jsonb) as images,
              pc.name as "categoryName"
            FROM products p
            LEFT JOIN product_categories pc ON p.category_id = pc.id
            WHERE p.company_id = ${companyId}
            AND p.is_active = true
            ORDER BY p.name
          ` as any[];
        } catch (error2) {
          // Si location tampoco existe, obtener sin location ni weight/volume
          const err2Msg = error2 instanceof Error ? error2.message : '';
          if (err2Msg.includes('column') && err2Msg.includes('location')) {
            console.log('⚠️ [PRODUCTS API] Columna location no existe, obteniendo sin location ni weight/volume');
            costosProducts = await prisma.$queryRaw`
              SELECT 
                p.id,
                p.name,
                p.description,
                p.sku as code,
                p.category_id as "categoryId",
                p.subcategory_id as "subcategoryId",
                p.company_id as "companyId",
                p.unit_price as "costPrice",
                p.unit_cost as "unitCost",
                p.stock_quantity as "currentStock",
                p.min_stock_level as "minStock",
                p.is_active as "isActive",
                p.created_at as "createdAt",
                p.updated_at as "updatedAt",
                COALESCE(p.images, '[]'::jsonb) as images,
                pc.name as "categoryName"
              FROM products p
              LEFT JOIN product_categories pc ON p.category_id = pc.id
              WHERE p.company_id = ${companyId}
              AND p.is_active = true
              ORDER BY p.name
            ` as any[];
          } else {
            throw error2;
          }
        }
      } else {
        throw error;
      }
    }

    // Transformar productos de ventas
    const transformedVentasProducts = ventasProducts.map(product => ({
      ...product,
      images: product.images ? (product.images as string[]) : [],
      files: product.files ? (product.files as string[]) : [],
      volumeUnit: product.volumeUnit || 'metros_lineales',
      costType: product.costType || 'MANUAL',
      costCurrency: product.costCurrency || 'ARS',
      weightedAverageCost: product.weightedAverageCost,
      lastCostUpdate: product.lastCostUpdate,
      recipe: product.recipe,
      purchaseInput: product.purchaseInput,
      source: 'ventas'
    }));

    // Transformar productos de costos para que coincidan con la estructura de ventas
    console.log('🖼️ [PRODUCTS API] Transformando productos de costos, total:', costosProducts.length);
    const transformedCostosProducts = costosProducts.map((product: any) => {
      // Debug: verificar imágenes antes de transformar
      if (product.images) {
        console.log('🖼️ [PRODUCTS API] Producto con imágenes raw:', product.name, 'images:', product.images, 'tipo:', typeof product.images);
      }
      return {
      id: `costos-${product.id}`,
      name: product.name,
      code: product.code || product.sku || '',
      description: product.description || '',
      categoryId: product.categoryId,
      unit: 'unidad',
      costPrice: parseFloat(product.costPrice || product.unit_price || 0),
      minStock: product.minStock || product.min_stock_level || 0,
      currentStock: product.currentStock || product.stock_quantity || 0,
      volume: parseFloat(product.volume || 0),
      weight: parseFloat(product.weight || 0),
      location: product.location || '',
      blocksPerM2: null,
      isActive: product.isActive !== false,
      images: (() => {
        try {
          if (!product.images) return [];
          if (Array.isArray(product.images)) return product.images;
          if (typeof product.images === 'string') {
            const parsed = JSON.parse(product.images);
            return Array.isArray(parsed) ? parsed : [];
          }
          return [];
        } catch (error) {
          console.error('❌ [PRODUCTS API] Error parseando imágenes:', error, 'product.images:', product.images);
          return [];
        }
      })(),
      files: [],
      companyId: product.companyId,
      createdById: 0,
      createdAt: product.createdAt || new Date(),
      updatedAt: product.updatedAt || new Date(),
      category: product.categoryName ? { id: product.categoryId, name: product.categoryName } : null,
      volumeUnit: (product.volumeUnit || 'metros_lineales') as 'metros_lineales' | 'metros_cuadrados',
      source: 'costos'
      };
    });

    // Combinar y eliminar duplicados por nombre (preferir ventas si hay duplicado)
    const combined = [...transformedVentasProducts];
    const ventasNames = new Set(transformedVentasProducts.map(p => p.name.toLowerCase()));

    transformedCostosProducts.forEach(costosProduct => {
      if (!ventasNames.has(costosProduct.name.toLowerCase())) {
        combined.push(costosProduct);
      }
    });

    return combined;
    }, TTL.MEDIUM);

    return NextResponse.json(allProducts);
  } catch (error) {
    console.error('Error in GET /api/products:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/products - Crear nuevo producto
export async function POST(request: NextRequest) {
  try {
    // Obtener autenticacion
    const auth = await getAuthFromRequest(request);
    const companyId = auth?.companyId || 1;
    const userId = auth?.userId || 1;

    const body = await request.json();
    const validation = validateRequest(CreateProductSchema, body);
    if (!validation.success) return validation.response;

    const validatedData = validation.data;

    // Verificar que el código no exista en la empresa
    const existingProduct = await prisma.product.findFirst({
      where: {
        companyId: companyId,
        code: validatedData.code
      }
    });

    if (existingProduct) {
      return NextResponse.json(
        { error: 'Ya existe un producto con ese código' },
        { status: 400 }
      );
    }

    // Verificar que la categoría existe y pertenece a la empresa
    const category = await prisma.category.findFirst({
      where: {
        id: validatedData.categoryId as number,
        companyId: companyId,
        isActive: true
      }
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Categoría no válida' },
        { status: 400 }
      );
    }

    const locationValue = (validatedData.location || '').trim();

    const costType = validatedData.costType;
    const recipeId = validatedData.recipeId || null;
    const purchaseInputId = validatedData.purchaseInputId || null;

    const newProduct = await prisma.product.create({
      data: {
        name: validatedData.name,
        code: validatedData.code,
        description: validatedData.description || '',
        categoryId: validatedData.categoryId as number,
        unit: validatedData.unit,
        costPrice: validatedData.costPrice ?? 0,
        costCurrency: validatedData.costCurrency,
        minStock: validatedData.minStock ?? 0,
        currentStock: validatedData.currentStock ?? 0,
        volume: validatedData.volume ?? 0,
        weight: validatedData.weight ?? 0,
        location: locationValue || '',
        blocksPerM2: validatedData.blocksPerM2 ?? null,
        isActive: validatedData.isActive,
        images: validatedData.images || [],
        files: validatedData.files || [],
        companyId: companyId,
        createdById: userId,
        costType: costType,
        recipeId: recipeId,
        purchaseInputId: purchaseInputId,
        weightedAverageCost: costType === 'PURCHASE' ? (validatedData.costPrice ?? 0) : null,
        costCalculationStock: costType === 'PURCHASE' ? (validatedData.currentStock ?? 0) : null,
        lastCostUpdate: new Date(),
        salePrice: validatedData.salePrice ?? null,
        saleCurrency: validatedData.saleCurrency,
        marginMin: validatedData.marginMin ?? null,
        marginMax: validatedData.marginMax ?? null,
        barcode: validatedData.barcode ?? null,
        sku: validatedData.sku ?? null,
        trackBatches: validatedData.trackBatches,
        trackExpiration: validatedData.trackExpiration,
        tags: validatedData.tags || [],
        productionSectorId: validatedData.productionSectorId ?? null,
      },
      include: {
        category: true,
        recipe: costType === 'PRODUCTION' ? { select: { id: true, name: true } } : false,
        purchaseInput: costType === 'PURCHASE' ? { select: { id: true, name: true, currentPrice: true } } : false,
      }
    });

    // Si es tipo PRODUCTION, calcular costo desde receta
    if (costType === 'PRODUCTION' && recipeId) {
      try {
        const { updateCostFromRecipe } = await import('@/lib/services/product-cost');
        await updateCostFromRecipe({
          productId: newProduct.id,
          recipeId: recipeId,
          userId: userId,
          notes: 'Costo inicial calculado desde receta',
        });
      } catch (error) {
        console.error('Error calculando costo desde receta:', error);
      }
    }

    // Transformar datos para la respuesta
    const transformedProduct = {
      ...newProduct,
      images: newProduct.images ? (newProduct.images as string[]) : [],
      files: newProduct.files ? (newProduct.files as string[]) : [],
      volumeUnit: validatedData.volumeUnit || 'metros_lineales'
    };

    // Invalidar cache de productos
    await invalidateCache(invalidationPatterns.products(companyId));

    return NextResponse.json(transformedProduct, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/products:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/products - Actualizar producto existente
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyIdParam = searchParams.get('companyId');
    const companyId = companyIdParam ? parseInt(companyIdParam) : 1;
    const userId = 1; // TODO: Obtener del token JWT

    const body = await request.json();
    
    if (!body.id) {
      return NextResponse.json(
        { error: 'ID del producto es requerido' },
        { status: 400 }
      );
    }

    // Verificar si es un producto de ventas o costos
    const productId = String(body.id);
    const isCostosProduct = productId.startsWith('costos-');
    const numericId = isCostosProduct 
      ? parseInt(productId.replace('costos-', ''))
      : (productId.startsWith('ventas-') ? parseInt(productId.replace('ventas-', '')) : parseInt(productId));

    if (isCostosProduct) {
      // Actualizar producto de costos
      const locationValue = purifyText(body.location || '');
      // Sanitizar campos de texto antes de $executeRaw
      const sanitizedName = purifyText(body.name || '');
      const sanitizedDescription = purifyText(body.description || '');
      console.log('💾 [PRODUCTS API] Actualizando producto de costos ID:', numericId);
      console.log('💾 [PRODUCTS API] Ubicación recibida:', body.location);
      console.log('💾 [PRODUCTS API] Ubicación procesada:', locationValue);
      
      // Intentar actualizar con location, weight, volume y volumeUnit si existen las columnas
      let updated;
      const weightValue = parseFloat(body.weight || 0);
      const volumeValue = parseFloat(body.volume || 0);
      const volumeUnitValue = body.volumeUnit || 'metros_lineales';
      
      try {
        // Primero intentar actualizar con todas las columnas nuevas
        // Convertir imágenes a JSON para PostgreSQL
        const imagesJson = body.images && Array.isArray(body.images) && body.images.length > 0
          ? JSON.stringify(body.images)
          : null;
        
        updated = await prisma.$executeRaw`
          UPDATE products
          SET
            name = ${sanitizedName},
            description = ${sanitizedDescription},
            unit_price = ${parseFloat(body.costPrice || 0)},
            stock_quantity = ${parseInt(body.currentStock || 0)},
            min_stock_level = ${parseInt(body.minStock || 0)},
            is_active = ${body.isActive !== false},
            location = ${locationValue || ''},
            weight = ${weightValue},
            volume = ${volumeValue},
            volume_unit = ${volumeUnitValue},
            images = ${imagesJson}::jsonb,
            updated_at = NOW()
          WHERE id = ${numericId}
          AND company_id = ${companyId}
        `;
      } catch (error) {
        // Si falla porque no existen las columnas, intentar actualizar solo con location
        const errMsg = error instanceof Error ? error.message : '';
        if (errMsg.includes('column') && (errMsg.includes('location') || errMsg.includes('weight') || errMsg.includes('volume') || errMsg.includes('volume_unit'))) {
          console.log('⚠️ [PRODUCTS API] Algunas columnas no existen, intentando actualizar sin ellas');
          try {
            // Intentar con location pero sin weight/volume
            updated = await prisma.$executeRaw`
              UPDATE products
              SET
                name = ${sanitizedName},
                description = ${sanitizedDescription},
                unit_price = ${parseFloat(body.costPrice || 0)},
                stock_quantity = ${parseInt(body.currentStock || 0)},
                min_stock_level = ${parseInt(body.minStock || 0)},
                is_active = ${body.isActive !== false},
                location = ${locationValue || ''},
                updated_at = NOW()
              WHERE id = ${numericId}
              AND company_id = ${companyId}
            `;
          } catch (error2) {
            // Si location tampoco existe, actualizar sin location ni weight/volume
            const err2Msg = error2 instanceof Error ? error2.message : '';
            if (err2Msg.includes('column') && err2Msg.includes('location')) {
              console.log('⚠️ [PRODUCTS API] Columna location no existe, actualizando sin location ni weight/volume');
              updated = await prisma.$executeRaw`
                UPDATE products
                SET
                  name = ${sanitizedName},
                  description = ${sanitizedDescription},
                  unit_price = ${parseFloat(body.costPrice || 0)},
                  stock_quantity = ${parseInt(body.currentStock || 0)},
                  min_stock_level = ${parseInt(body.minStock || 0)},
                  is_active = ${body.isActive !== false},
                  updated_at = NOW()
                WHERE id = ${numericId}
                AND company_id = ${companyId}
              `;
            } else {
              throw error2;
            }
          }
        } else {
          throw error;
        }
      }

      // Obtener el producto actualizado
      // Intentar incluir location, weight, volume y volume_unit si existen
      let updatedProduct: Array<{
        id: number;
        name: string;
        description: string | null;
        sku: string | null;
        category_id: number;
        company_id: number;
        unit_price: number | null;
        unit_cost: number | null;
        stock_quantity: number | null;
        min_stock_level: number | null;
        is_active: boolean | null;
        created_at: Date | null;
        updated_at: Date | null;
        subcategory_id: number | null;
        location?: string | null;
        weight?: number | null;
        volume?: number | null;
        volume_unit?: string | null;
      }>;
      
      try {
        updatedProduct = await prisma.$queryRaw`
          SELECT 
            id, name, description, sku, category_id, company_id,
            unit_price, unit_cost, stock_quantity, min_stock_level,
            is_active, created_at, updated_at, subcategory_id,
            COALESCE(location, '') as location,
            COALESCE(weight, 0) as weight,
            COALESCE(volume, 0) as volume,
            COALESCE(volume_unit, 'metros_lineales') as volume_unit,
            images
          FROM products
          WHERE id = ${numericId}
          AND company_id = ${companyId}
        ` as any[];
      } catch (error) {
        // Si falla porque no existen algunas columnas, intentar sin ellas
        const errMsg = error instanceof Error ? error.message : '';
        if (errMsg.includes('column')) {
          console.log('⚠️ [PRODUCTS API] Algunas columnas no existen, obteniendo sin ellas');
          try {
            updatedProduct = await prisma.$queryRaw`
              SELECT
                id, name, description, sku, category_id, company_id,
                unit_price, unit_cost, stock_quantity, min_stock_level,
                is_active, created_at, updated_at, subcategory_id,
                COALESCE(location, '') as location
              FROM products
              WHERE id = ${numericId}
              AND company_id = ${companyId}
            ` as any[];
          } catch (error2) {
            // Si location tampoco existe, obtener sin location ni weight/volume
            const err2Msg = error2 instanceof Error ? error2.message : '';
            if (err2Msg.includes('column') && err2Msg.includes('location')) {
              console.log('⚠️ [PRODUCTS API] Columna location no existe, obteniendo sin location ni weight/volume');
              updatedProduct = await prisma.$queryRaw`
                SELECT 
                  id, name, description, sku, category_id, company_id,
                  unit_price, unit_cost, stock_quantity, min_stock_level,
                  is_active, created_at, updated_at, subcategory_id
                FROM products
                WHERE id = ${numericId}
                AND company_id = ${companyId}
              ` as any[];
            } else {
              throw error2;
            }
          }
        } else {
          throw error;
        }
      }

      if (!updatedProduct || updatedProduct.length === 0) {
        return NextResponse.json(
          { error: 'Producto no encontrado' },
          { status: 404 }
        );
      }

      const product = updatedProduct[0];
      
      // Obtener la categoría
      const category = await prisma.$queryRaw<Array<{
        id: number;
        name: string;
      }>>`
        SELECT id, name FROM product_categories
        WHERE id = ${product.category_id}
        AND company_id = ${companyId}
      `;

      // Transformar al formato esperado
      const transformedProduct = {
        id: `costos-${product.id}`,
        name: product.name,
        code: product.sku || '',
        description: product.description || '',
        categoryId: product.category_id,
        category: category && category.length > 0 ? {
          id: category[0].id,
          name: category[0].name
        } : undefined,
        unit: 'unidad',
        costPrice: parseFloat(String(product.unit_price || 0)),
        minStock: product.min_stock_level || 0,
        currentStock: product.stock_quantity || 0,
        volume: parseFloat(String(product.volume || 0)),
        weight: parseFloat(String(product.weight || 0)),
        volumeUnit: (product.volume_unit || 'metros_lineales') as 'metros_lineales' | 'metros_cuadrados',
        location: (product.location !== undefined && product.location !== null ? String(product.location) : locationValue) as string,
        blocksPerM2: undefined,
        isActive: product.is_active !== false,
        images: product.images ? (typeof product.images === 'string' ? JSON.parse(product.images) : product.images) : [],
        files: [],
        companyId: product.company_id,
        createdAt: product.created_at || new Date(),
        updatedAt: product.updated_at || new Date()
      };

      console.log('✅ [PRODUCTS API] Producto de costos actualizado exitosamente');
      console.log('✅ [PRODUCTS API] Ubicación guardada en BD:', transformedProduct.location);

      // Invalidar cache de productos
      await invalidateCache(invalidationPatterns.products(companyId));

      return NextResponse.json(transformedProduct);
    } else {
      // Actualizar producto de ventas
      // Verificar que la categoría existe si se está actualizando
      if (body.categoryId) {
        const category = await prisma.category.findFirst({
          where: {
            id: body.categoryId,
            companyId: companyId,
            isActive: true
          }
        });

        if (!category) {
          return NextResponse.json(
            { error: 'Categoría no válida' },
            { status: 400 }
          );
        }
      }

      const locationValue = (body.location || '').trim();
      
      console.log('💾 [PRODUCTS API] Actualizando producto ID:', numericId);
      console.log('💾 [PRODUCTS API] Ubicación recibida:', body.location);
      console.log('💾 [PRODUCTS API] Ubicación procesada:', locationValue);
      
      const updatedProduct = await prisma.product.update({
        where: { id: numericId },
        data: {
          name: body.name,
          code: body.code,
          description: body.description || '',
          categoryId: body.categoryId,
          unit: body.unit,
          costPrice: parseFloat(body.costPrice || 0),
          minStock: parseInt(body.minStock || 0),
          currentStock: parseInt(body.currentStock || 0),
          volume: parseFloat(body.volume || 0),
          volumeUnit: body.volumeUnit || 'metros_lineales',
          weight: parseFloat(body.weight || 0),
          location: locationValue || '',
          blocksPerM2: body.blocksPerM2 ? parseInt(body.blocksPerM2) : null,
          isActive: body.isActive !== false,
          images: body.images || [],
          files: body.files || []
        },
        include: {
          category: true
        }
      });
      
      console.log('✅ [PRODUCTS API] Producto actualizado exitosamente');
      console.log('✅ [PRODUCTS API] Ubicación guardada en BD:', updatedProduct.location);

      const transformedProduct = {
        ...updatedProduct,
        images: updatedProduct.images ? (updatedProduct.images as string[]) : [],
        files: updatedProduct.files ? (updatedProduct.files as string[]) : [],
        volumeUnit: body.volumeUnit || 'metros_lineales'
      };

      // Invalidar cache de productos
      await invalidateCache(invalidationPatterns.products(companyId));

      return NextResponse.json(transformedProduct);
    }
  } catch (error) {
    console.error('Error in PUT /api/products:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}