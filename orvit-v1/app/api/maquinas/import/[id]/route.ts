/**
 * GET /api/maquinas/import/[id] - Get import job details (for polling)
 * PATCH /api/maquinas/import/[id] - Update reviewed data
 * DELETE /api/maquinas/import/[id] - Cancel and delete import job
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// S3 Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const S3_BUCKET = process.env.AWS_S3_BUCKET || 'mawir-bucket';

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
// GET: Get import job details
// =============================================================================

export async function GET(
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
      include: {
        files: {
          select: {
            id: true,
            fileName: true,
            relativePath: true,
            fileTypes: true,
            fileSize: true,
            mimeType: true,
            isProcessed: true,
            pageCount: true,
            needsVision: true,
          },
        },
        fileAnalyses: {
          select: {
            id: true,
            fileId: true,
            confidence: true,
            warnings: true,
            model: true,
            tokensUsed: true,
            processingTimeMs: true,
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        machine: {
          select: { id: true, name: true, brand: true, model: true },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 });
    }

    // Verify company access
    if (job.companyId !== auth.company.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      stage: job.stage,
      progressPercent: job.progressPercent,
      currentStep: job.currentStep,
      errorMessage: job.errorMessage,
      retryCount: job.retryCount,

      // File info
      originalFileName: job.originalFileName,
      totalFiles: job.totalFiles,
      processedFiles: job.processedFiles,
      files: job.files.map(f => ({
        id: f.id,
        fileName: f.fileName,
        relativePath: f.relativePath,
        fileTypes: f.fileTypes,
        fileSize: f.fileSize,
        mimeType: f.mimeType,
        isProcessed: f.isProcessed,
        pageCount: f.pageCount,
        needsVision: f.needsVision,
      })),

      // Extraction results
      extractedData: job.extractedData,
      reviewedData: job.reviewedData,
      confidence: job.confidence,

      // File analyses
      fileAnalyses: job.fileAnalyses,

      // Machine created
      machineId: job.machineId,
      machine: job.machine,

      // Audit
      createdBy: job.createdBy,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
    });

  } catch (error) {
    console.error('Error getting import job:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH: Update reviewed data
// =============================================================================

export async function PATCH(
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
    });

    if (!job) {
      return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 });
    }

    if (job.companyId !== auth.company.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Only allow updates in DRAFT_READY status
    if (job.status !== 'DRAFT_READY') {
      return NextResponse.json(
        { error: 'Solo se puede editar en estado DRAFT_READY' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { reviewedData } = body;

    if (!reviewedData) {
      return NextResponse.json(
        { error: 'Se requiere reviewedData' },
        { status: 400 }
      );
    }

    // Update reviewed data
    await prisma.machineImportJob.update({
      where: { id: jobId },
      data: {
        reviewedData,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Datos actualizados',
    });

  } catch (error) {
    console.error('Error updating import job:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE: Cancel and delete import job
// =============================================================================

export async function DELETE(
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

    // Don't allow deletion of completed jobs
    if (job.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'No se puede eliminar un job completado' },
        { status: 400 }
      );
    }

    // Delete files from S3
    for (const file of job.files) {
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: S3_BUCKET,
            Key: file.s3Key,
          })
        );

        // Delete extracted text if exists
        if (file.extractedTextS3Key) {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: S3_BUCKET,
              Key: file.extractedTextS3Key,
            })
          );
        }
      } catch (s3Error) {
        console.error(`Error deleting S3 file ${file.s3Key}:`, s3Error);
      }
    }

    // Delete from database (cascade deletes files and analyses)
    await prisma.machineImportJob.delete({
      where: { id: jobId },
    });

    return NextResponse.json({
      success: true,
      message: 'Import job eliminado',
    });

  } catch (error) {
    console.error('Error deleting import job:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
