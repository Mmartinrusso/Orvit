import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Caché en memoria para documentos (60 segundos TTL)
const documentsCache = new Map<string, { data: any; timestamp: number }>();
const DOCUMENTS_CACHE_TTL = 60 * 1000; // 60 segundos


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('📥 Documents POST - Received data:', body);

    const { entityType, entityId, url, fileName, originalName, name, type, fileSize, folder } = body;

    // Check each required field individually
    const missingFields = [];
    if (!entityType) missingFields.push('entityType');
    if (!entityId) missingFields.push('entityId');
    if (!url) missingFields.push('url');
    if (!fileName) missingFields.push('fileName');

    if (missingFields.length > 0) {
      console.log('❌ Missing required fields:', missingFields);
      console.log('📋 Received fields:', { entityType, entityId, url, fileName });
      return NextResponse.json({
        error: `Faltan datos requeridos: ${missingFields.join(', ')}`,
        received: { entityType, entityId, url, fileName },
        missingFields
      }, { status: 400 });
    }

    let data: any = {
      url,
      fileName,
      originalName: originalName || fileName,
      name,
      type,
      fileSize,
      entityType,
      entityId: entityId.toString(),
      folder: folder || null  // Sistema de carpetas
    };

    // Mapear entityType a los campos específicos del modelo Document para compatibilidad
    switch (entityType) {
      case 'machine':
        data.machineId = Number(entityId);
        break;
      case 'component':
        data.componentId = Number(entityId);
        break;
      case 'tool':
        data.toolId = Number(entityId);
        break;
      default:
        // Para otros tipos como mantenimiento, solo usar entityType y entityId
        break;
    }

    console.log('💾 Creating document with data:', data);

    const doc = await prisma.document.create({
      data,
      include: {
        machine: true,
        component: true,
        tool: true,
        uploadedBy: true
      }
    });

    console.log('✅ Document created successfully:', doc.id);
    return NextResponse.json(doc);
  } catch (error) {
    console.error('❌ Error creating document:', error);
    return NextResponse.json({ error: 'Error interno del servidor al crear documento' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get('entityType');
  const entityId = searchParams.get('entityId');

  if (!entityType || !entityId) {
    return NextResponse.json({ error: 'Faltan parámetros requeridos: entityType y entityId' }, { status: 400 });
  }

  try {
    // ✅ OPTIMIZADO: Verificar caché primero
    const cacheKey = `docs-${entityType}-${entityId}`;
    const cached = documentsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < DOCUMENTS_CACHE_TTL) {
      return NextResponse.json(cached.data, {
        headers: { 'Cache-Control': 'private, max-age=60', 'X-Cache': 'HIT' }
      });
    }

    // ✅ OPTIMIZADO: Construir condición OR para buscar en ambos sistemas en una sola query
    const orConditions: any[] = [
      { entityType, entityId: entityId.toString() }
    ];

    // Agregar condición del sistema antiguo según el tipo
    switch (entityType) {
      case 'machine':
        orConditions.push({ machineId: Number(entityId) });
        break;
      case 'component':
        orConditions.push({ componentId: Number(entityId) });
        break;
      case 'tool':
        orConditions.push({ toolId: Number(entityId) });
        break;
    }

    const docs = await prisma.document.findMany({
      where: { OR: orConditions },
      select: {
        id: true,
        url: true,
        fileName: true,
        originalName: true,
        name: true,
        type: true,
        fileSize: true,
        entityType: true,
        entityId: true,
        uploadDate: true,
        machineId: true,
        componentId: true,
        toolId: true,
        folder: true,  // Sistema de carpetas
        uploadedBy: { select: { id: true, name: true, email: true } }
      },
      orderBy: { uploadDate: 'desc' }
    });

    // Guardar en caché
    documentsCache.set(cacheKey, { data: docs, timestamp: Date.now() });

    // Limpiar caché antiguo si crece demasiado
    if (documentsCache.size > 200) {
      const now = Date.now();
      for (const [key, value] of Array.from(documentsCache.entries())) {
        if (now - value.timestamp > DOCUMENTS_CACHE_TTL) {
          documentsCache.delete(key);
        }
      }
    }

    return NextResponse.json(docs, {
      headers: { 'Cache-Control': 'private, max-age=60', 'X-Cache': 'MISS' }
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({ error: 'Error interno del servidor al obtener documentos' }, { status: 500 });
  }
} 