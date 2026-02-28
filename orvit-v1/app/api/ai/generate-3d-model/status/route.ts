import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

const MESHY_API_KEY = process.env.MESHY_API_KEY;
const MESHY_STATUS_URL = 'https://api.meshy.ai/v2/image-to-3d';

/**
 * GET /api/ai/generate-3d-model/status?taskId=xxx
 * Check the status of a 3D model generation task
 */
export async function GET(request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    // Check for demo mode
    if (taskId.startsWith('demo-')) {
      // Simulate completion after some time for demo
      const taskTime = parseInt(taskId.split('-')[1]);
      const elapsed = Date.now() - taskTime;

      if (elapsed < 30000) { // 30 seconds for demo
        return NextResponse.json({
          status: 'processing',
          progress: Math.min(Math.floor(elapsed / 300), 90),
          message: 'Procesando imagen... (modo demo)'
        });
      }

      // Demo completed - return a sample model URL
      return NextResponse.json({
        status: 'completed',
        modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/glTF-Binary/Box.glb',
        message: 'Modelo demo completado. En producción, aquí estaría tu modelo generado.',
        note: 'Este es un modelo de ejemplo. Configura MESHY_API_KEY para generación real.'
      });
    }

    // Check Meshy API key
    if (!MESHY_API_KEY) {
      return NextResponse.json({
        status: 'error',
        error: 'API de Meshy.ai no configurada'
      });
    }

    // Query Meshy.ai for task status
    const meshyResponse = await fetch(`${MESHY_STATUS_URL}/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${MESHY_API_KEY}`,
      },
    });

    if (!meshyResponse.ok) {
      const errorData = await meshyResponse.json().catch(() => ({}));
      console.error('[MESHY_STATUS_ERROR]', errorData);
      return NextResponse.json({
        status: 'error',
        error: errorData.message || 'Error al verificar estado'
      });
    }

    const data = await meshyResponse.json();

    // Map Meshy status to our status
    switch (data.status) {
      case 'SUCCEEDED':
        return NextResponse.json({
          status: 'completed',
          modelUrl: data.model_urls?.glb || data.model_urls?.gltf,
          thumbnailUrl: data.thumbnail_url,
          message: 'Modelo generado exitosamente'
        });

      case 'FAILED':
        return NextResponse.json({
          status: 'failed',
          error: data.error?.message || 'La generación falló',
          details: data.error
        });

      case 'PENDING':
      case 'IN_PROGRESS':
      default:
        return NextResponse.json({
          status: 'processing',
          progress: data.progress || 50,
          message: data.status === 'PENDING' ? 'En cola...' : 'Procesando...'
        });
    }

  } catch (error) {
    console.error('[STATUS_CHECK_ERROR]', error);
    return NextResponse.json(
      { status: 'error', error: 'Error al verificar estado' },
      { status: 500 }
    );
  }
}
