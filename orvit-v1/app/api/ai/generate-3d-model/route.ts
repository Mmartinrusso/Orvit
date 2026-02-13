import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Meshy.ai API configuration
const MESHY_API_KEY = process.env.MESHY_API_KEY;
const MESHY_API_URL = 'https://api.meshy.ai/v2/image-to-3d';

interface GenerateRequest {
  imageBase64: string;
  fileName: string;
  componentName: string;
  componentId: number | string;
}

/**
 * POST /api/ai/generate-3d-model
 * Generates a 3D model from an image using Meshy.ai
 */
export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const { imageBase64, fileName, componentName, componentId } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: 'Se requiere una imagen' }, { status: 400 });
    }

    // Check if Meshy API key is configured
    if (!MESHY_API_KEY) {
      // Fallback: Return mock response for demo/development
      console.log('[GENERATE_3D] Meshy API key not configured, using demo mode');

      return NextResponse.json({
        success: true,
        status: 'demo',
        message: 'Modo demo: API de Meshy.ai no configurada',
        taskId: `demo-${Date.now()}`,
        estimatedTime: '2-5 minutos',
        tips: [
          'Para habilitar la generación real, configura MESHY_API_KEY en las variables de entorno',
          'Obtén tu API key en https://meshy.ai',
          'También puedes usar servicios alternativos como Tripo3D o Luma AI'
        ]
      });
    }

    // Prepare the image for Meshy API
    const imageDataUrl = `data:image/${getImageType(fileName)};base64,${imageBase64}`;

    // Call Meshy.ai API to start generation
    const meshyResponse = await fetch(MESHY_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MESHY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: imageDataUrl,
        enable_pbr: true, // Enable PBR materials for better quality
        ai_model: 'meshy-4', // Latest model
        topology: 'quad', // Better for industrial components
        target_polycount: 30000, // Reasonable for web viewing
      }),
    });

    if (!meshyResponse.ok) {
      const errorData = await meshyResponse.json().catch(() => ({}));
      console.error('[MESHY_API_ERROR]', errorData);
      throw new Error(errorData.message || 'Error al conectar con el servicio de generación 3D');
    }

    const meshyData = await meshyResponse.json();

    // Store task info in database for tracking
    try {
      await prisma.$executeRaw`
        INSERT INTO "AIGenerationTask" ("id", "componentId", "taskId", "status", "createdAt")
        VALUES (${crypto.randomUUID()}, ${Number(componentId)}, ${meshyData.result}, 'processing', NOW())
        ON CONFLICT DO NOTHING
      `;
    } catch (dbError) {
      console.log('[DB_TASK_SAVE] Table might not exist, continuing...', dbError);
    }

    return NextResponse.json({
      success: true,
      status: 'processing',
      taskId: meshyData.result,
      message: 'Generación iniciada. El modelo estará listo en unos minutos.',
      estimatedTime: '2-5 minutos'
    });

  } catch (error) {
    console.error('[GENERATE_3D_ERROR]', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error al generar el modelo 3D',
        details: 'Verifica que la imagen sea válida y vuelve a intentarlo'
      },
      { status: 500 }
    );
  }
}

function getImageType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'jpeg';
    case 'png':
      return 'png';
    case 'webp':
      return 'webp';
    default:
      return 'jpeg';
  }
}
