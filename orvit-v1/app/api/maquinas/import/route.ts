/**
 * POST /api/maquinas/import
 * Create a new import job and upload files (ZIP or individual files)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
// Import server-only functions
import { extractZip, isValidZip } from '@/lib/import/zip-utils';
import { calculateSHA256 } from '@/lib/import/pdf-processor';
// Import client-safe types and constants
import {
  classifyFile,
  isValidFileType,
  isValidFileSize,
  sanitizeFileName,
  MAX_FILES,
  MAX_TOTAL_SIZE,
  MAX_FILE_SIZE,
  ALLOWED_EXTENSIONS,
} from '@/lib/import/types';

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

// =============================================================================
// HELPER: Get current user
// =============================================================================

async function getCurrentUser() {
  try {
    const token = (await cookies()).get('token')?.value;
    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: {
            company: true,
          },
        },
        ownedCompanies: true,
      },
    });

    if (!user) {
      return null;
    }

    const userCompany = user.ownedCompanies[0] || user.companies[0]?.company;

    return { user, company: userCompany };
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

// =============================================================================
// POST: Create import job and upload files
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    console.log('[Import API] POST request received');

    // Get current user
    const auth = await getCurrentUser();
    if (!auth || !auth.company) {
      console.log('[Import API] Unauthorized - no auth or company');
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { user, company } = auth;
    console.log(`[Import API] User: ${user.id}, Company: ${company.id}`);

    // Parse form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const isZip = formData.get('isZip') === 'true';

    console.log(`[Import API] Files received: ${files.length}, isZip: ${isZip}`);
    for (const f of files) {
      console.log(`[Import API] File: ${f.name}, size: ${f.size}, type: ${f.type}`);
    }

    // Translation settings
    const translateEnabled = formData.get('translateEnabled') === 'true';
    const sourceLanguage = formData.get('sourceLanguage') as string | null;
    const targetLanguage = formData.get('targetLanguage') as string | null;

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No se proporcionaron archivos' },
        { status: 400 }
      );
    }

    // For ZIP file
    if (isZip && files.length === 1) {
      const zipFile = files[0];
      const zipBuffer = Buffer.from(await zipFile.arrayBuffer());

      // Validate ZIP
      if (!isValidZip(zipBuffer)) {
        return NextResponse.json(
          { error: 'El archivo no es un ZIP válido' },
          { status: 400 }
        );
      }

      // Extract ZIP
      const extraction = await extractZip(zipBuffer);

      if (!extraction.success) {
        return NextResponse.json(
          { error: extraction.errors.join(', ') },
          { status: 400 }
        );
      }

      if (extraction.files.length === 0) {
        return NextResponse.json(
          { error: 'El ZIP no contiene archivos válidos' },
          { status: 400 }
        );
      }

      // Create import job
      const importJob = await prisma.machineImportJob.create({
        data: {
          companyId: company.id,
          createdById: user.id,
          originalFileName: zipFile.name,
          totalFiles: extraction.files.length,
          status: 'UPLOADING',
          stage: 'uploading',
          currentStep: 'Subiendo archivos...',
          translateEnabled,
          sourceLanguage: translateEnabled ? sourceLanguage : null,
          targetLanguage: translateEnabled ? targetLanguage : null,
        },
      });

      // Upload extracted files to S3
      const uploadedFiles = [];
      let uploadedCount = 0;

      for (const extractedFile of extraction.files) {
        try {
          const sha256 = calculateSHA256(extractedFile.buffer);
          const fileTypes = classifyFile(extractedFile.fileName, extractedFile.mimeType);

          // S3 key: imports/{companyId}/{jobId}/{relativePath}
          const s3Key = `imports/${company.id}/${importJob.id}/${sanitizeFileName(extractedFile.relativePath)}`;

          // Upload to S3
          await s3Client.send(
            new PutObjectCommand({
              Bucket: S3_BUCKET,
              Key: s3Key,
              Body: extractedFile.buffer,
              ContentType: extractedFile.mimeType,
              Metadata: {
                'original-name': extractedFile.fileName,
                'import-job-id': importJob.id.toString(),
              },
            })
          );

          // Create file record
          const fileRecord = await prisma.machineImportFile.create({
            data: {
              importJobId: importJob.id,
              fileName: extractedFile.fileName,
              relativePath: extractedFile.relativePath,
              s3Key,
              fileSize: extractedFile.size,
              mimeType: extractedFile.mimeType,
              sha256,
              fileTypes: fileTypes,
            },
          });

          uploadedFiles.push(fileRecord);
          uploadedCount++;

        } catch (uploadError) {
          console.error(`Error uploading ${extractedFile.fileName}:`, uploadError);
        }
      }

      // Update job status
      await prisma.machineImportJob.update({
        where: { id: importJob.id },
        data: {
          status: 'QUEUED',
          totalFiles: uploadedCount,
          stage: 'queued',
          currentStep: 'Esperando procesamiento',
        },
      });

      return NextResponse.json({
        importJobId: importJob.id,
        status: 'QUEUED',
        totalFiles: uploadedCount,
        files: uploadedFiles.map(f => ({
          id: f.id,
          fileName: f.fileName,
          fileTypes: f.fileTypes,
        })),
        warnings: extraction.errors,
      });

    } else {
      // Individual files upload
      if (files.length > MAX_FILES) {
        return NextResponse.json(
          { error: `Máximo ${MAX_FILES} archivos permitidos` },
          { status: 400 }
        );
      }

      // Validate total size
      let totalSize = 0;
      for (const file of files) {
        totalSize += file.size;
      }

      if (totalSize > MAX_TOTAL_SIZE) {
        return NextResponse.json(
          { error: `Tamaño total excede ${MAX_TOTAL_SIZE / 1024 / 1024}MB` },
          { status: 400 }
        );
      }

      // Create import job
      const importJob = await prisma.machineImportJob.create({
        data: {
          companyId: company.id,
          createdById: user.id,
          originalFileName: files.length === 1 ? files[0].name : `${files.length} archivos`,
          totalFiles: files.length,
          status: 'UPLOADING',
          stage: 'uploading',
          currentStep: 'Subiendo archivos...',
          translateEnabled,
          sourceLanguage: translateEnabled ? sourceLanguage : null,
          targetLanguage: translateEnabled ? targetLanguage : null,
        },
      });

      // Upload files to S3
      const uploadedFiles = [];
      const warnings: string[] = [];
      let uploadedCount = 0;

      for (const file of files) {
        try {
          console.log(`[Upload] Processing file: ${file.name}, type: ${file.type}, size: ${file.size}`);

          // Validate file
          const ext = '.' + file.name.split('.').pop()?.toLowerCase();
          console.log(`[Upload] Extension detected: "${ext}", allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);

          if (!ALLOWED_EXTENSIONS.includes(ext)) {
            console.log(`[Upload] Extension not allowed: ${ext}`);
            warnings.push(`Archivo ignorado (extensión no permitida): ${file.name}`);
            continue;
          }

          if (file.size > MAX_FILE_SIZE) {
            console.log(`[Upload] File too large: ${file.size} > ${MAX_FILE_SIZE}`);
            warnings.push(`Archivo muy grande: ${file.name}`);
            continue;
          }

          if (file.size === 0) {
            console.log(`[Upload] File is empty: ${file.name}`);
            warnings.push(`Archivo vacío: ${file.name}`);
            continue;
          }

          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          console.log(`[Upload] File: ${file.name}, Size from file: ${file.size}, Buffer size: ${buffer.length}`);

          if (buffer.length === 0) {
            console.error(`[Upload] Empty buffer for file: ${file.name}`);
            warnings.push(`Archivo vacío: ${file.name}`);
            continue;
          }

          const sha256 = calculateSHA256(buffer);
          const fileTypes = classifyFile(file.name, file.type);

          // S3 key
          const s3Key = `imports/${company.id}/${importJob.id}/${sanitizeFileName(file.name)}`;

          console.log(`[Upload] Uploading to S3: ${s3Key}, ${buffer.length} bytes`);

          // Upload to S3
          const uploadResult = await s3Client.send(
            new PutObjectCommand({
              Bucket: S3_BUCKET,
              Key: s3Key,
              Body: buffer,
              ContentType: file.type,
              ContentLength: buffer.length,
              Metadata: {
                'original-name': file.name,
                'import-job-id': importJob.id.toString(),
              },
            })
          );

          console.log(`[Upload] S3 upload complete for ${file.name}, ETag: ${uploadResult.ETag}`);

          // Create file record
          const fileRecord = await prisma.machineImportFile.create({
            data: {
              importJobId: importJob.id,
              fileName: file.name,
              relativePath: file.name,
              s3Key,
              fileSize: file.size,
              mimeType: file.type,
              sha256,
              fileTypes: fileTypes,
            },
          });

          uploadedFiles.push(fileRecord);
          uploadedCount++;

        } catch (uploadError) {
          console.error(`Error uploading ${file.name}:`, uploadError);
          warnings.push(`Error subiendo ${file.name}`);
        }
      }

      if (uploadedCount === 0) {
        // Delete empty job
        await prisma.machineImportJob.delete({
          where: { id: importJob.id },
        });

        return NextResponse.json(
          { error: 'No se pudo subir ningún archivo', warnings },
          { status: 400 }
        );
      }

      // Update job status
      await prisma.machineImportJob.update({
        where: { id: importJob.id },
        data: {
          status: 'QUEUED',
          totalFiles: uploadedCount,
          stage: 'queued',
          currentStep: 'Esperando procesamiento',
        },
      });

      return NextResponse.json({
        importJobId: importJob.id,
        status: 'QUEUED',
        totalFiles: uploadedCount,
        files: uploadedFiles.map(f => ({
          id: f.id,
          fileName: f.fileName,
          fileTypes: f.fileTypes,
        })),
        warnings,
      });
    }

  } catch (error) {
    console.error('Error creating import job:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET: List import jobs for current company
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    // Get current user
    const auth = await getCurrentUser();
    if (!auth || !auth.company) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '10');

    const where: any = {
      companyId: auth.company.id,
    };

    if (status) {
      where.status = status;
    }

    const jobs = await prisma.machineImportJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
        machine: {
          select: { id: true, name: true },
        },
        _count: {
          select: { files: true },
        },
      },
    });

    return NextResponse.json({
      jobs: jobs.map(job => ({
        id: job.id,
        status: job.status,
        originalFileName: job.originalFileName,
        totalFiles: job.totalFiles,
        processedFiles: job.processedFiles,
        confidence: job.confidence,
        stage: job.stage,
        progressPercent: job.progressPercent,
        currentStep: job.currentStep,
        errorMessage: job.errorMessage,
        machineId: job.machineId,
        machineName: job.machine?.name,
        createdBy: job.createdBy,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
      })),
    });

  } catch (error) {
    console.error('Error listing import jobs:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
