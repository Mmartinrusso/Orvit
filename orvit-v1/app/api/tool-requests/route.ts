import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper para obtener el usuario actual
async function getCurrentUser() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number }
    });

    return user;
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    return null;
  }
}

// GET /api/tool-requests - Obtener solicitudes pendientes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const status = searchParams.get('status') || 'PENDING';

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID es requerido' },
        { status: 400 }
      );
    }

    // Buscar solicitudes en la tabla Document con entityType TOOL_REQUEST
    const requests = await prisma.document.findMany({
      where: {
        entityType: 'TOOL_REQUEST',
        originalName: {
          contains: `companyId:${companyId}`
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Parsear y filtrar las solicitudes
    const parsedRequests = requests.map(doc => {
      try {
        const data = JSON.parse(doc.url);
        return {
          id: doc.id,
          ...data,
          createdAt: doc.createdAt
        };
      } catch (error) {
        return null;
      }
    }).filter(req => req && req.status === status);

    return NextResponse.json({
      success: true,
      requests: parsedRequests,
      total: parsedRequests.length
    });

  } catch (error) {
    console.error('Error en GET /api/tool-requests:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/tool-requests - Crear nueva solicitud
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      toolName, 
      quantity, 
      requestedById, 
      requestedByName,
      companyId,
      reason,
      urgency,
      plantStopId,
      sectorName,
      machineName
    } = body;

    if (!toolName || !quantity || !requestedById || !companyId) {
      return NextResponse.json(
        { error: 'Datos requeridos faltantes' },
        { status: 400 }
      );
    }

    // Crear solicitud como documento
    const requestData = {
      toolName,
      quantity: parseInt(quantity),
      requestedById: parseInt(requestedById),
      requestedByName,
      companyId: parseInt(companyId),
      reason: reason || 'Solicitud desde parada de planta',
      urgency: urgency || 'MEDIUM',
      plantStopId,
      sectorName,
      machineName,
      status: 'PENDING',
      requestedAt: new Date().toISOString()
    };

    const toolRequest = await prisma.document.create({
      data: {
        id: `tool-request-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        entityType: 'TOOL_REQUEST',
        entityId: companyId.toString(),
        url: JSON.stringify(requestData),
        originalName: `Solicitud: ${toolName} - companyId:${companyId}`
      }
    });

    return NextResponse.json({
      success: true,
      request: {
        id: toolRequest.id,
        ...requestData
      },
      message: 'Solicitud creada exitosamente'
    });

  } catch (error) {
    console.error('Error en POST /api/tool-requests:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 