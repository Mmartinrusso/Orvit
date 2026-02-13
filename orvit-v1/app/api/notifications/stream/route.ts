import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from "@/lib/prisma";
import { registerSSEConnection, unregisterSSEConnection } from "@/lib/instant-notifications";
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';


const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper function para obtener usuario desde JWT
async function getUserFromToken(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('token')?.value;
    
    // console.log('🔍 Debugging SSE auth:') // Log reducido;
    console.log('  - Cookies disponibles:', cookieStore.getAll().map(c => c.name));
    console.log('  - Token encontrado:', token ? 'SÍ' : 'NO');
    
    if (!token) {
      console.log('❌ No hay token JWT para SSE');
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    // console.log('✅ Token JWT válido para usuario:', payload.userId); // Log reducido
    
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

    return user;
  } catch (error) {
    console.error('❌ Error obteniendo usuario desde JWT para SSE:', error);
    return null;
  }
}



export async function GET(request: NextRequest) {
  const user = await getUserFromToken(request);
  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

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

 