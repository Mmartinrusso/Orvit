/**
 * POST /api/maquinas/import/parse-external - Parse external AI response
 *
 * This endpoint:
 * 1. Receives tree-format text from external AI (ChatGPT, Gemini, Claude)
 * 2. Parses the human-readable format using shared SimpleParser
 * 3. Creates an ImportJob for tracking
 * 4. Returns data ready for review
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';
import { parseAIResponse } from '@/lib/import/simple-parser';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper para obtener el usuario actual
async function getCurrentUser() {
  try {
    const token = (await cookies()).get('token')?.value;
    if (!token) {
      console.log('[ParseExternal] No token found');
      return null;
    }

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
  } catch (e) {
    console.log('[ParseExternal] Auth error:', e);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getCurrentUser();
    if (!auth || !auth.company) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { aiResponse } = body;

    if (!aiResponse || typeof aiResponse !== 'string') {
      return NextResponse.json(
        { error: 'Se requiere aiResponse (string)' },
        { status: 400 }
      );
    }

    console.log('[ParseExternal] Received response of', aiResponse.length, 'chars');

    // Use shared parser (handles text format + JSON fallback + flexible section headers)
    const data = parseAIResponse(aiResponse, 0, 'external-ai');

    console.log('[ParseExternal] Machine name:', data.machine.name);
    console.log('[ParseExternal] Components found:', data.components.length);

    // Log first few components with parent info for debugging
    if (data.components.length > 0) {
      console.log('[ParseExternal] Sample components:');
      data.components.slice(0, 5).forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.name} -> Padre: "${c.parentTempId || '(root)'}"`);
      });

      const withParent = data.components.filter(c => c.parentTempId).length;
      console.log(`[ParseExternal] Components with parent: ${withParent}/${data.components.length}`);
    }

    // Count root components
    const rootComponents = data.components.filter(c => c.parentTempId === null);
    console.log(`[ParseExternal] Root components: ${rootComponents.length}`);

    // Validate we got something
    if (data.machine.name === 'Máquina Importada' && data.components.length === 0) {
      return NextResponse.json(
        { error: 'No se pudo extraer datos. Asegurate de que la respuesta siga el formato indicado.' },
        { status: 400 }
      );
    }

    // Create ImportJob for tracking
    const job = await prisma.machineImportJob.create({
      data: {
        companyId: auth.company.id,
        createdById: auth.user.id,
        status: 'DRAFT_READY',
        stage: 'review',
        progressPercent: 100,
        currentStep: 'Datos importados desde IA externa',
        extractedData: data as any,
        totalFiles: 0,
        processedFiles: 0,
      },
    });

    console.log(`[ParseExternal] Created job ${job.id} with ${data.components.length} components`);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      data,
      componentsCount: data.components.length,
      confidence: data.overallConfidence,
      format: 'shared-parser',
    });

  } catch (error) {
    console.error('Error parsing external AI response:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
