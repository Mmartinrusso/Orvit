/**
 * Import Worker - Background processing pipeline for machine imports
 *
 * This worker handles:
 * 1. Pre-processing: Extract text from PDFs
 * 2. AI Extraction: Per-file extraction
 * 3. Merge: Consolidate all extractions
 * 4. Update: Save results to database
 */

import 'server-only';
import { prisma } from '@/lib/prisma';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { extractTextFromPDF, shouldUseVision, isPDF, convertPdfToImages } from './pdf-processor';
import {
  extractFromMultipleFiles,
  mergeExtractions,
  FileExtractionInput,
  ExtractedMachineData,
} from './machine-extractor';
import { TranslationSettings } from './extraction-prompt';

// S3 Client (reuse from existing config)
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const S3_BUCKET = process.env.AWS_S3_BUCKET || 'mawir-bucket';

// =============================================================================
// TYPES
// =============================================================================

interface ProcessingProgress {
  stage: string;
  progressPercent: number;
  currentStep: string;
}

// =============================================================================
// MAIN WORKER FUNCTION
// =============================================================================

/**
 * Process an import job
 * This should be called by a cron job or queue worker
 */
export async function processImportJob(jobId: number): Promise<void> {
  console.log(`[ImportWorker] Starting job ${jobId}`);

  // Get job with files
  const job = await prisma.machineImportJob.findUnique({
    where: { id: jobId },
    include: {
      files: true,
    },
  });

  if (!job) {
    console.error(`[ImportWorker] Job ${jobId} not found`);
    return;
  }

  // Check if already processing (lock check)
  if (job.lockedAt) {
    const lockAge = Date.now() - new Date(job.lockedAt).getTime();
    const LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes

    if (lockAge < LOCK_TIMEOUT) {
      console.log(`[ImportWorker] Job ${jobId} is locked by another worker`);
      return;
    }
    // Lock expired, we can take over
    console.log(`[ImportWorker] Job ${jobId} lock expired, taking over`);
  }

  // Acquire lock
  await prisma.machineImportJob.update({
    where: { id: jobId },
    data: {
      lockedAt: new Date(),
      status: 'PROCESSING',
      stage: 'starting',
      progressPercent: 0,
      currentStep: 'Iniciando procesamiento...',
    },
  });

  try {
    // Build translation settings from job
    const translationSettings: TranslationSettings | undefined = job.translateEnabled
      ? {
          enabled: true,
          sourceLanguage: job.sourceLanguage,
          targetLanguage: job.targetLanguage,
        }
      : undefined;

    // Stage 1: Pre-process files
    await updateProgress(jobId, 'preprocessing', 5, 'Extrayendo texto de documentos...');
    const processedFiles = await preprocessFiles(job.files);

    // Stage 2: AI Extraction per file
    const translationNote = translationSettings?.enabled
      ? ` (traduciendo a ${translationSettings.targetLanguage || 'español'})`
      : '';
    await updateProgress(jobId, 'extracting', 10, `Analizando documentos con IA${translationNote}...`);
    const extractionInputs = await prepareExtractionInputs(processedFiles);

    // Derive output language from translation settings (default to 'es')
    const outputLanguage = (translationSettings?.targetLanguage as 'es' | 'en' | 'it' | 'pt') || 'es';

    const perFileResults = await extractFromMultipleFiles(
      extractionInputs,
      3,
      async (processed, total, currentFile) => {
        const percent = 10 + Math.round((processed / total) * 60); // 10-70%
        await updateProgress(
          jobId,
          'extracting',
          percent,
          `Procesando archivo ${processed}/${total}: ${currentFile}`
        );
      },
      outputLanguage
    );

    // Save per-file analyses
    for (const result of perFileResults) {
      if (!result.fileId) {
        console.warn('[ImportWorker] Skipping analysis save - no fileId on result');
        continue;
      }

      await prisma.machineImportFileAnalysis.upsert({
        where: { fileId: result.fileId },
        create: {
          fileId: result.fileId,
          importJobId: jobId,
          extractedJson: result as any,
          confidence: result.overallConfidence ?? 0,
          warnings: result.warnings ?? [],
          model: null,
          tokensUsed: null,
          processingTimeMs: result.processingTimeMs ?? null,
        },
        update: {
          extractedJson: result as any,
          confidence: result.overallConfidence ?? 0,
          warnings: result.warnings ?? [],
          model: null,
          tokensUsed: null,
          processingTimeMs: result.processingTimeMs ?? null,
        },
      });

      // Mark file as processed
      await prisma.machineImportFile.update({
        where: { id: result.fileId },
        data: { isProcessed: true },
      });
    }

    // Stage 3: Merge extractions
    await updateProgress(jobId, 'merging', 75, 'Consolidando resultados...');
    const mergedData = mergeExtractions(perFileResults);

    // Stage 4: Save final result
    await updateProgress(jobId, 'finalizing', 95, 'Guardando resultados...');

    await prisma.machineImportJob.update({
      where: { id: jobId },
      data: {
        status: 'DRAFT_READY',
        extractedData: mergedData as any,
        confidence: mergedData.overallConfidence,
        processedFiles: processedFiles.length,
        stage: 'complete',
        progressPercent: 100,
        currentStep: 'Listo para revisión',
        lockedAt: null,
      },
    });

    console.log(`[ImportWorker] Job ${jobId} completed successfully`);

  } catch (error) {
    console.error(`[ImportWorker] Job ${jobId} failed:`, error);

    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

    await prisma.machineImportJob.update({
      where: { id: jobId },
      data: {
        status: 'ERROR',
        errorMessage,
        retryCount: { increment: 1 },
        lastAttemptAt: new Date(),
        lockedAt: null,
        currentStep: `Error: ${errorMessage}`,
      },
    });
  }
}

