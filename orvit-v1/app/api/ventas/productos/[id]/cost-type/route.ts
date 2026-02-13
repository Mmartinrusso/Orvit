import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { changeCostType, updateCostFromRecipe, updateCostManually, getCostHistory } from '@/lib/services/product-cost';
import { ProductCostType } from '@prisma/client';

// GET: Obtener configuración de costo del producto
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.PRODUCTOS_VIEW);
    if (error) return error;

    const { id: productId } = await params;
    const companyId = user!.companyId;

    // Obtener producto con relaciones de costo
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        companyId,
      },
      select: {
        id: true,
        name: true,
        code: true,
        costPrice: true,
        costType: true,
        recipeId: true,
        purchaseInputId: true,
        weightedAverageCost: true,
        lastCostUpdate: true,
        costCalculationStock: true,
        recipe: {
          select: {
            id: true,
            name: true,
          },
        },
        purchaseInput: {
          select: {
            id: true,
            name: true,
            currentPrice: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    // Obtener recetas disponibles para la empresa
    const recipes = await prisma.recipe.findMany({
      where: {
        companyId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        scopeType: true,
        scopeId: true,
      },
      orderBy: { name: 'asc' },
    });

    // Obtener insumos disponibles para compra
    const purchaseInputs = await prisma.inputItem.findMany({
      where: {
        companyId,
      },
      select: {
        id: true,
        name: true,
        currentPrice: true,
        unitLabel: true,
      },
      orderBy: { name: 'asc' },
    });

    // Obtener últimos cambios de costo
    const { logs: recentCostChanges } = await getCostHistory({
      productId,
      companyId,
      limit: 5,
    });

    return NextResponse.json({
      product,
      recipes,
      purchaseInputs,
      recentCostChanges,
    });
  } catch (error) {
    console.error('Error obteniendo config de costo:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT: Actualizar tipo de costo o costo manual
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.PRODUCTOS_EDIT);
    if (error) return error;

    const { id: productId } = await params;
    const companyId = user!.companyId;
    const userId = user!.id;

    const body = await request.json();
    const { action, costType, recipeId, purchaseInputId, newCost, notes } = body;

    // Verificar que el producto pertenece a la empresa
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        companyId,
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    // Acción: Cambiar tipo de costo
    if (action === 'change_type') {
      if (!costType || !['PRODUCTION', 'PURCHASE', 'MANUAL'].includes(costType)) {
        return NextResponse.json({ error: 'Tipo de costo inválido' }, { status: 400 });
      }

      const result = await changeCostType({
        productId,
        newCostType: costType as ProductCostType,
        recipeId,
        purchaseInputId,
        userId,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: 'Tipo de costo actualizado' });
    }

    // Acción: Actualizar costo manual
    if (action === 'update_manual') {
      if (typeof newCost !== 'number' || newCost < 0) {
        return NextResponse.json({ error: 'Costo inválido' }, { status: 400 });
      }

      const result = await updateCostManually({
        productId,
        newCost,
        userId,
        notes,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        previousCost: result.previousCost,
        newCost: result.newCost,
      });
    }

    // Acción: Recalcular desde receta
    if (action === 'recalculate_recipe') {
      if (!product.recipeId) {
        return NextResponse.json({ error: 'El producto no tiene una receta asignada' }, { status: 400 });
      }

      const result = await updateCostFromRecipe({
        productId,
        recipeId: product.recipeId,
        userId,
        notes,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        previousCost: result.previousCost,
        newCost: result.newCost,
      });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    console.error('Error actualizando costo:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
