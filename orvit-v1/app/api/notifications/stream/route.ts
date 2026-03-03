import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from "@/lib/prisma";
import { registerSSEConnection, unregisterSSEConnection } from "@/lib/instant-notifications";
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';


const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper function para obtener usuario desde JWT
// Retorna: { user, error? } — separa errores de auth (401) de errores de DB (500)
async function getUserFromToken(request: NextRequest): Promise<
  { user: any; error?: undefined } | { user: null; error: 'no_token' | 'invalid_token' | 'db_error' }
> {
  const cookieStore = cookies();
  const token =
    cookieStore.get('accessToken')?.value ||
    cookieStore.get('token')?.value;

  if (!token) {
    return { user: null, error: 'no_token' };
  }

  // Verificar JWT — si falla, es error de auth (401)
  let payload;
  try {
    const result = await jwtVerify(token, JWT_SECRET_KEY);
    payload = result.payload;
  } catch {
    return { user: null, error: 'invalid_token' };
  }

  // Buscar usuario en DB — si Prisma falla, es error de servidor (500)
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: {
            company: true
          }
        },
        ownedCompanies: true
      }
    });

    if (!user) return { user: null, error: 'invalid_token' };
    return { user };
  } catch (error) {
    console.error('Error de DB en SSE getUserFromToken:', error);
    return { user: null, error: 'db_error' };
  }
}



export async function GET(request: NextRequest) {
  const result = await getUserFromToken(request);
  if (result.error) {
    if (result.error === 'db_error') {
      return new NextResponse('Error interno del servidor', { status: 500 });
    }
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const user = result.user;

  // Obtener empresa del usuario
  let companyId: number;
  if (user.ownedCompanies && user.ownedCompanies.length > 0) {
    companyId = user.ownedCompanies[0].id;
  } else if (user.companies && user.companies.length > 0) {
    companyId = user.companies[0].companyId;
  } else {
    console.log('⚠️ Usuario sin empresa asociada, permitiendo conexión limitada');
    companyId = 0; // Empresa por defecto para usuarios sin empresa
  }

  // console.log(`🔗 Estableciendo conexión SSE para usuario ${user.id} (empresa ${companyId})`) // Log reducido;

  // Crear stream
  const stream = new ReadableStream({
    start(controller) {
      // Registrar conexión usando el helper
      registerSSEConnection(user.id, companyId, controller);

      // Enviar mensaje inicial
      controller.enqueue(`data: ${JSON.stringify({
        type: 'connected',
        message: 'Conectado al sistema de notificaciones en tiempo real',
        userId: user.id,
        timestamp: new Date().toISOString()
      })}\n\n`);

      // Enviar heartbeat cada 30 segundos
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(`data: ${JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString()
          })}\n\n`);
        } catch (error) {
          console.log(`💔 Heartbeat failed for user ${user.id}, cleaning up`);
          clearInterval(heartbeatInterval);
          unregisterSSEConnection(user.id);
        }
      }, 30000);

      // Cleanup cuando se cierra la conexión
      request.signal.addEventListener('abort', () => {
        console.log(`🔌 Conexión SSE cerrada para usuario ${user.id}`);
        clearInterval(heartbeatInterval);
        unregisterSSEConnection(user.id);
        try {
          controller.close();
        } catch (error) {
          // Ignore error if already closed
        }
      });
    },
    
    cancel() {
      console.log(`❌ Stream cancelado para usuario ${user.id}`);
      unregisterSSEConnection(user.id);
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Cache-Control, Content-Type',
    },
  });
}

 