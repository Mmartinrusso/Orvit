import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserAndCompany } from '@/lib/costs-auth';

export const dynamic = 'force-dynamic';

// GET /api/production/routines/employees
// Obtiene empleados disponibles para asignar a rutinas
// Filtros: workCenterId, sectorId, role, isActive
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndCompany();
    if (!auth || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workCenterId = searchParams.get('workCenterId');
    const sectorId = searchParams.get('sectorId');
    const templateName = searchParams.get('templateName'); // Fallback: filter by template name
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    // Si se provee workCenterId, intentar encontrar el sector asociado
    let targetSectorId: number | null = null;
    let targetSectorName: string | null = null;
    let filterMode: 'sector-id' | 'template-name' | 'none' = 'none';

    if (workCenterId) {
      const workCenter = await prisma.workCenter.findFirst({
        where: {
          id: parseInt(workCenterId),
          companyId: auth.companyId,
        },
        include: {
          machine: {
            select: { sectorId: true },
          },
        },
      });

      if (workCenter?.machine?.sectorId) {
        targetSectorId = workCenter.machine.sectorId;
        filterMode = 'sector-id';
      }
    }

    // Si se provee sectorId directamente, usarlo
    if (sectorId) {
      targetSectorId = parseInt(sectorId);
      filterMode = 'sector-id';
    }

    // Si se provee templateName como fallback, usarlo para filtrar por nombre de WorkSector
    if (!targetSectorId && templateName) {
      // Extraer palabras clave del nombre del template (ej: "Planta Viguetas" -> buscar "Viguetas")
      // También buscar si hay un Sector con nombre similar
      const possibleSector = await prisma.sector.findFirst({
        where: {
          companyId: auth.companyId,
          name: {
            mode: 'insensitive',
            contains: templateName.replace(/^Planta\s+/i, '').trim() // Quitar "Planta " del inicio
          }
        }
      });

      if (possibleSector) {
        targetSectorId = possibleSector.id;
        targetSectorName = possibleSector.name;
        filterMode = 'sector-id';
      } else {
        // Si no hay sector, usar el nombre del template para filtrar WorkSector por nombre
        targetSectorName = templateName.replace(/^Planta\s+/i, '').trim();
        filterMode = 'template-name';
      }
    }

    // Construir filtro para empleados
    let employeeWhereClause: any = {
      company_id: auth.companyId,
    };

    // Solo agregar filtro de activos si se requiere
    if (activeOnly) {
      employeeWhereClause.active = true;
    }

    // Si tenemos un sector objetivo, filtrar empleados por workSector vinculado a ese sector
    if (filterMode === 'sector-id' && targetSectorId) {
      // Obtener el nombre del sector para buscar por coincidencia de nombre también
      if (!targetSectorName) {
        const sector = await prisma.sector.findUnique({
          where: { id: targetSectorId },
          select: { name: true }
        });
        targetSectorName = sector?.name || null;
      }

      // Filtrar empleados cuyo WorkSector tenga source_sector_id igual al sector objetivo
      employeeWhereClause.workSector = { source_sector_id: targetSectorId };
    } else if (filterMode === 'template-name' && targetSectorName) {
      // Filtrar solo por nombre de WorkSector (cuando no hay sector ID)
      employeeWhereClause.workSector = {
        name: { contains: targetSectorName, mode: 'insensitive' }
      };
    }

    // Buscar empleados de la empresa
    const employees = await prisma.employee.findMany({
      where: employeeWhereClause,
      include: {
        workSector: {
          select: {
            id: true,
            name: true,
            source_sector_id: true,
            sourceSector: {
              select: { id: true, name: true },
            },
          },
        },
        unionCategory: {
          select: { id: true, name: true },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Transformar a formato para frontend
    const result = employees.map(emp => ({
      id: emp.id,
      name: emp.name,
      role: emp.role,
      isActive: emp.active,
      workSector: emp.workSector ? {
        id: emp.workSector.id,
        name: emp.workSector.name,
        sector: emp.workSector.sourceSector ? {
          id: emp.workSector.sourceSector.id,
          name: emp.workSector.sourceSector.name,
        } : null,
      } : null,
      category: emp.unionCategory ? {
        id: emp.unionCategory.id,
        name: emp.unionCategory.name,
      } : null,
    }));

    // Obtener los puestos de trabajo del SECTOR desde la tabla WorkPosition
    let allSectorRoles: string[] = [];
    try {
      if (filterMode === 'sector-id' && targetSectorId) {
        // Buscar puestos de trabajo definidos para este sector
        const workPositions = await prisma.workPosition.findMany({
          where: {
            company_id: auth.companyId,
            sector_id: targetSectorId,
            is_active: true
          },
          select: { name: true },
          orderBy: { name: 'asc' }
        });

        allSectorRoles = workPositions.map(p => p.name);

        // Si no hay puestos definidos en WorkPosition, fallback a roles de empleados
        if (allSectorRoles.length === 0) {
          const sectorEmployees = await prisma.employee.findMany({
            where: {
              company_id: auth.companyId,
              workSector: { source_sector_id: targetSectorId }
            },
            select: { role: true }
          });
          const sectorRoles = sectorEmployees
            .map(e => e.role)
            .filter((role): role is string => !!role && role.trim() !== '');
          allSectorRoles = [...new Set(sectorRoles)].sort();
        }
      } else {
        // Sin filtro de sector - obtener de empleados retornados
        const roles = result
          .map(e => e.role)
          .filter((role): role is string => !!role && role.trim() !== '');
        allSectorRoles = [...new Set(roles)].sort();
      }
    } catch (roleError) {
      console.error('Error fetching sector positions:', roleError);
      // Continue without roles - don't fail the whole request
    }

    // Debug info simplificado
    const debugInfo = {
      filterMode,
      requestedSectorId: targetSectorId,
      sectorName: targetSectorName,
      templateName: templateName || null,
      employeesFound: result.length,
      totalRolesAvailable: allSectorRoles.length,
    };

    return NextResponse.json({
      success: true,
      employees: result,
      allSectorRoles, // Todos los puestos de trabajo del sector
      meta: {
        total: result.length,
        filteredBySector: filterMode !== 'none',
        filterMode,
        sectorId: targetSectorId,
        sectorName: targetSectorName,
        debug: debugInfo,
      },
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    // Log más detalle del error para debugging
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
