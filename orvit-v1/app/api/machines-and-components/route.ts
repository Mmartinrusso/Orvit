import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';


// GET /api/machines-and-components
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const sectorId = searchParams.get('sectorId');
    const includeComponents = searchParams.get('includeComponents') === 'true';

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 });
    }

    console.log('🔍 Obteniendo máquinas y componentes para companyId:', companyId);

    // Obtener máquinas
    const machines = await prisma.machine.findMany({
      where: {
        companyId: parseInt(companyId),
        ...(sectorId && { sectorId: parseInt(sectorId) })
      },
      select: {
        id: true,
        name: true,
        nickname: true,
        type: true,
        brand: true,
        model: true,
        status: true,
        photo: true,
        logo: true,
        description: true,
        serialNumber: true,
        acquisitionDate: true,
        ...(includeComponents && {
          components: {
            select: {
              id: true,
              name: true,
              code: true,
              type: true,
              description: true,
              technicalInfo: true,
              logo: true,
              parentId: true,
              createdAt: true,
              updatedAt: true,
              children: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  type: true,
                  description: true,
                  technicalInfo: true,
                  logo: true,
                  parentId: true,
                  createdAt: true,
                  updatedAt: true
                }
              }
            },
            orderBy: { name: 'asc' }
          }
        })
      },
      orderBy: { name: 'asc' }
    });

    // Si no se incluyen componentes, devolver solo máquinas
    if (!includeComponents) {
      return NextResponse.json({
        machines: machines.map(machine => ({
          ...machine,
          type: 'MACHINE',
          displayName: machine.nickname || machine.name,
          fullPath: machine.name
        }))
      });
    }

    // Procesar máquinas y componentes para crear una estructura jerárquica
    const hierarchicalData = machines.map(machine => {
      const machineNode = {
        id: machine.id,
        name: machine.name,
        nickname: machine.nickname,
        type: 'MACHINE',
        displayName: machine.nickname || machine.name,
        fullPath: machine.name,
        brand: machine.brand,
        model: machine.model,
        status: machine.status,
        photo: machine.photo,
        logo: machine.logo,
        description: machine.description,
        serialNumber: machine.serialNumber,
        acquisitionDate: machine.acquisitionDate,
        children: []
      };

      // Procesar componentes de primer nivel
      if (machine.components) {
        machineNode.children = machine.components
          .filter(component => !component.parentId) // Solo componentes de primer nivel
          .map(component => {
            const componentNode = {
              id: component.id,
              name: component.name,
              code: component.code,
              type: 'COMPONENT',
              displayName: component.code ? `${component.code} - ${component.name}` : component.name,
              fullPath: `${machine.name} > ${component.name}`,
              description: component.description,
              technicalInfo: component.technicalInfo,
              logo: component.logo,
              parentId: component.parentId,
              children: []
            };

            // Procesar sub-componentes
            if (component.children && component.children.length > 0) {
              componentNode.children = component.children.map(subComponent => ({
                id: subComponent.id,
                name: subComponent.name,
                code: subComponent.code,
                type: 'SUB_COMPONENT',
                displayName: subComponent.code ? `${subComponent.code} - ${subComponent.name}` : subComponent.name,
                fullPath: `${machine.name} > ${component.name} > ${subComponent.name}`,
                description: subComponent.description,
                technicalInfo: subComponent.technicalInfo,
                logo: subComponent.logo,
                parentId: subComponent.parentId
              }));
            }

            return componentNode;
          });
      }

      return machineNode;
    });

    console.log('✅ Datos jerárquicos generados:', hierarchicalData.length, 'máquinas');
    return NextResponse.json({ machines: hierarchicalData });
  } catch (error) {
    console.error('❌ Error obteniendo máquinas y componentes:', error);
    return NextResponse.json({ error: 'Error al obtener máquinas y componentes' }, { status: 500 });
  }
} 