import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

// Configuración S3
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

// GET /api/maintenance/[id] - Obtener mantenimiento por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const maintenanceId = parseInt(params.id);

    if (isNaN(maintenanceId)) {
      return NextResponse.json(
        { error: 'ID del mantenimiento inválido' },
        { status: 400 }
      );
    }

    // Buscar en work orders (mantenimientos correctivos)
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: maintenanceId },
      include: {
        machine: {
          include: {
            sector: true
          }
        },
        unidadMovil: {
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

    if (workOrder) {
      return NextResponse.json({
        success: true,
        maintenance: workOrder
      });
    }

    // Si no se encuentra en work orders, buscar en documentos (mantenimientos preventivos)
    const document = await prisma.document.findUnique({
      where: { id: maintenanceId },
      include: {
        company: true,
        sector: true,
        createdBy: true
      }
    });

    if (document && document.entityType === 'PREVENTIVE_MAINTENANCE') {
      return NextResponse.json({
        success: true,
        maintenance: document
      });
    }

    return NextResponse.json(
      { error: 'Mantenimiento no encontrado' },
      { status: 404 }
    );

  } catch (error) {
    console.error('Error obteniendo mantenimiento:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/maintenance/[id] - Actualizar mantenimiento
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const maintenanceId = parseInt(params.id);

    if (isNaN(maintenanceId)) {
      return NextResponse.json(
        { error: 'ID del mantenimiento inválido' },
        { status: 400 }
      );
    }

    // Verificar si es FormData o JSON
    const contentType = request.headers.get('content-type') || '';
    let body: any;
    let instructivesFiles: File[] = [];

    if (contentType.includes('multipart/form-data')) {
      // Manejar FormData
      const formData = await request.formData();
      
      // Extraer datos del formulario
      body = {
        id: formData.get('id'),
        title: formData.get('title'),
        description: formData.get('description'),
        priority: formData.get('priority'),
        estimatedHours: formData.get('estimatedHours'),
        assignedToId: formData.get('assignedToId'),
        scheduledDate: formData.get('scheduledDate'),
        notes: formData.get('notes'),
        companyId: formData.get('companyId')
      };

      // Extraer archivos de instructivos
      const files = formData.getAll('instructivesFiles') as File[];
      instructivesFiles = files.filter(file => file && file.size > 0);
      
      instructivesFiles.forEach((file, index) => {
      });
    } else {
      // Manejar JSON (fallback)
      body = await request.json();
    }

    // Buscar el mantenimiento primero para determinar su tipo
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: maintenanceId }
    });

    if (workOrder) {
      // Actualizar work order (mantenimiento correctivo)
      const updatedWorkOrder = await prisma.workOrder.update({
        where: { id: maintenanceId },
        data: {
          title: body.title,
          description: body.description,
          priority: body.priority,
          estimatedHours: parseFloat(body.estimatedHours),
          assignedToId: body.assignedToId ? parseInt(body.assignedToId) : null,
          scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : null,
          notes: body.notes
        },
        include: {
          machine: {
            include: {
              sector: true
            }
          },
          unidadMovil: {
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

      // Procesar archivos de instructivos si hay alguno
      if (instructivesFiles.length > 0) {
        
        for (const file of instructivesFiles) {
          try {
            // Subir archivo a S3
            const s3Url = await uploadFileToS3(file, 'MAINTENANCE', maintenanceId.toString(), 'INSTRUCTIVE');
            
            // Crear documento en la base de datos
            await prisma.document.create({
              data: {
                originalName: file.name,
                fileName: `instructive_${Date.now()}_${file.name}`,
                url: s3Url,
                fileSize: file.size,
                entityType: 'INSTRUCTIVE',
                entityId: maintenanceId.toString(),
                company: { connect: { id: parseInt(body.companyId) } },
                uploadDate: new Date()
              }
            });
            
          } catch (error) {
            console.error(`❌ Error procesando instructivo ${file.name}:`, error);
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Mantenimiento actualizado correctamente',
        maintenance: updatedWorkOrder
      });
    }

    // Si no es work order, buscar en documentos
    const document = await prisma.document.findUnique({
      where: { id: maintenanceId }
    });

    if (document && document.entityType === 'PREVENTIVE_MAINTENANCE') {
      // Actualizar documento (mantenimiento preventivo)
      const updatedDocument = await prisma.document.update({
        where: { id: maintenanceId },
        data: {
          originalName: body.title,
          content: JSON.stringify({
            ...JSON.parse(document.content || '{}'),
            description: body.description,
            priority: body.priority,
            estimatedHours: body.estimatedHours,
            assignedToId: body.assignedToId,
            scheduledDate: body.scheduledDate,
            executionWindow: body.executionWindow,
            notes: body.notes,
            updatedAt: new Date().toISOString(),
            updatedBy: body.updatedBy
          }),
          updatedAt: new Date()
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Mantenimiento actualizado correctamente',
        maintenance: updatedDocument
      });
    }

    return NextResponse.json(
      { error: 'Mantenimiento no encontrado' },
      { status: 404 }
    );

  } catch (error) {
    console.error('Error actualizando mantenimiento:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Mantenimiento no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor al actualizar el mantenimiento' },
      { status: 500 }
    );
  }
}

// DELETE /api/maintenance/[id] - Eliminar mantenimiento
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const maintenanceId = parseInt(params.id);

    if (isNaN(maintenanceId)) {
      return NextResponse.json(
        { error: 'ID del mantenimiento inválido' },
        { status: 400 }
      );
    }

    // Buscar el mantenimiento primero para determinar su tipo
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: maintenanceId }
    });

    if (workOrder) {
      // Eliminar work order (mantenimiento correctivo)
      const deletedWorkOrder = await prisma.workOrder.delete({
        where: { id: maintenanceId }
      });

      return NextResponse.json({
        success: true,
        message: 'Mantenimiento eliminado correctamente',
        deletedMaintenance: {
          id: deletedWorkOrder.id,
          title: deletedWorkOrder.title
        }
      });
    }

    // Si no es work order, buscar en documentos
    const document = await prisma.document.findUnique({
      where: { id: maintenanceId }
    });

    if (document && document.entityType === 'PREVENTIVE_MAINTENANCE') {
      // Eliminar documento (mantenimiento preventivo) y sus instancias
      const templateId = maintenanceId;

      // 1. Eliminar todas las instancias del template
      const instances = await prisma.document.findMany({
        where: {
          entityType: 'PREVENTIVE_MAINTENANCE_INSTANCE',
          entityId: {
            startsWith: `template-${templateId}`
          }
        }
      });

      for (const instance of instances) {
        await prisma.document.delete({
          where: { id: instance.id }
        });
      }

      // 2. Eliminar todos los instructivos del template
      const instructives = await prisma.document.findMany({
        where: {
          entityType: 'PREVENTIVE_MAINTENANCE_INSTRUCTIVE',
          entityId: templateId.toString()
        }
      });

      for (const instructive of instructives) {
        await prisma.document.delete({
          where: { id: instructive.id }
        });
      }

      // 3. Eliminar el template principal
      const deletedDocument = await prisma.document.delete({
        where: { id: maintenanceId }
      });

      return NextResponse.json({
        success: true,
        message: 'Mantenimiento eliminado correctamente',
        deletedMaintenance: {
          id: deletedDocument.id,
          title: deletedDocument.originalName
        }
      });
    }

    return NextResponse.json(
      { error: 'Mantenimiento no encontrado' },
      { status: 404 }
    );

  } catch (error) {
    console.error('Error eliminando mantenimiento:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Mantenimiento no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor al eliminar el mantenimiento' },
      { status: 500 }
    );
  }
}
