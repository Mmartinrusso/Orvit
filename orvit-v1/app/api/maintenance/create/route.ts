import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { withGuards } from '@/lib/middleware/withGuards';

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

// POST /api/maintenance/create - Crear mantenimiento preventivo (autenticado)
export const POST = withGuards(async (request, ctx) => {
  try {
    // Manejar FormData para incluir archivos
    const formData = await request.formData();
    
    // Debug: Log todos los campos del FormData
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
      } else {
      }
    }
    
    // Extraer datos del formulario
    const data = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      priority: formData.get('priority') as string,
      estimatedHours: parseFloat(formData.get('estimatedHours') as string) || 1,
      scheduledDate: formData.get('scheduledDate') as string,
      notes: formData.get('notes') as string,
      companyId: parseInt(formData.get('companyId') as string),
      machineId: formData.get('machineId') ? parseInt(formData.get('machineId') as string) : null,
      unidadMovilId: formData.get('unidadMovilId') ? parseInt(formData.get('unidadMovilId') as string) : null,
      assignedToId: formData.get('assignedToId') ? parseInt(formData.get('assignedToId') as string) : null,
      sectorId: formData.get('sectorId') ? parseInt(formData.get('sectorId') as string) : null,
      createdBy: formData.get('createdBy') ? parseInt(formData.get('createdBy') as string) : ctx.user.userId,
      executionWindow: formData.get('executionWindow') as string,
      frequencyInterval: parseInt(formData.get('frequencyInterval') as string) || 30,
      timeUnit: formData.get('timeUnit') as string,
      instructivesFiles: formData.getAll('instructivesFiles') as File[],
      failureFiles: formData.getAll('failureFiles') as File[]
    };

    // Validar datos requeridos
    if (!data.title?.trim()) {
      return NextResponse.json(
        { error: 'El título del mantenimiento es obligatorio' },
        { status: 400 }
      );
    }

    if (!data.companyId) {
      return NextResponse.json(
        { error: 'El ID de la empresa es obligatorio' },
        { status: 400 }
      );
    }

    // Procesar instructivos y subirlos a S3 (pero no crear documentos aún)
    const processedInstructives = [];
    const uploadedFiles = [];
    
    if (data.instructivesFiles && data.instructivesFiles.length > 0) {
      for (const file of data.instructivesFiles) {
        if (file && file.size > 0) {
          
          try {
            // Subir archivo a S3 (usar un ID temporal para la organización)
            const tempId = `temp_${Date.now()}_${Math.random()}`;
            
            let s3Url;
            try {
              s3Url = await uploadFileToS3(file, 'MAINTENANCE', tempId, 'INSTRUCTIVE');
            } catch (s3Error) {
              console.error('❌ Error subiendo a S3, usando fallback:', s3Error);
              // Fallback: crear URL de datos base64
              const arrayBuffer = await file.arrayBuffer();
              const base64 = Buffer.from(arrayBuffer).toString('base64');
              s3Url = `data:${file.type};base64,${base64}`;
            }
            
            // Guardar información del archivo para crear documentos después
            uploadedFiles.push({
              originalName: file.name,
              fileName: `instructive_${Date.now()}_${file.name}`,
              url: s3Url,
              fileSize: file.size,
              tempId: tempId
            });
            
            processedInstructives.push({
              id: `temp_${Date.now()}_${Math.random()}`, // ID temporal
              fileName: file.name,
              url: s3Url,
              uploadedAt: new Date().toISOString(),
              name: file.name,
              type: 'instructive',
              description: ''
            });
          } catch (error) {
            console.error('❌ Error procesando instructivo:', error);
            // Continuar con el siguiente archivo si uno falla
          }
        }
      }
    }

    // Procesar archivos de falla y subirlos a S3
    const processedFailureFiles = [];
    const uploadedFailureFiles = [];
    
    if (data.failureFiles && data.failureFiles.length > 0) {
      for (const file of data.failureFiles) {
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

    // Crear el mantenimiento preventivo como WorkOrder
    
    const workOrder = await prisma.workOrder.create({
      data: {
        title: data.title,
        description: data.description || '',
        type: 'PREVENTIVE',
        priority: data.priority || 'MEDIUM',
        status: 'PENDING',
        estimatedHours: data.timeUnit === 'minutes' ? (data.estimatedHours || 15) / 60 : (data.estimatedHours || 1),
        scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
        notes: JSON.stringify({
          text: data.notes || '',
          instructives: processedInstructives,
          failureFiles: processedFailureFiles,
          executionWindow: data.executionWindow || 'Cualquier momento',
          frequencyInterval: parseInt(data.frequencyInterval?.toString()) || 30,
          timeUnit: data.timeUnit || 'minutes',
          timeValue: data.estimatedHours || 1
        }),
        machine: data.machineId ? {
          connect: { id: data.machineId }
        } : undefined,
        unidadMovil: data.unidadMovilId ? {
          connect: { id: data.unidadMovilId }
        } : undefined,
        assignedTo: data.assignedToId ? {
          connect: { id: parseInt(data.assignedToId) }
        } : undefined,
        company: {
          connect: { id: data.companyId }
        },
        sector: data.sectorId ? {
          connect: { id: parseInt(data.sectorId) }
        } : undefined,
        createdBy: data.createdBy ? {
          connect: { id: parseInt(data.createdBy) }
        } : undefined
      },
      include: {
        machine: true,
        unidadMovil: true,
        assignedTo: true,
        company: true,
        sector: true,
        createdBy: true
      }
    });

    // Crear también el template de mantenimiento preventivo para que aparezca en checklists
    const templateData = {
      templateType: 'PREVENTIVE_MAINTENANCE',
      title: data.title,
      description: data.description || '',
      priority: data.priority || 'MEDIUM',
      frequencyDays: parseInt(data.frequencyInterval?.toString()) || 30,
      estimatedHours: data.estimatedHours || 1,
      alertDaysBefore: [3, 2, 1, 0],
      machineId: data.machineId,
      machineName: workOrder.machine?.name || 'Máquina',
      componentIds: [],
      componentNames: [],
      subcomponentIds: [],
      subcomponentNames: [],
      executionWindow: data.executionWindow || 'ANY_TIME',
      timeUnit: data.timeUnit || 'HOURS',
      timeValue: data.estimatedHours || 1,
      assignedToId: data.assignedToId,
      assignedToName: workOrder.assignedTo?.name || null,
      companyId: data.companyId,
      sectorId: data.sectorId,
      createdById: data.createdBy,
      notes: data.notes || '',
      isActive: true,
      toolsRequired: [],
      instructives: processedInstructives,
      nextMaintenanceDate: data.scheduledDate ? new Date(data.scheduledDate).toISOString() : new Date().toISOString(),
      lastMaintenanceDate: null,
      weekdaysOnly: true,
      maintenanceCount: 0,
      createdAt: new Date().toISOString()
    };

    // Crear el template de mantenimiento preventivo
    const preventiveTemplate = await prisma.document.create({
      data: {
        originalName: `Template: ${data.title}`,
        fileName: `template_${workOrder.id}.json`,
        url: JSON.stringify(templateData),
        fileSize: JSON.stringify(templateData).length,
        entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE',
        entityId: workOrder.id.toString(),
        companyId: data.companyId,
        uploadDate: new Date(),
        uploadedById: data.createdBy || ctx.user.userId
      }
    });

    // Crear documentos para los instructivos ahora que tenemos el ID real del WorkOrder
    const finalInstructives = [];
    for (const uploadedFile of uploadedFiles) {
      try {
        const document = await prisma.document.create({
          data: {
            originalName: uploadedFile.originalName,
            fileName: uploadedFile.fileName,
            url: uploadedFile.url,
            fileSize: uploadedFile.fileSize,
            entityType: 'INSTRUCTIVE',
            entityId: workOrder.id.toString(), // Usar el ID real del WorkOrder
            company: { connect: { id: data.companyId } },
            uploadDate: new Date(),
            uploadedBy: data.createdBy ? { connect: { id: data.createdBy } } : undefined
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

    // Crear documentos para los archivos de falla ahora que tenemos el ID real del WorkOrder
    const finalFailureFiles = [];
    for (const uploadedFailureFile of uploadedFailureFiles) {
      try {
        const document = await prisma.document.create({
          data: {
            originalName: uploadedFailureFile.originalName,
            fileName: uploadedFailureFile.fileName,
            url: uploadedFailureFile.url,
            fileSize: uploadedFailureFile.fileSize,
            entityType: 'FAILURE',
            entityId: workOrder.id.toString(), // Usar el ID real del WorkOrder
            company: { connect: { id: data.companyId } },
            uploadDate: new Date(),
            uploadedBy: data.createdBy ? { connect: { id: data.createdBy } } : undefined
          }
        });
        
        finalFailureFiles.push({
          id: document.id.toString(),
          fileName: document.originalName,
          url: document.url || '',
          uploadedAt: document.uploadDate.toISOString(),
          name: uploadedFailureFile.originalName,
          type: 'failure',
          description: ''
        });
        
      } catch (error) {
        console.error('❌ Error creando documento para archivo de falla:', error);
      }
    }

    // Parsear las notas para extraer instructivos y ventana de ejecución
    let parsedNotes = {};
    try {
      parsedNotes = JSON.parse(workOrder.notes || '{}');
    } catch (e) {
      parsedNotes = { text: workOrder.notes || '' };
    }

    // Crear respuesta completa con todos los datos
    const completeMaintenanceData = {
      ...workOrder,
      instructives: finalInstructives.length > 0 ? finalInstructives : (parsedNotes.instructives || processedInstructives),
      failureFiles: finalFailureFiles.length > 0 ? finalFailureFiles : (parsedNotes.failureFiles || processedFailureFiles),
      executionWindow: parsedNotes.executionWindow || data.executionWindow || 'Cualquier momento',
      selectedComponents: data.selectedComponents || [],
      selectedSubcomponents: data.selectedSubcomponents || [],
      toolsRequired: data.toolsRequired || [],
      spareParts: data.spareParts || [],
      alertSettings: data.alertSettings || {},
      timeUnit: data.timeUnit || 'minutes',
      frequencyType: data.frequencyType || 'days',
      frequencyInterval: parseInt(data.frequencyInterval?.toString()) || 30
    };

    return NextResponse.json({
      success: true,
      message: 'Mantenimiento preventivo creado correctamente',
      maintenance: completeMaintenanceData
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating preventive maintenance:', error);
    return NextResponse.json(
      {
        error: 'Error interno del servidor al crear el mantenimiento',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});
