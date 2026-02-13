/**
 * POST /api/maquinas/import/[id]/process - Start processing an import job
 *
 * This endpoint queues the job for processing.
 * In a production environment, you would use a proper job queue (BullMQ, etc.)
 * For simplicity, we process inline with a timeout check.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';
import { processImportJob } from '@/lib/import/worker';

export const dynamic = 'force-dynamic';

// Increase timeout for this route (Vercel Pro: up to 60s, Hobby: 10s)
export const maxDuration = 60;

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
// POST: Start processing
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

    // Check if job can be processed
    if (!['QUEUED', 'ERROR'].includes(job.status)) {
      return NextResponse.json(
        { error: `No se puede procesar un job en estado ${job.status}` },
        { status: 400 }
      );
    }

    // Check if there are files to process
    if (job.files.length === 0) {
      return NextResponse.json(
        { error: 'No hay archivos para procesar' },
        { status: 400 }
      );
    }

    // Check retry limit
    if (job.retryCount >= 3) {
      return NextResponse.json(
        { error: 'Se alcanzó el límite de reintentos (3)' },
        { status: 400 }
      );
    }

    // Update status to indicate we're starting
    await prisma.machineImportJob.update({
      where: { id: jobId },
      data: {
        status: 'PROCESSING',
        stage: 'starting',
        progressPercent: 0,
        currentStep: 'Iniciando procesamiento...',
        errorMessage: null,
      },
    });

    // Option 1: Process synchronously (for small jobs or development)
    // This works but may timeout on serverless platforms
    const startProcessing = async () => {
      try {
        await processImportJob(jobId);
      } catch (error) {
        console.error(`Background processing error for job ${jobId}:`, error);
      }
    };

    // Start processing in background (don't await)
    // The client should poll GET /api/maquinas/import/[id] for status
    startProcessing();

    // Return immediately
    return NextResponse.json({
      success: true,
      status: 'PROCESSING',
      message: 'Procesamiento iniciado. Consulte el estado del job para ver el progreso.',
      jobId,
    });

  } catch (error) {
    console.error('Error starting import processing:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
