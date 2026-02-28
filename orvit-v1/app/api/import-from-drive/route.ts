import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '@/lib/auth/shared-helpers';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'mawir-bucket';

// Extensiones por MIME type
const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'text/plain': 'txt',
  'text/csv': 'csv',
};

// POST /api/import-from-drive
// Descarga un archivo de Google Drive y lo sube a S3
export async function POST(request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const { fileId, fileName, mimeType, accessToken, entityType, entityId } = body;

    if (!fileId || !accessToken) {
      return NextResponse.json(
        { error: 'fileId y accessToken son requeridos' },
        { status: 400 }
      );
    }

    // Determinar si es un archivo de Google Docs (necesita exportar)
    const isGoogleDoc = mimeType?.startsWith('application/vnd.google-apps.');

    let downloadUrl: string;
    let exportMimeType = mimeType;
    let finalFileName = fileName;

    if (isGoogleDoc) {
      // Exportar documentos de Google a formato estándar
      let exportFormat: string;

      if (mimeType === 'application/vnd.google-apps.document') {
        exportFormat = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        finalFileName = fileName.endsWith('.docx') ? fileName : `${fileName}.docx`;
      } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
        exportFormat = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        finalFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
      } else if (mimeType === 'application/vnd.google-apps.presentation') {
        exportFormat = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        finalFileName = fileName.endsWith('.pptx') ? fileName : `${fileName}.pptx`;
      } else {
        // Para otros tipos de Google Docs, exportar como PDF
        exportFormat = 'application/pdf';
        finalFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      }

      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportFormat)}`;
      exportMimeType = exportFormat;
    } else {
      // Archivo normal - descargar directamente
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    }

    // Descargar archivo de Google Drive
    const driveResponse = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!driveResponse.ok) {
      const errorText = await driveResponse.text();
      console.error('Error downloading from Drive:', errorText);
      return NextResponse.json(
        { error: 'Error descargando archivo de Google Drive' },
        { status: 500 }
      );
    }

    const fileBuffer = await driveResponse.arrayBuffer();
    const fileSize = fileBuffer.byteLength;

    // Generar nombre único para S3
    const ext = MIME_TO_EXT[exportMimeType] || finalFileName.split('.').pop() || 'bin';
    const sanitizedName = finalFileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFileName = `${Date.now()}-${uuidv4()}.${ext}`;

    // Determinar carpeta en S3
    const folder = entityType && entityId
      ? `${entityType}/${entityId}`
      : 'imports/google-drive';

    const s3Key = `${folder}/${uniqueFileName}`;

    // Subir a S3
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: Buffer.from(fileBuffer),
      ContentType: exportMimeType,
      Metadata: {
        originalName: sanitizedName,
        source: 'google-drive',
        driveFileId: fileId,
      },
    }));

    // Construir URL pública
    const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-2'}.amazonaws.com/${s3Key}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName: finalFileName,
      originalName: sanitizedName,
      size: fileSize,
      mimeType: exportMimeType,
      s3Key,
    });

  } catch (error) {
    console.error('Error importing from Google Drive:', error);
    return NextResponse.json(
      { error: 'Error importando archivo' },
      { status: 500 }
    );
  }
}
