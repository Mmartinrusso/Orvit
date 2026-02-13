/**
 * POST /api/maquinas/import/[id]/confirm - Confirm and create machine in ORVIT
 *
 * This endpoint:
 * 1. Creates the Machine with extracted/reviewed data
 * 2. Creates Components with proper hierarchy (topological sort)
 * 3. Links Documents to Machine/Components
 * 4. Updates the ImportJob as COMPLETED
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';
import { ExtractedMachineData, ExtractedComponent } from '@/lib/import';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper para obtener el usuario actual
async function getCurrentUser() {
  try {
    const token = (await cookies()).get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: { include: { company: true } },
        ownedCompanies: true,
      },
    });

    if (!user) return null;

    const company = user.ownedCompanies[0] || user.companies[0]?.company;
    return { user, company };
  } catch {
    return null;
  }
}

// =============================================================================
// HELPER: Topological sort for components
// =============================================================================

function topologicalSort(components: ExtractedComponent[]): ExtractedComponent[] {
  const result: ExtractedComponent[] = [];
  const visited = new Set<string>();
  const tempIdToComponent = new Map<string, ExtractedComponent>();

  // Build lookup map
  for (const comp of components) {
    tempIdToComponent.set(comp.tempId, comp);
  }

  // Visit function for DFS
  function visit(tempId: string) {
    if (visited.has(tempId)) return;
    visited.add(tempId);

    const comp = tempIdToComponent.get(tempId);
    if (!comp) return;

    // Visit parent first (if exists)
    if (comp.parentTempId && tempIdToComponent.has(comp.parentTempId)) {
      visit(comp.parentTempId);
    }

    result.push(comp);
  }

  // Visit all components
  for (const comp of components) {
    visit(comp.tempId);
  }

  return result;
}

// =============================================================================
// POST: Confirm and create machine
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getCurrentUser();
    if (!auth || !auth.company) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const jobId = parseInt(id);

    if (isNaN(jobId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const job = await prisma.machineImportJob.findUnique({
      where: { id: jobId },
      include: { files: true },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 });
    }

    if (job.companyId !== auth.company.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Idempotency: if already completed, return existing machine
    if (job.status === 'COMPLETED' && job.machineId) {
      const machine = await prisma.machine.findUnique({
        where: { id: job.machineId },
        include: {
          components: true,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Job ya estaba completado',
        machineId: job.machineId,
        machineName: machine?.name,
        componentsCreated: machine?.components.length || 0,
        documentsLinked: 0,
      });
    }

    // Check status
    if (job.status !== 'DRAFT_READY') {
      return NextResponse.json(
        { error: `Solo se puede confirmar un job en estado DRAFT_READY. Estado actual: ${job.status}` },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      sectorId,
      plantZoneId,
      acquisitionDate,
      includePending = false,
    } = body;

    // Validate required fields
    if (!sectorId) {
      return NextResponse.json(
        { error: 'Se requiere sectorId' },
        { status: 400 }
      );
    }

    if (!acquisitionDate) {
      return NextResponse.json(
        { error: 'Se requiere acquisitionDate' },
        { status: 400 }
      );
    }

    // Validate sector belongs to company
    const sector = await prisma.sector.findFirst({
      where: {
        id: sectorId,
        area: {
          companyId: auth.company.id,
        },
      },
    });

    if (!sector) {
      return NextResponse.json(
        { error: 'Sector no encontrado o no pertenece a la empresa' },
        { status: 400 }
      );
    }

    // Get extraction data (prefer reviewedData if exists)
    const extractedData = (job.reviewedData || job.extractedData) as ExtractedMachineData | null;

    if (!extractedData || !extractedData.machine) {
      return NextResponse.json(
        { error: 'No hay datos de extracción' },
        { status: 400 }
      );
    }

    // Filter components based on includePending
    let componentsToCreate = extractedData.components || [];
    if (!includePending) {
      componentsToCreate = componentsToCreate.filter(
        c => c.status === 'confirmed' || !c.needsConfirmation
      );
    }

    // Sort components topologically (parents before children)
    const sortedComponents = topologicalSort(componentsToCreate);

    // Create machine and components in a transaction
    // Increase timeout for large imports (many components)
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Machine
      const machine = await tx.machine.create({
        data: {
          name: extractedData.machine.name || 'Máquina Importada',
          brand: extractedData.machine.brand || 'Sin marca',
          model: extractedData.machine.model || undefined,
          serialNumber: extractedData.machine.serialNumber || undefined,
          manufacturingYear: extractedData.machine.manufacturingYear || undefined,
          type: (extractedData.machine.type as any) || 'PRODUCTION',
          status: 'ACTIVE',
          power: extractedData.machine.power || undefined,
          voltage: extractedData.machine.voltage || undefined,
          weight: extractedData.machine.weight || undefined,
          dimensions: extractedData.machine.dimensions || undefined,
          description: extractedData.machine.description || undefined,
          technicalNotes: extractedData.machine.technicalNotes || undefined,
          acquisitionDate: new Date(acquisitionDate),
          companyId: auth.company!.id,
          sectorId,
          plantZoneId: plantZoneId || undefined,
        },
      });

      // 2. Create Components with hierarchy
      const tempIdToRealId = new Map<string, number>();
      let componentsCreated = 0;

      for (const comp of sortedComponents) {
        // Determine parent ID
        let parentId: number | undefined = undefined;
        if (comp.parentTempId && tempIdToRealId.has(comp.parentTempId)) {
          parentId = tempIdToRealId.get(comp.parentTempId);
        }

        const component = await tx.component.create({
          data: {
            name: comp.name,
            code: comp.code || undefined,
            itemNumber: comp.itemNumber || undefined, // Posición en el plano de despiece
            quantity: comp.quantity || 1, // Cantidad en el ensamble
            type: comp.type || 'otro',
            system: comp.system || undefined,
            description: comp.description || undefined,
            logo: comp.logo || undefined,
            machineId: machine.id,
            parentId: parentId || undefined,
          },
        });

        tempIdToRealId.set(comp.tempId, component.id);
        componentsCreated++;
      }

      // 3. Link Documents (create Document records for each file)
      let documentsLinked = 0;

      for (const file of job.files) {
        // Determine which component to link to (if any)
        // For now, link all to machine. In the future, use evidence to link to specific components
        await tx.document.create({
          data: {
            name: file.fileName,
            fileName: file.fileName,
            url: `s3://${process.env.AWS_S3_BUCKET}/${file.s3Key}`,
            fileSize: file.fileSize,
            machineId: machine.id,
            companyId: auth.company!.id,
            uploadedById: auth.user!.id,
            folder: 'importacion',
          },
        });
        documentsLinked++;

        // Update file record
        await tx.machineImportFile.update({
          where: { id: file.id },
          data: { linkedToMachine: true },
        });
      }

      // 4. Update ImportJob
      await tx.machineImportJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          machineId: machine.id,
          completedAt: new Date(),
          stage: 'completed',
          progressPercent: 100,
          currentStep: 'Importación completada',
        },
      });

      return {
        machine,
        componentsCreated,
        documentsLinked,
      };
    }, {
      timeout: 60000, // 60 seconds for large imports
      maxWait: 10000, // Max wait to acquire lock
    });

    return NextResponse.json({
      success: true,
      message: 'Máquina creada exitosamente',
      machineId: result.machine.id,
      machineName: result.machine.name,
      componentsCreated: result.componentsCreated,
      documentsLinked: result.documentsLinked,
    });

  } catch (error) {
    console.error('Error confirming import:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
