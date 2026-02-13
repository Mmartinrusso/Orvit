import { S3Client, DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { loggers } from '@/lib/logger';

// Configuración de S3
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET!;

/**
 * Extrae la key de S3 desde una URL completa o devuelve la key directa
 */
export function extractS3KeyFromUrl(url: string): string | null {
  if (!url) return null;
  
  try {
    // Si ya es una key (no empieza con http), devolverla directamente
    if (!url.startsWith('http')) {
      return url;
    }
    
    // Si es URL completa, extraer la key
    // Formato: https://bucket.s3.region.amazonaws.com/key
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1); // Remover el '/' inicial
  } catch (error) {
    loggers.s3.error({ err: error, url }, 'Error extracting S3 key from URL');
    // Si falla el parsing como URL, probablemente ya sea una key
    return url.startsWith('http') ? null : url;
  }
}

/**
 * Elimina un archivo específico de S3
 */
export async function deleteS3File(url: string): Promise<boolean> {
  try {
    const key = extractS3KeyFromUrl(url);
    if (!key) {
      loggers.s3.error({ url }, 'Could not extract S3 key from URL');
      return false;
    }

    await s3.send(new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }));

    loggers.s3.debug({ key }, 'File deleted from S3');
    return true;
  } catch (error) {
    loggers.s3.error({ err: error, url }, 'Error deleting file from S3');
    return false;
  }
}

/**
 * Elimina múltiples archivos de S3
 */
export async function deleteS3Files(urls: string[]): Promise<{ deleted: number; failed: number }> {
  if (!urls || urls.length === 0) {
    return { deleted: 0, failed: 0 };
  }

  const keys = urls
    .map(url => extractS3KeyFromUrl(url))
    .filter((key): key is string => key !== null);

  if (keys.length === 0) {
    return { deleted: 0, failed: urls.length };
  }

  try {
    // S3 permite eliminar hasta 1000 objetos por request
    const chunks = [];
    for (let i = 0; i < keys.length; i += 1000) {
      chunks.push(keys.slice(i, i + 1000));
    }

    let deleted = 0;
    let failed = 0;

    for (const chunk of chunks) {
      try {
        const result = await s3.send(new DeleteObjectsCommand({
          Bucket: BUCKET,
          Delete: {
            Objects: chunk.map(key => ({ Key: key })),
            Quiet: true,
          },
        }));

        deleted += chunk.length - (result.Errors?.length || 0);
        failed += result.Errors?.length || 0;

        if (result.Errors && result.Errors.length > 0) {
          loggers.s3.error({ errors: result.Errors }, 'Errors deleting S3 files');
        }
      } catch (error) {
        loggers.s3.error({ err: error, chunkSize: chunk.length }, 'Error deleting file chunk');
        failed += chunk.length;
      }
    }

    loggers.s3.info({ deleted, failed }, 'Bulk S3 delete completed');
    return { deleted, failed };
  } catch (error) {
    loggers.s3.error({ err: error }, 'Error in bulk S3 delete');
    return { deleted: 0, failed: keys.length };
  }
}

/**
 * Elimina todos los archivos de una entidad específica
 */
export async function deleteEntityFiles(entityType: string, entityId: string): Promise<boolean> {
  try {
    const prefix = `${entityType}/${entityId}/`;
    
    // Listar todos los objetos con el prefijo
    const listResult = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
    }));

    if (!listResult.Contents || listResult.Contents.length === 0) {
      loggers.s3.debug({ prefix }, 'No files found to delete');
      return true;
    }

    const keys = listResult.Contents.map(obj => obj.Key!);
    
    // Eliminar en lotes
    const chunks = [];
    for (let i = 0; i < keys.length; i += 1000) {
      chunks.push(keys.slice(i, i + 1000));
    }

    for (const chunk of chunks) {
      await s3.send(new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: {
          Objects: chunk.map(key => ({ Key: key })),
          Quiet: true,
        },
      }));
    }

    loggers.s3.info({ entityType, entityId, count: keys.length }, 'Entity files deleted');
    return true;
  } catch (error) {
    loggers.s3.error({ err: error, entityType, entityId }, 'Error deleting entity files');
    return false;
  }
}

/**
 * Elimina archivos de múltiples entidades
 */
export async function deleteMultipleEntityFiles(entities: { type: string; id: string }[]): Promise<boolean> {
  try {
    const deletePromises = entities.map(entity => 
      deleteEntityFiles(entity.type, entity.id)
    );

    const results = await Promise.allSettled(deletePromises);
    
    const failed = results.filter(result => result.status === 'rejected').length;
    
    if (failed > 0) {
      loggers.s3.error({ failed }, 'Some entities failed to delete files');
      return false;
    }

    return true;
  } catch (error) {
    loggers.s3.error({ err: error }, 'Error deleting files from multiple entities');
    return false;
  }
} 