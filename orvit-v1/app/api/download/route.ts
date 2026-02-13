import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';


const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper para obtener el usuario actual
async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return payload;
  } catch (error) {
    console.error('Error verificando token:', error);
    return null;
  }
}

// GET /api/download - Descargar archivo desde S3
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fileUrl = searchParams.get('url');
    const fileName = searchParams.get('fileName');

    if (!fileUrl) {
      return NextResponse.json(
        { error: 'URL del archivo es requerida' },
        { status: 400 }
      );
    }

    console.log(`📥 GET /api/download - Descargando archivo: ${fileName || 'sin nombre'}`);

    // Descargar archivo desde S3
    const response = await fetch(fileUrl);
    
    if (!response.ok) {
      console.error(`❌ Error descargando archivo: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: 'Error al descargar el archivo' },
        { status: response.status }
      );
    }

    // Obtener el contenido del archivo
    const fileBuffer = await response.arrayBuffer();
    
    // Obtener el tipo de contenido
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    // Crear respuesta con el archivo
    const downloadResponse = new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName || 'documento'}"`,
        'Cache-Control': 'no-cache',
      },
    });

    console.log(`✅ Archivo descargado exitosamente: ${fileName || 'sin nombre'}`);
    return downloadResponse;

  } catch (error) {
    console.error('❌ Error en GET /api/download:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 