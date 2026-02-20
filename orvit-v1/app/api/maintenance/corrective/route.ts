import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

// Configuración de S3
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET!;

// Tipos MIME permitidos y tamaño máximo de archivo
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain'
]);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `El archivo "${file.name}" supera el límite de 10 MB` };
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { valid: false, error: `Tipo de archivo no permitido: ${file.type}. Se aceptan PDF, imágenes, Word y Excel.` };
  }
  return { valid: true };
}

// Función para subir archivo a S3
async function uploadFileToS3(file: File, entityType: string, entityId: string, fileType: string): Promise<string> {
  try {
    
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const fileName = `${entityType}/${fileType}/${entityId}/${timestamp}-${uuidv4()}.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const buffer = Buffer.from(uint8Array);

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
      Metadata: {
        'entity-type': entityType,
        'file-type': fileType,
        'entity-id': entityId,
        'original-name': file.name,
        'file-size': file.size.toString(),
      }
    }));
    
    const region = process.env.AWS_REGION;
    const url = `https://${BUCKET}.s3.${region}.amazonaws.com/${fileName}`;
    return url;
  } catch (error) {
    console.error('❌ Error en uploadFileToS3:', error);
    throw error;
  }
}

// POST /api/maintenance/corrective - Crear mantenimiento correctivo
export async function POST(request: NextRequest) {
  try {
    
    // Verificar si es FormData o JSON
    const contentType = request.headers.get('content-type') || '';
    
    let data: any;
    let instructivesFiles: File[] = [];
    let failureFiles: File[] = [];

    if (contentType.includes('multipart/form-data')) {
      // Manejar FormData
      const formData = await request.formData();
      
      // Extraer datos del formulario
      data = {
        title: formData.get('title'),
        description: formData.get('description'),
        priority: formData.get('priority'),
        estimatedHours: formData.get('estimatedHours'),
        machineId: formData.get('machineId'),
        assignedToId: formData.get('assignedToId'),
        sectorId: formData.get('sectorId'),
        companyId: formData.get('companyId'),
        createdBy: formData.get('createdBy'),
        failureDescription: formData.get('failureDescription'),
        failureDate: formData.get('failureDate'),
        failureTime: formData.get('failureTime'),
        rootCause: formData.get('rootCause'),
        solution: formData.get('solution'),
        notes: formData.get('notes')
      };

      // Extraer y validar archivos
      instructivesFiles = (formData.getAll('instructivesFiles') as File[]).filter(file => file && file.size > 0);
      failureFiles = (formData.getAll('failureFiles') as File[]).filter(file => file && file.size > 0);

      // Validar tipo y tamaño de cada archivo
      for (const file of [...instructivesFiles, ...failureFiles]) {
        const validation = validateFile(file);
        if (!validation.valid) {
          return NextResponse.json({ error: validation.error }, { status: 400 });
        }
      }
    } else {
      // Manejar JSON (fallback)
      data = await request.json();
    }

    // Validar datos requeridos
    
    if (!data.title?.trim()) {
      return NextResponse.json(
        { error: 'El título del mantenimiento es obligatorio' },
        { status: 400 }
      );
    }

    if (!data.description?.trim()) {
      return NextResponse.json(
        { error: 'La descripción del mantenimiento es obligatoria' },
        { status: 400 }
      );
    }

    if (!data.machineId) {
      return NextResponse.json(
        { error: 'Debe seleccionar una máquina' },
        { status: 400 }
      );
    }

    if (!data.companyId) {
      return NextResponse.json(
        { error: 'El ID de la empresa es obligatorio' },
        { status: 400 }
      );
    }

    // Procesar archivos de instructivos y subirlos a S3
    const processedInstructives = [];
    const uploadedInstructiveFiles = [];
    
    if (instructivesFiles && instructivesFiles.length > 0) {
      for (const file of instructivesFiles) {
        if (file && file.size > 0) {
          
          try {
            const tempId = `temp_${Date.now()}_${Math.random()}`;
            
            let s3Url;
            try {
              s3Url = await uploadFileToS3(file, 'MAINTENANCE', tempId, 'INSTRUCTIVE');
            } catch (s3Error) {
              console.error('❌ Error subiendo instructivo a S3, usando fallback:', s3Error);
              const arrayBuffer = await file.arrayBuffer();
              const base64 = Buffer.from(arrayBuffer).toString('base64');
              s3Url = `data:${file.type};base64,${base64}`;
            }
            
            uploadedInstructiveFiles.push({
              originalName: file.name,
              fileName: `instructive_${Date.now()}_${file.name}`,
              url: s3Url,
              fileSize: file.size,
              tempId: tempId
            });
            
            processedInstructives.push({
              id: `temp_${Date.now()}_${Math.random()}`,
              fileName: file.name,
              url: s3Url,
              uploadedAt: new Date().toISOString(),
              name: file.name,
              type: 'instructive',
              description: ''
            });
          } catch (error) {
            console.error('❌ Error procesando instructivo:', error);
          }
        }
      }
    }

    // Procesar archivos de falla y subirlos a S3
    const processedFailureFiles = [];
    const uploadedFailureFiles = [];
    
    if (failureFiles && failureFiles.length > 0) {
      for (const file of failureFiles) {
        if (file && file.size > 0) {
          
          try {
            const tempId = `temp_${Date.now()}_${Math.random()}`;
            
            let s3Url;
            try {
              s3Url = await uploadFileToS3(file, 'MAINTENANCE', tempId, 'FAILURE');
            } catch (s3Error) {
              console.error('❌ Error subiendo archivo de falla a S3, usando fallback:', s3Error);
              const arrayBuffer = await file.arrayBuffer();
              const base64 = Buffer.from(arrayBuffer).toString('base64');
              s3Url = `data:${file.type};base64,${base64}`;
            }
            
            uploadedFailureFiles.push({
              originalName: file.name,
              fileName: `failure_${Date.now()}_${file.name}`,
              url: s3Url,
              fileSize: file.size,
              tempId: tempId
            });
            
            processedFailureFiles.push({
              id: `temp_${Date.now()}_${Math.random()}`,
              fileName: file.name,
              url: s3Url,
              uploadedAt: new Date().toISOString(),
              name: file.name,
              type: 'failure',
              description: ''
            });
          } catch (error) {
            console.error('❌ Error procesando archivo de falla:', error);
          }
        }
      }
    }

    // Crear el work order (mantenimiento correctivo)
    
    let workOrder;
    try {
      workOrder = await prisma.workOrder.create({
        data: {
          title: data.title,
          description: data.description,
          type: 'CORRECTIVE',
          priority: data.priority || 'MEDIUM',
          estimatedHours: parseFloat(data.estimatedHours) || 1,
          machineId: parseInt(data.machineId),
          assignedToId: data.assignedToId ? parseInt(data.assignedToId) : null,
          scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
          status: 'PENDING',
          companyId: parseInt(data.companyId),
          sectorId: data.sectorId ? parseInt(data.sectorId) : null,
          createdById: parseInt(data.createdBy),
          notes: JSON.stringify({
            text: data.notes || '',
            instructives: processedInstructives,
            failureFiles: processedFailureFiles,
            failureDescription: data.failureDescription || '',
            failureDate: data.failureDate || '',
            failureTime: data.failureTime || '',
            rootCause: data.rootCause || '',
            solution: data.solution || '',
            failureType: data.failureType || 'MECANICA',
            selectedComponents: data.selectedComponents || [],
            selectedSubcomponents: data.selectedSubcomponents || [],
            toolsRequired: data.toolsRequired || [],
            spareParts: data.spareParts || []
          })
        },
        include: {
          machine: {
            include: {
              sector: true
            }
          },
          assignedTo: true,
          createdBy: true,
          company: true,
          sector: true
        }
      });
    } catch (prismaError) {
      console.error('❌ Error de Prisma al crear WorkOrder:', prismaError);
      console.error('❌ Detalles del error:', {
        message: prismaError instanceof Error ? prismaError.message : 'Unknown error',
        code: (prismaError as any)?.code,
        meta: (prismaError as any)?.meta
      });
      throw prismaError;
    }

    // Crear documentos para los instructivos
    const finalInstructives = [];
    for (const uploadedFile of uploadedInstructiveFiles) {
      try {
        const document = await prisma.document.create({
          data: {
            originalName: uploadedFile.originalName,
            fileName: uploadedFile.fileName,
            url: uploadedFile.url,
            fileSize: uploadedFile.fileSize,
            entityType: 'INSTRUCTIVE',
            entityId: workOrder.id.toString(),
            company: { connect: { id: parseInt(data.companyId) } },
            uploadDate: new Date(),
            uploadedBy: data.createdBy ? { connect: { id: parseInt(data.createdBy) } } : undefined
          }
        });
        
        finalInstructives.push({
          id: document.id.toString(),
          fileName: document.originalName,
          url: document.url || '',
          uploadedAt: document.uploadDate.toISOString(),
          name: uploadedFile.originalName,
          type: 'instructive',
          description: ''
        });
        
      } catch (error) {
        console.error('❌ Error creando documento para instructivo:', error);
      }
    }

    // Crear documentos para los archivos de falla
    const finalFailureFiles = [];
    for (const uploadedFile of uploadedFailureFiles) {
      try {
        const document = await prisma.document.create({
          data: {
            originalName: uploadedFile.originalName,
            fileName: uploadedFile.fileName,
            url: uploadedFile.url,
            fileSize: uploadedFile.fileSize,
            entityType: 'FAILURE',
            entityId: workOrder.id.toString(),
            company: { connect: { id: parseInt(data.companyId) } },
            uploadDate: new Date(),
            uploadedBy: data.createdBy ? { connect: { id: parseInt(data.createdBy) } } : undefined
          }
        });
        
        finalFailureFiles.push({
          id: document.id.toString(),
          fileName: document.originalName,
          url: document.url || '',
          uploadedAt: document.uploadDate.toISOString(),
          name: uploadedFile.originalName,
          type: 'failure',
          description: ''
        });
        
      } catch (error) {
        console.error('❌ Error creando documento para archivo de falla:', error);
      }
    }

    // Crear respuesta completa
    const completeMaintenanceData = {
      ...workOrder,
      instructives: finalInstructives,
      failureFiles: finalFailureFiles
    };

    return NextResponse.json({
      success: true,
      message: 'Mantenimiento correctivo creado correctamente',
      maintenance: completeMaintenanceData
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating corrective maintenance:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al crear el mantenimiento correctivo' },
      { status: 500 }
    );
  }
}
