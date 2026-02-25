import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/machines/[id]/duplicate - Duplicar una máquina
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const machineId = parseInt(params.id);
    if (isNaN(machineId)) {
      return NextResponse.json({ error: 'ID de máquina inválido' }, { status: 400 });
    }

    // Obtener la máquina original con sus componentes (usando parentId para jerarquía)
    const originalMachine = await prisma.machine.findUnique({
      where: { id: machineId },
      include: {
        components: true,
      },
    });

    if (!originalMachine) {
      return NextResponse.json({ error: 'Máquina no encontrada' }, { status: 404 });
    }

    if (originalMachine.companyId !== auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Parsear opciones del body (qué incluir en la duplicación)
    let options = {
      includeComponents: true,
      newName: `${originalMachine.name} (Copia)`,
    };

    try {
      const body = await request.json();
      if (body.includeComponents !== undefined) options.includeComponents = body.includeComponents;
      if (body.newName) options.newName = body.newName;
    } catch {
      // Si no hay body, usar opciones por defecto
    }

    // Crear la copia de la máquina
    const duplicatedMachine = await prisma.machine.create({
      data: {
        name: options.newName,
        nickname: originalMachine.nickname ? `${originalMachine.nickname} (Copia)` : null,
        description: originalMachine.description,
        brand: originalMachine.brand,
        model: originalMachine.model,
        serialNumber: originalMachine.serialNumber ? `${originalMachine.serialNumber}-COPY` : null,
        type: originalMachine.type,
        status: 'ACTIVE', // Siempre iniciar como activa
        logo: originalMachine.logo,
        photo: originalMachine.photo,
        companyId: originalMachine.companyId,
        sectorId: originalMachine.sectorId,
        areaId: originalMachine.areaId,
        plantZoneId: originalMachine.plantZoneId,
        // Campos adicionales de identificación
        assetCode: originalMachine.assetCode ? `${originalMachine.assetCode}-COPY` : null,
        sapCode: originalMachine.sapCode ? `${originalMachine.sapCode}-COPY` : null,
        productionLine: originalMachine.productionLine,
        position: originalMachine.position,
        // Fechas y especificaciones técnicas
        manufacturingYear: originalMachine.manufacturingYear,
        installationDate: null, // No copiar fecha de instalación
        technicalNotes: originalMachine.technicalNotes,
        // Especificaciones técnicas
        voltage: originalMachine.voltage,
        power: originalMachine.power,
        weight: originalMachine.weight,
        dimensions: originalMachine.dimensions,
        // Reset health score y criticality (se calcularán de nuevo)
        healthScore: null,
        healthScoreUpdatedAt: null,
        criticalityScore: null,
        criticalityProduction: originalMachine.criticalityProduction,
        criticalitySafety: originalMachine.criticalitySafety,
        criticalityQuality: originalMachine.criticalityQuality,
        criticalityCost: originalMachine.criticalityCost,
      },
    });

    // Duplicar componentes si está habilitado
    if (options.includeComponents && originalMachine.components.length > 0) {
      // Primero crear componentes de nivel superior (sin parentId)
      const componentIdMap = new Map<number, number>(); // original id -> new id

      // Componentes raíz (sin parent)
      const rootComponents = originalMachine.components.filter(c => !c.parentId);
      for (const component of rootComponents) {
        const newComponent = await prisma.component.create({
          data: {
            name: component.name,
            code: component.code ? `${component.code}-COPY` : null,
            type: component.type,
            description: component.description,
            technicalInfo: component.technicalInfo,
            logo: component.logo,
            system: component.system,
            machineId: duplicatedMachine.id,
            criticality: component.criticality,
            isSafetyCritical: component.isSafetyCritical,
          },
        });
        componentIdMap.set(component.id, newComponent.id);
      }

      // Componentes hijos (con parentId)
      const childComponents = originalMachine.components.filter(c => c.parentId);
      for (const component of childComponents) {
        const newParentId = component.parentId ? componentIdMap.get(component.parentId) : null;
        const newComponent = await prisma.component.create({
          data: {
            name: component.name,
            code: component.code ? `${component.code}-COPY` : null,
            type: component.type,
            description: component.description,
            technicalInfo: component.technicalInfo,
            logo: component.logo,
            system: component.system,
            machineId: duplicatedMachine.id,
            parentId: newParentId,
            criticality: component.criticality,
            isSafetyCritical: component.isSafetyCritical,
          },
        });
        componentIdMap.set(component.id, newComponent.id);
      }
    }

    // Obtener la máquina duplicada con sus relaciones
    const result = await prisma.machine.findUnique({
      where: { id: duplicatedMachine.id },
      include: {
        components: {
          where: { parentId: null },
          include: {
            children: true,
          },
        },
        sector: true,
        plantZone: true,
        _count: {
          select: {
            components: true,
            workOrders: true,
            failures: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Máquina duplicada correctamente',
      machine: result,
    });
  } catch (error) {
    console.error('Error al duplicar máquina:', error);
    return NextResponse.json(
      { error: 'Error al duplicar la máquina' },
      { status: 500 }
    );
  }
}