// =============================================================================
// PREPROCESSING
// =============================================================================

interface PreprocessedFile {
  id: number;
  fileName: string;
  fileTypes: string[];
  pageCount: number;
  text: string;
  needsVision: boolean;
  s3Key: string;
  images: string[]; // base64 encoded images for vision
  pdfBase64?: string; // raw PDF as base64 for direct GPT-4o input
}

/**
 * Safely parse fileTypes which can be:
 * - Already an array (from Prisma Json field)
 * - A JSON string
 * - null/undefined
 */
function parseFileTypes(fileTypes: any): string[] {
  if (!fileTypes) return [];
  if (Array.isArray(fileTypes)) return fileTypes;
  if (typeof fileTypes === 'string') {
    try {
      const parsed = JSON.parse(fileTypes);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // Not valid JSON, might be a single type string
      return [fileTypes];
    }
  }
  return [];
}

async function preprocessFiles(files: any[]): Promise<PreprocessedFile[]> {
  const results: PreprocessedFile[] = [];

  for (const file of files) {
    try {
      // Download file from S3
      console.log(`[ImportWorker] Downloading file from S3: ${file.s3Key}`);
      const s3Response = await s3Client.send(
        new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: file.s3Key,
        })
      );

      if (!s3Response.Body) {
        console.error(`[ImportWorker] S3 response has no Body for key: ${file.s3Key}`);
        continue;
      }

      const byteArray = await s3Response.Body.transformToByteArray();
      const buffer = Buffer.from(byteArray);
      console.log(`[ImportWorker] Downloaded ${buffer.length} bytes for ${file.fileName}`);

      let text = '';
      let pageCount = 1;
      let needsVision = false;
      let images: string[] = [];
      let pdfBase64ForGpt: string | undefined;

      // Extract text from PDFs
      if (isPDF(file.fileName, file.mimeType)) {
        console.log(`[ImportWorker] === PDF Processing for ${file.fileName} ===`);
        const pdfResult = await extractTextFromPDF(buffer);
        text = pdfResult.text;
        pageCount = pdfResult.pageCount;
        console.log(`[ImportWorker] PDF text extracted: ${text.length} chars, ${pageCount} pages`);

        // ALWAYS save raw PDF as base64 — this lets us send the full PDF to GPT-4o
        // via the Responses API, exactly like ChatGPT receives the file
        pdfBase64ForGpt = buffer.toString('base64');
        console.log(`[ImportWorker] PDF base64 saved: ${Math.round(pdfBase64ForGpt.length / 1024)} KB`);

        // We no longer need vision mode or image conversion —
        // sending the raw PDF via Responses API is equivalent to uploading to ChatGPT
        needsVision = false;

        // Save extracted text to S3 if significant
        if (text.length > 100) {
          const textKey = file.s3Key.replace(/\.[^.]+$/, '_text.txt');
          await s3Client.send(
            new PutObjectCommand({
              Bucket: S3_BUCKET,
              Key: textKey,
              Body: text,
              ContentType: 'text/plain',
            })
          );

          // Update file record
          await prisma.machineImportFile.update({
            where: { id: file.id },
            data: {
              extractedTextS3Key: textKey,
              pageCount,
              needsVision,
            },
          });
        }
      } else {
        // Images always need vision - read and convert to base64
        needsVision = true;
        const base64 = buffer.toString('base64');
        images = [base64];
        console.log(`[ImportWorker] Image file ${file.fileName} - using for vision directly`);
      }

      results.push({
        id: file.id,
        fileName: file.fileName,
        fileTypes: parseFileTypes(file.fileTypes),
        pageCount: pageCount || images.length || 1,
        text,
        needsVision,
        s3Key: file.s3Key,
        images,
        pdfBase64: pdfBase64ForGpt,
      });

    } catch (error) {
      console.error(`[ImportWorker] Error preprocessing file ${file.fileName}:`, error);
      // Continue with other files
    }
  }

  return results;
}

