import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';


// Configuración de S3 (exactamente como en lib/s3-utils.ts)
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET!;

// Tipos de archivo permitidos
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain'
];
// Tipos de archivos 3D
const ALLOWED_3D_TYPES = [
  'model/gltf-binary',      // .glb
  'model/gltf+json',        // .gltf
  'application/octet-stream' // fallback for .glb files
];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'glb', 'gltf'];

export async function POST(request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const entityType = formData.get('entityType') as string;
    const entityId = formData.get('entityId') as string;
    const fileType = formData.get('fileType') as string;
    
    if (!file) {
      return NextResponse.json({ error: 'No se subió ningún archivo' }, { status: 400 });
    }

    if (!entityType || !fileType) {
      return NextResponse.json({ error: 'Tipo de entidad y tipo de archivo son requeridos' }, { status: 400 });
    }

    // Validar tipo de archivo
    const isValidImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isValidDocument = ALLOWED_DOCUMENT_TYPES.includes(file.type);
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const isValid3D = ALLOWED_3D_TYPES.includes(file.type) || ['glb', 'gltf'].includes(fileExt || '');

    if (!isValidImage && !isValidDocument && !isValid3D) {
      return NextResponse.json({
        error: 'Tipo de archivo no permitido. Solo se permiten imágenes (JPG, PNG, GIF, WebP), documentos (PDF, DOC, DOCX, XLS, XLSX, TXT) y modelos 3D (GLB, GLTF)'
      }, { status: 400 });
    }

    // Validar tamaño (máximo 50MB para 3D, 10MB para documentos, 5MB para imágenes)
    const maxSize = isValid3D ? 50 * 1024 * 1024 : (isValidImage ? 5 * 1024 * 1024 : 10 * 1024 * 1024);
    if (file.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      return NextResponse.json({ 
        error: `El archivo es demasiado grande. Máximo ${maxSizeMB}MB` 
      }, { status: 400 });
    }

    // Validar extensión
    if (!fileExt || !ALLOWED_EXTENSIONS.includes(fileExt)) {
      return NextResponse.json({ 
        error: 'Extensión de archivo no permitida' 
      }, { status: 400 });
    }

    // Crear nombre único para el archivo
    const timestamp = Date.now();
    const fileName = `${entityType}/${fileType}/${entityId || 'temp'}/${timestamp}-${uuidv4()}.${fileExt}`;
    
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const buffer = Buffer.from(uint8Array);

    // Subir a S3
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
      Metadata: {
        'entity-type': entityType,
        'file-type': fileType,
        'entity-id': entityId || 'temp',
        'original-name': file.name,
        'file-size': file.size.toString(),
      }
    }));
    
    // Generar URL más robusta
    const region = process.env.AWS_REGION;
    const url = `https://${BUCKET}.s3.${region}.amazonaws.com/${fileName}`;
    
    return NextResponse.json({ 
      url,
      fileName,
      fileType,
      entityType,
      entityId,
      originalName: file.name,
      size: file.size
    });
    
  } catch (error) {
    console.error('❌ Error en upload API:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack available');
    console.error('❌ Error name:', error instanceof Error ? error.name : 'Unknown error type');
    console.error('❌ Error message:', error instanceof Error ? error.message : 'No message available');
    
    // Manejo específico para errores de ACL
    if (error instanceof Error && error.name === 'AccessControlListNotSupported') {
      return NextResponse.json({ 
        error: 'Error de configuración del bucket S3. El bucket no permite ACLs.', 
        details: 'Contacte al administrador del sistema para configurar el bucket correctamente.'
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: 'Error al subir archivo', 
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

 