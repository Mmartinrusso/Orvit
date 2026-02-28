import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

// GET /api/tools/[id] - Obtener una herramienta específica
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { user, error } = await requirePermission('tools.view');
    if (error) return error;

    const { id } = await params;
    const toolId = parseInt(id);
    if (isNaN(toolId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const companyId = user!.companyId;

    const tool = await prisma.$queryRaw`
      SELECT id, name, description, code, "itemType", category, brand, model, "serialNumber",
             "stockQuantity", "minStockLevel", "maxStockLevel", "reorderPoint",
             location, status, cost, supplier,
             "acquisitionDate", "lastMaintenanceDate", "nextMaintenanceDate",
             notes, "companyId", "sectorId", "createdAt", "updatedAt", "model3dUrl",
             "isCritical", "leadTimeDays", unit
      FROM "Tool" WHERE id = ${toolId} AND "companyId" = ${companyId} LIMIT 1
    ` as any[];

    if (tool.length === 0) {
      return NextResponse.json({ error: 'Herramienta no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ success: true, tool: tool[0] });
  } catch (error) {
    console.error('Error en GET /api/tools/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PUT /api/tools/[id] - Actualizar una herramienta
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { user, error } = await requirePermission('tools.edit');
    if (error) return error;

    const { id } = await params;
    const toolId = parseInt(id);
    if (isNaN(toolId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const companyId = user!.companyId;
    const body = await request.json();

    const {
      name, description, code, itemType, category, brand, model, serialNumber,
      stockQuantity, minStockLevel, maxStockLevel, reorderPoint,
      location, status, cost, supplier,
      acquisitionDate, lastMaintenanceDate, nextMaintenanceDate,
      notes, model3dUrl, isCritical, leadTimeDays, unit,
    } = body;

    if (!name || !category) {
      return NextResponse.json({ error: 'Nombre y categoría son requeridos' }, { status: 400 });
    }

    // Verify ownership
    const existingTool = await prisma.$queryRaw`
      SELECT id FROM "Tool" WHERE id = ${toolId} AND "companyId" = ${companyId} LIMIT 1
    ` as any[];

    if (existingTool.length === 0) {
      return NextResponse.json({ error: 'Herramienta no encontrada' }, { status: 404 });
    }

    const updatedTool = await prisma.$queryRaw`
      UPDATE "Tool" SET
        name = ${name},
        description = ${description || null},
        code = ${code || null},
        "itemType" = ${itemType || 'TOOL'}::"ItemType",
        category = ${category},
        brand = ${brand || null},
        model = ${model || null},
        "serialNumber" = ${serialNumber || null},
        "stockQuantity" = ${stockQuantity ?? 0},
        "minStockLevel" = ${minStockLevel ?? 0},
        "maxStockLevel" = ${maxStockLevel ?? 100},
        "reorderPoint" = ${reorderPoint ?? null},
        location = ${location || null},
        status = ${status || 'AVAILABLE'}::"ToolStatus",
        cost = ${cost ?? null},
        supplier = ${supplier || null},
        "acquisitionDate" = ${acquisitionDate ? new Date(acquisitionDate) : null},
        "lastMaintenanceDate" = ${lastMaintenanceDate ? new Date(lastMaintenanceDate) : null},
        "nextMaintenanceDate" = ${nextMaintenanceDate ? new Date(nextMaintenanceDate) : null},
        notes = ${notes || null},
        "model3dUrl" = ${model3dUrl || null},
        "isCritical" = ${isCritical ?? false},
        "leadTimeDays" = ${leadTimeDays ?? null},
        unit = ${unit || 'unidad'},
        "updatedAt" = NOW()
      WHERE id = ${toolId} AND "companyId" = ${companyId}
      RETURNING *
    ` as any[];

    return NextResponse.json({
      success: true,
      tool: updatedTool[0],
      message: 'Herramienta actualizada exitosamente',
    });
  } catch (error) {
    console.error('Error en PUT /api/tools/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PATCH /api/tools/[id] - Actualización parcial (para model3dUrl, etc.)
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { user, error } = await requirePermission('tools.edit');
    if (error) return error;

    const { id } = await params;
    const toolId = parseInt(id);
    if (isNaN(toolId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const companyId = user!.companyId;
    const body = await request.json();

    // Verify ownership
    const existingTool = await prisma.$queryRaw`
      SELECT id FROM "Tool" WHERE id = ${toolId} AND "companyId" = ${companyId} LIMIT 1
    ` as any[];

    if (existingTool.length === 0) {
      return NextResponse.json({ error: 'Herramienta no encontrada' }, { status: 404 });
    }

    if ('model3dUrl' in body) {
      const updatedTool = await prisma.$queryRaw`
        UPDATE "Tool" SET
          "model3dUrl" = ${body.model3dUrl || null},
          "updatedAt" = NOW()
        WHERE id = ${toolId} AND "companyId" = ${companyId}
        RETURNING *
      ` as any[];

      return NextResponse.json({
        success: true,
        tool: updatedTool[0],
        message: 'Herramienta actualizada exitosamente',
      });
    }

    return NextResponse.json({ error: 'No se proporcionaron campos para actualizar' }, { status: 400 });
  } catch (error) {
    console.error('Error en PATCH /api/tools/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE /api/tools/[id] - Eliminar una herramienta
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { user, error } = await requirePermission('tools.delete');
    if (error) return error;

    const { id } = await params;
    const toolId = parseInt(id);
    if (isNaN(toolId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const companyId = user!.companyId;

    const tool = await prisma.$queryRaw`
      SELECT id, status FROM "Tool" WHERE id = ${toolId} AND "companyId" = ${companyId} LIMIT 1
    ` as any[];

    if (tool.length === 0) {
      return NextResponse.json({ error: 'Herramienta no encontrada' }, { status: 404 });
    }

    if (tool[0].status === 'IN_USE') {
      return NextResponse.json(
        { error: 'No se puede eliminar una herramienta que está en uso' },
        { status: 400 }
      );
    }

    await prisma.$queryRaw`
      DELETE FROM "Tool" WHERE id = ${toolId} AND "companyId" = ${companyId}
    `;

    return NextResponse.json({ success: true, message: 'Herramienta eliminada exitosamente' });
  } catch (error) {
    console.error('Error en DELETE /api/tools/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