// =============================================================================
// EXTRACTION INPUT PREPARATION
// =============================================================================

async function prepareExtractionInputs(
  files: PreprocessedFile[]
): Promise<FileExtractionInput[]> {
  const inputs: FileExtractionInput[] = [];

  for (const file of files) {
    const input: FileExtractionInput = {
      fileId: file.id,
      fileName: file.fileName,
      fileTypes: file.fileTypes as any[],
      pageCount: file.pageCount,
      text: file.text,
      needsVision: file.needsVision,
      images: file.images, // Pass images for vision processing
      pdfBase64: file.pdfBase64, // Pass raw PDF for direct GPT-4o input
    };

    // Log extraction mode
    if (file.needsVision && file.images.length > 0) {
      console.log(`[ImportWorker] ${file.fileName}: Using VISION mode with ${file.images.length} images`);
    } else if (file.pdfBase64) {
      console.log(`[ImportWorker] ${file.fileName}: Using DIRECT PDF mode (${Math.round(file.pdfBase64.length / 1024)} KB)`);
    } else if (file.text.length > 100) {
      console.log(`[ImportWorker] ${file.fileName}: Using TEXT mode (${file.text.length} chars)`);
    } else {
      console.log(`[ImportWorker] ${file.fileName}: WARNING - Limited data (text: ${file.text.length} chars, images: ${file.images.length})`);
    }

    inputs.push(input);
  }

  return inputs;
}

// =============================================================================
// PROGRESS UPDATES
// =============================================================================

async function updateProgress(
  jobId: number,
  stage: string,
  percent: number,
  step: string
): Promise<void> {
  await prisma.machineImportJob.update({
    where: { id: jobId },
    data: {
      stage,
      progressPercent: percent,
      currentStep: step,
    },
  });
}

// =============================================================================
// JOB QUEUE FUNCTIONS
// =============================================================================

/**
 * Get next job to process from queue
 */
export async function getNextQueuedJob(): Promise<number | null> {
  const job = await prisma.machineImportJob.findFirst({
    where: {
      status: 'QUEUED',
      OR: [
        { lockedAt: null },
        {
          lockedAt: {
            lt: new Date(Date.now() - 5 * 60 * 1000), // Lock expired
          },
        },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  return job?.id || null;
}

/**
 * Process all queued jobs
 * Call this from a cron job
 */
export async function processQueuedJobs(): Promise<void> {
  let jobId = await getNextQueuedJob();

  while (jobId) {
    await processImportJob(jobId);
    jobId = await getNextQueuedJob();
  }
}

/**
 * Retry failed jobs that haven't exceeded retry limit
 */
export async function retryFailedJobs(maxRetries: number = 3): Promise<void> {
  const failedJobs = await prisma.machineImportJob.findMany({
    where: {
      status: 'ERROR',
      retryCount: { lt: maxRetries },
    },
    orderBy: { lastAttemptAt: 'asc' },
    take: 5, // Process max 5 at a time
  });

  for (const job of failedJobs) {
    // Reset to QUEUED for reprocessing
    await prisma.machineImportJob.update({
      where: { id: job.id },
      data: {
        status: 'QUEUED',
        errorMessage: null,
      },
    });

    await processImportJob(job.id);
  }
}

// =============================================================================
// CLEANUP
// =============================================================================

/**
 * Clean up abandoned imports older than specified days
 */
export async function cleanupAbandonedImports(daysOld: number = 7): Promise<number> {
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

  const abandoned = await prisma.machineImportJob.findMany({
    where: {
      status: { in: ['UPLOADING', 'QUEUED', 'ERROR'] },
      updatedAt: { lt: cutoff },
    },
    include: { files: true },
  });

  let deletedCount = 0;

  for (const job of abandoned) {
    try {
      // Delete files from S3
      for (const file of job.files) {
        try {
          const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: S3_BUCKET,
              Key: file.s3Key,
            })
          );

          if (file.extractedTextS3Key) {
            await s3Client.send(
              new DeleteObjectCommand({
                Bucket: S3_BUCKET,
                Key: file.extractedTextS3Key,
              })
            );
          }
        } catch (s3Error) {
          console.error(`[Cleanup] Error deleting S3 file ${file.s3Key}:`, s3Error);
        }
      }

      // Delete from database (cascade deletes files and analyses)
      await prisma.machineImportJob.delete({
        where: { id: job.id },
      });

      deletedCount++;
    } catch (error) {
      console.error(`[Cleanup] Error deleting job ${job.id}:`, error);
    }
  }

  console.log(`[Cleanup] Deleted ${deletedCount} abandoned import jobs`);
  return deletedCount;
}
