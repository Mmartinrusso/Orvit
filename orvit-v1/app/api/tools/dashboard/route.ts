import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logApiPerformance, logApiError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * ✨ ENDPOINT AGREGADOR: Dashboard de herramientas/pañol
 * Consolida múltiples requests en uno solo
 * 
 * ANTES: 5-6 requests (tools, loans, movements, requests, stats)
 * DESPUÉS: 1 request
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const itemType = searchParams.get('itemType');
  
  const perf = logApiPerformance('tools/dashboard', { companyId, itemType });

  try {
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50', 10), 100);

    if (!companyId) {
      perf.end({ error: 'companyId missing' });
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    const companyIdNum = parseInt(companyId);

    // ✨ OPTIMIZACIÓN: Ejecutar todas las queries en paralelo
    const [tools, activeLoans, returnedLoans, recentMovements, pendingRequests, stats, categories] = await Promise.all([
      // 1. Herramientas/insumos
      getTools(companyIdNum, itemType, pageSize),
      
      // 2. Préstamos activos
      getActiveLoans(companyIdNum),
      
      // 3. Préstamos devueltos (últimos 50)
      getReturnedLoans(companyIdNum),
      
      // 4. Movimientos recientes
      getRecentMovements(companyIdNum),
      
      // 5. Solicitudes pendientes
      getPendingRequests(companyIdNum),
      
      // 6. Estadísticas
      getStats(companyIdNum, itemType),
      
      // 7. Categorías disponibles
      getCategories(companyIdNum)
    ]);

    // Log de performance
    perf.end({
      toolsCount: tools.length,
      activeLoansCount: activeLoans.length,
      returnedLoansCount: returnedLoans.length,
      movementsCount: recentMovements.length,
      pendingRequestsCount: pendingRequests.length
    });

    return NextResponse.json({
      tools,
      activeLoans,
      returnedLoans,
      recentMovements,
      pendingRequests,
      stats,
      categories,
      metadata: {
        companyId: companyIdNum,
        itemType,
        timestamp: new Date().toISOString(),
        totalTools: tools.length
      }
    });

  } catch (error) {
    logApiError('tools/dashboard', error, { companyId, itemType });
    perf.end({ error: true });
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

async function getTools(companyId: number, itemType: string | null, limit: number) {
  const where: any = { companyId };
  if (itemType) {
    where.itemType = itemType;
  }

  return prisma.tool.findMany({
    where,
    take: limit,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      itemType: true,
      category: true,
      brand: true,
      model: true,
      serialNumber: true,
      stockQuantity: true,
      minStockLevel: true,
      location: true,
      status: true,
      cost: true,
      supplier: true,
      logo: true
    }
  });
}

async function getActiveLoans(companyId: number) {
  return prisma.toolLoan.findMany({
    where: {
      tool: { companyId },
      status: 'BORROWED'
    },
    take: 50,
    orderBy: { borrowedAt: 'desc' },
    include: {
      tool: {
        select: {
          id: true,
          name: true,
          itemType: true,
          category: true
        }
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      worker: {
        select: {
          id: true,
          name: true,
          phone: true
        }
      }
    }
  });
}

async function getRecentMovements(companyId: number) {
  return prisma.toolMovement.findMany({
    where: {
      tool: { companyId }
    },
    take: 30,
    orderBy: { createdAt: 'desc' },
    include: {
      tool: {
        select: {
          id: true,
          name: true,
          itemType: true
        }
      }
    }
  });
}

async function getPendingRequests(companyId: number) {
  return prisma.toolRequest.findMany({
    where: {
      companyId,
      status: 'PENDING'
    },
    take: 20,
    orderBy: { createdAt: 'desc' },
    include: {
      requester: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
}

async function getStats(companyId: number, itemType: string | null) {
  const where: any = { companyId };
  if (itemType) {
    where.itemType = itemType;
  }

  const [total, byStatus, allTools, outOfStock, activeLoansCount] = await Promise.all([
    prisma.tool.count({ where }),
    prisma.tool.groupBy({
      by: ['status'],
      where,
      _count: true
    }),
    // Obtener todas las herramientas para calcular lowStock manualmente
    prisma.tool.findMany({
      where,
      select: { stockQuantity: true, minStockLevel: true }
    }),
    prisma.tool.count({
      where: {
        ...where,
        stockQuantity: 0
      }
    }),
    prisma.toolLoan.count({
      where: {
        tool: { companyId },
        status: 'BORROWED'
      }
    })
  ]);

  const statusMap: Record<string, number> = {};
  byStatus.forEach(s => {
    statusMap[s.status] = s._count;
  });

  // Calcular lowStock manualmente (herramientas con stock <= minStockLevel pero > 0)
  const lowStockCount = allTools.filter(t => t.stockQuantity <= t.minStockLevel && t.stockQuantity > 0).length;

  return {
    total,
    available: statusMap['AVAILABLE'] || 0,
    inUse: statusMap['IN_USE'] || 0,
    maintenance: statusMap['MAINTENANCE'] || 0,
    lowStock: lowStockCount,
    outOfStock,
    activeLoans: activeLoansCount
  };
}

async function getCategories(companyId: number) {
  const tools = await prisma.tool.findMany({
    where: { companyId },
    select: { category: true },
    distinct: ['category']
  });
  
  return tools.map(t => t.category).filter(Boolean).sort();
}

async function getReturnedLoans(companyId: number) {
  return prisma.toolLoan.findMany({
    where: {
      tool: { companyId },
      status: 'RETURNED'
    },
    take: 50,
    orderBy: { returnedAt: 'desc' },
    include: {
      tool: {
        select: {
          id: true,
          name: true,
          itemType: true,
          category: true
        }
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      worker: {
        select: {
          id: true,
          name: true,
          phone: true
        }
      }
    }
  });
}
