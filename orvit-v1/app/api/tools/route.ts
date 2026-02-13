import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Usar instancia global de prisma en lugar de crear nueva

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper para obtener el usuario actual y sus empresas
async function getCurrentUserWithCompanies() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number }
    });

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Obtener empresa usando consulta SQL directa para evitar problemas de relaciones
    let userCompany = null;
    try {
      const companies = await prisma.$queryRaw`
        SELECT c.* FROM "Company" c 
        INNER JOIN "UserOnCompany" uc ON c.id = uc."companyId" 
        WHERE uc."userId" = ${user.id} 
        LIMIT 1
      ` as any[];
      
      if (companies.length > 0) {
        userCompany = companies[0];
      }
    } catch (error) {
      console.log('⚠️ Error obteniendo empresa, usando fallback');
      // Fallback: obtener cualquier empresa
      const allCompanies = await prisma.$queryRaw`SELECT * FROM "Company" LIMIT 1` as any[];
      if (allCompanies.length > 0) {
        userCompany = allCompanies[0];
      }
    }
    
    return { user, userCompany };
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    return { user: null, userCompany: null };
  }
}

// GET /api/tools
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let companyId = searchParams.get('companyId');
    
    // console.log(`📋 GET /api/tools - companyId: ${companyId}`) // Log reducido;

    // Si no se proporciona companyId, usar fallback
    if (!companyId || companyId === 'undefined') {
      // Obtener la primera empresa disponible
      const companies = await prisma.$queryRaw`SELECT id FROM "Company" LIMIT 1` as any[];
      if (companies.length > 0) {
        companyId = companies[0].id.toString();
        // console.log(`✅ Usando companyId fallback: ${companyId}`) // Log reducido;
      } else {
        return NextResponse.json(
          { error: 'No hay empresas disponibles' },
          { status: 404 }
        );
      }
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

// POST /api/tools - Crear nueva herramienta (simplificado)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      itemType,
      category,
      brand,
      model,
      stockQuantity,
      minStockLevel,
      location,
      cost,
      supplier,
      companyId,
      logo
    } = body;

    // Validaciones básicas
    if (!name || !category || !companyId) {
      return NextResponse.json(
        { error: 'Nombre, categoría y companyId son requeridos' },
        { status: 400 }
      );
    }

    // Crear nueva herramienta usando SQL directo
    const newTool = await prisma.$queryRaw`
      INSERT INTO "Tool" (
        name, description, "itemType", category, brand, model,
        "stockQuantity", "minStockLevel", location, status, cost, supplier,
        logo,
        "companyId", "createdAt", "updatedAt"
      )
      VALUES (
        ${name}, 
        ${description || ''}, 
        ${itemType || 'TOOL'}::"ItemType", 
        ${category}, 
        ${brand || ''}, 
        ${model || ''}, 
        ${stockQuantity !== undefined ? stockQuantity : 0}, 
        ${minStockLevel !== undefined ? minStockLevel : 0}, 
        ${location || ''}, 
        'AVAILABLE'::"ToolStatus",
        ${Number(cost) || 0}, 
        ${supplier || ''}, 
        ${logo || null},
        ${parseInt(companyId)}, 
        NOW(), 
        NOW()
      )
      RETURNING *
    ` as any[];

    // console.log(`✅ Herramienta creada: ${newTool[0]?.name}`) // Log reducido;

    return NextResponse.json({
      success: true,
      tool: newTool[0],
      message: 'Herramienta creada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error en POST /api/tools:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (error as Error).message },
      { status: 500 }
    );
  }
  // ✅ OPTIMIZADO: Removido $disconnect() - no es necesario con connection pooling
}

// PUT /api/tools - Actualizar herramienta
export async function PUT(request: NextRequest) {
  try {
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

 