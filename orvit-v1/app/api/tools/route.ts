import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { z } from 'zod';

const CreateToolSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido'),
  description: z.string().optional().default(''),
  code: z.string().optional().default(''),
  itemType: z.enum(['TOOL', 'SUPPLY', 'SPARE_PART', 'HAND_TOOL', 'CONSUMABLE', 'MATERIAL']).default('TOOL'),
  category: z.string().min(1, 'Categoría es requerida'),
  brand: z.string().optional().default(''),
  model: z.string().optional().default(''),
  serialNumber: z.string().optional().default(''),
  stockQuantity: z.coerce.number().min(0).default(0),
  minStockLevel: z.coerce.number().min(0).default(0),
  maxStockLevel: z.coerce.number().min(0).default(100),
  reorderPoint: z.coerce.number().min(0).optional().nullable(),
  location: z.string().optional().default(''),
  cost: z.coerce.number().min(0).optional().default(0),
  supplier: z.string().optional().default(''),
  companyId: z.coerce.number().positive('Company ID es requerido'),
  logo: z.string().optional().nullable(),
  isCritical: z.boolean().optional().default(false),
  leadTimeDays: z.coerce.number().min(0).optional().nullable(),
  unit: z.string().optional().default('unidad'),
});

export const dynamic = 'force-dynamic';

// GET /api/tools
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('tools.view');
    if (error) return error;

    const { searchParams } = new URL(request.url);
    let companyId = searchParams.get('companyId');

    // companyId es requerido — no usar fallback para evitar exposición cross-tenant
    if (!companyId || companyId === 'undefined') {
      return NextResponse.json(
        { error: 'Company ID es requerido' },
        { status: 400 }
      );
    }

    // console.log(`🔍 Buscando herramientas para empresa: ${companyId}`) // Log reducido;

    // Obtener parámetros de filtro
    const itemType = searchParams.get('itemType');
    
    // Construir condiciones de filtro
    const whereConditions: any = {
      companyId: parseInt(companyId)
    };
    
    // Agregar filtro de itemType si está presente
    if (itemType && itemType !== 'null' && itemType !== 'undefined') {
      whereConditions.itemType = itemType;
    }

    // console.log(`🔍 Condiciones de filtro:`, whereConditions) // Log reducido;

    // Obtener herramientas usando Prisma con filtros
    const tools = await prisma.tool.findMany({
      where: whereConditions,
      orderBy: { name: 'asc' }
    });

    // console.log(`✅ Encontradas ${tools.length} herramientas`) // Log reducido;

    // Obtener estadísticas básicas
    const total = tools.length;
    const available = tools.filter(t => t.status === 'AVAILABLE').length;
    const outOfStock = tools.filter(t => t.stockQuantity === 0).length;
    const lowStock = tools.filter(t => t.stockQuantity <= t.minStockLevel).length;

    const stats = { 
      total, 
      available, 
      lowStock, 
      outOfStock 
    };

    return NextResponse.json({
      success: true,
      tools,
      total: tools.length,
      stats
    });

  } catch (error) {
    console.error('❌ Error en GET /api/tools:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (error as Error).message },
      { status: 500 }
    );
  }
  // ✅ OPTIMIZADO: Removido $disconnect() - no es necesario con connection pooling
}

// POST /api/tools - Crear nueva herramienta con validación Zod
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('tools.create');
    if (error) return error;

    const body = await request.json();
    const parsed = CreateToolSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const d = parsed.data;

    const newTool = await prisma.$queryRaw`
      INSERT INTO "Tool" (
        name, description, code, "itemType", category, brand, model, "serialNumber",
        "stockQuantity", "minStockLevel", "maxStockLevel", "reorderPoint",
        location, status, cost, supplier, logo,
        "isCritical", "leadTimeDays", unit,
        "companyId", "createdAt", "updatedAt"
      )
      VALUES (
        ${d.name},
        ${d.description || null},
        ${d.code || null},
        ${d.itemType}::"ItemType",
        ${d.category},
        ${d.brand || null},
        ${d.model || null},
        ${d.serialNumber || null},
        ${d.stockQuantity},
        ${d.minStockLevel},
        ${d.maxStockLevel},
        ${d.reorderPoint ?? null},
        ${d.location || null},
        'AVAILABLE'::"ToolStatus",
        ${d.cost ?? 0},
        ${d.supplier || null},
        ${d.logo || null},
        ${d.isCritical},
        ${d.leadTimeDays ?? null},
        ${d.unit},
        ${d.companyId},
        NOW(),
        NOW()
      )
      RETURNING *
    ` as any[];

    return NextResponse.json({
      success: true,
      tool: newTool[0],
      message: 'Herramienta creada exitosamente'
    });

  } catch (error) {
    console.error('[POST /api/tools]', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/tools - Actualizar herramienta
export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('tools.edit');
    if (error) return error;

    const body = await request.json();
    const { id, stockQuantity, ...otherFields } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID de herramienta es requerido' },
        { status: 400 }
      );
    }

    // Obtener la herramienta actual para comparar stock
    const currentTool = await prisma.tool.findUnique({
      where: { id: parseInt(id) }
    });

    if (!currentTool) {
      return NextResponse.json(
        { error: 'Herramienta no encontrada' },
        { status: 404 }
      );
    }

    // Actualizar herramienta
    const updatedTool = await prisma.tool.update({
      where: { id: parseInt(id) },
      data: {
        stockQuantity: stockQuantity !== undefined ? parseInt(stockQuantity) : currentTool.stockQuantity,
        ...otherFields,
        updatedAt: new Date()
      }
    });

    // Verificación de notificaciones de stock bajo - DESACTIVADA
    // const newStock = stockQuantity !== undefined ? parseInt(stockQuantity) : currentTool.stockQuantity;
    // const stockChanged = newStock !== currentTool.stockQuantity;
    
    // // Solo notificar cuando llegue al stock mínimo, NO cuando esté en 0
    // if (stockChanged && (newStock <= updatedTool.minStockLevel && newStock > 0)) {
    //   try {
    //     await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/notifications/stock-check`, {
    //       method: 'POST',
    //       headers: {
    //         'Content-Type': 'application/json',
    //       },
    //       body: JSON.stringify({
    //         companyId: updatedTool.companyId,
    //         toolId: updatedTool.id
    //       })
    //     });
    //   } catch (notificationError) {
    //     console.error('Error enviando notificación de stock:', notificationError);
    //   }
    // }

    return NextResponse.json({
      success: true,
      tool: updatedTool,
      message: 'Herramienta actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error en PUT /api/tools:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (error as Error).message },
      { status: 500 }
    );
  }
  // ✅ OPTIMIZADO: Removido $disconnect() - no es necesario con connection pooling
}

 