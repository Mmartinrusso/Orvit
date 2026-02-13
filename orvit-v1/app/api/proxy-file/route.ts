import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// GET /api/proxy-file?url=...
// Proxy para descargar archivos de S3 evitando problemas de CORS
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const token = cookies().get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
      await jwtVerify(token, JWT_SECRET_KEY);
    } catch {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Obtener URL del archivo
    const url = request.nextUrl.searchParams.get('url');
    if (!url) {
      return NextResponse.json({ error: 'URL requerida' }, { status: 400 });
    }

    // Validar que sea una URL de S3 de nuestro bucket
    const allowedDomains = [
      'mawir-bucket.s3.us-east-2.amazonaws.com',
      'mawir-bucket.s3.amazonaws.com',
    ];

    const urlObj = new URL(url);
    if (!allowedDomains.some(domain => urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`))) {
      return NextResponse.json({ error: 'URL no permitida' }, { status: 403 });
    }

    // Fetch del archivo desde S3
    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json(
        { error: `Error al obtener archivo: ${response.status}` },
        { status: response.status }
      );
    }

    // Obtener el contenido
    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    // Devolver el archivo con los headers correctos
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': arrayBuffer.byteLength.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[PROXY FILE] Error:', error);
    return NextResponse.json({ error: 'Error al obtener archivo' }, { status: 500 });
  }
}
