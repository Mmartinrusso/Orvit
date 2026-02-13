/**
 * POST /api/components/import-ai - Create components from external AI response
 *
 * This endpoint:
 * 1. Receives AI-generated text (from ChatGPT, Gemini, Claude) + machineId
 * 2. Parses the text using shared SimpleParser (same as import flow)
 * 3. Creates components with hierarchy under the existing machine
 * 4. Returns created components
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';
import { parseAIResponse } from '@/lib/import/simple-parser';
import { ExtractedComponent } from '@/lib/import/machine-extractor';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

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

// Topological sort — parents before children (same logic as confirm endpoint)
function topologicalSort(components: ExtractedComponent[]): ExtractedComponent[] {
  const result: ExtractedComponent[] = [];
  const visited = new Set<string>();
  const tempIdToComponent = new Map<string, ExtractedComponent>();

  for (const comp of components) {
    tempIdToComponent.set(comp.tempId, comp);
  }

  function visit(tempId: string) {
    if (visited.has(tempId)) return;
    visited.add(tempId);

    const comp = tempIdToComponent.get(tempId);
    if (!comp) return;

    if (comp.parentTempId && tempIdToComponent.has(comp.parentTempId)) {
      visit(comp.parentTempId);
    }

    result.push(comp);
  }

  for (const comp of components) {
    visit(comp.tempId);
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getCurrentUser();
    if (!auth || !auth.company) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { aiResponse, machineId } = body;

    if (!aiResponse || typeof aiResponse !== 'string') {
      return NextResponse.json(
        { error: 'Se requiere aiResponse (string)' },
        { status: 400 }
      );
    }

    if (!machineId || typeof machineId !== 'number') {
      return NextResponse.json(
        { error: 'Se requiere machineId (number)' },
        { status: 400 }
      );
    }

    // Validate machine exists and belongs to user's company
    const machine = await prisma.machine.findFirst({
      where: {
        id: machineId,
        companyId: auth.company.id,
      },
    });

    if (!machine) {
      return NextResponse.json(
        { error: 'Máquina no encontrada' },
        { status: 404 }
      );
    }

    console.log(`[ImportAI] Parsing AI response for machine "${machine.name}" (${machineId}), ${aiResponse.length} chars`);

    // Parse using shared parser (same as external AI import)
    const data = parseAIResponse(aiResponse, 0, 'external-ai');

    if (!data.components || data.components.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron componentes en la respuesta de IA' },
        { status: 400 }
      );
    }

    console.log(`[ImportAI] Parsed ${data.components.length} components, creating under machine ${machineId}`);

    // Topological sort — parents first
    const sortedComponents = topologicalSort(data.components);

    // Create components in transaction
    const createdComponents = await prisma.$transaction(async (tx) => {
      const tempIdToRealId = new Map<string, number>();
      const created: any[] = [];

      for (const comp of sortedComponents) {
        let parentId: number | undefined = undefined;
        if (comp.parentTempId && tempIdToRealId.has(comp.parentTempId)) {
          parentId = tempIdToRealId.get(comp.parentTempId);
        }

        const component = await tx.component.create({
          data: {
            name: comp.name,
            code: comp.code || undefined,
            itemNumber: comp.itemNumber || undefined,
            quantity: comp.quantity || 1,
            type: comp.type || 'otro',
            system: comp.system || undefined,
            description: comp.description || undefined,
            logo: comp.logo || undefined,
            machineId: machineId,
            parentId: parentId || undefined,
          },
          select: {
            id: true,
            name: true,
            type: true,
            system: true,
            code: true,
            itemNumber: true,
            quantity: true,
            parentId: true,
          },
        });

        tempIdToRealId.set(comp.tempId, component.id);
        created.push(component);
      }

      return created;
    }, { timeout: 30000 });

    console.log(`[ImportAI] Created ${createdComponents.length} components for machine ${machineId}`);

    return NextResponse.json({
      success: true,
      componentsCreated: createdComponents.length,
      components: createdComponents,
    });

  } catch (error: any) {
    console.error('[ImportAI] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error al procesar la respuesta de IA' },
      { status: 500 }
    );
  }
}
