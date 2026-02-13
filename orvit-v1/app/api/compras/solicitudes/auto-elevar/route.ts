import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

const prisma = new PrismaClient();

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return payload as { id: number; email: string; name: string };
  } catch (error) {
    return null;
  }
}

// POST /api/compras/solicitudes/auto-elevar - Auto-elevar prioridades de solicitudes
// Este endpoint debería ser llamado periódicamente (ej: por un cron job)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    // Obtener todas las solicitudes pendientes o en revisión
    const documentos = await prisma.document.findMany({
      where: {
        entityType: 'SOLICITUD_PAGO',
        url: {
          contains: `"companyId":${parseInt(companyId)}`
        }
      }
    });

    const ahora = new Date();
    let elevadas = 0;
    const resultados = [];

    for (const doc of documentos) {
      try {
        const solicitudData = JSON.parse(doc.url);
        
        // Solo procesar si no está aprobada, rechazada o convertida
        if (['aprobada', 'rechazada', 'convertida'].includes(solicitudData.estado)) {
          continue;
        }

        const fechaCreacion = new Date(solicitudData.createdAt);
        const diasTranscurridos = Math.floor((ahora.getTime() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24));
        const prioridadInicial = solicitudData.prioridadInicial || solicitudData.prioridad;
        let nuevaPrioridad = solicitudData.prioridad;
        let cambio = false;

        // Elevación progresiva: determinar el nivel máximo según los días transcurridos
        // Todos los umbrales se calculan desde la fecha de creación
        
        // Verificar en orden: primero el más alto nivel, luego los inferiores
        let prioridadObjetivo = prioridadInicial;

        // Si tiene configuración para pasar a urgente
        if (solicitudData.diasAltaAUrgente && diasTranscurridos >= solicitudData.diasAltaAUrgente) {
          prioridadObjetivo = 'urgente';
        }
        // Si tiene configuración para pasar a alta (y aún no llegó a urgente)
        else if (solicitudData.diasMediaAAlta && diasTranscurridos >= solicitudData.diasMediaAAlta) {
          prioridadObjetivo = 'alta';
        }
        // Si empieza en baja y tiene configuración para pasar a media (y aún no llegó a alta)
        else if (prioridadInicial === 'baja' && solicitudData.diasBajaAMedia && diasTranscurridos >= solicitudData.diasBajaAMedia) {
          prioridadObjetivo = 'media';
        }

        // Solo elevar si la prioridad objetivo es mayor que la actual
        const niveles = { baja: 1, media: 2, alta: 3, urgente: 4 };
        if (niveles[prioridadObjetivo] > niveles[nuevaPrioridad]) {
          nuevaPrioridad = prioridadObjetivo;
          cambio = true;
        }

        // Si hay cambio, actualizar el documento
        if (cambio && nuevaPrioridad !== solicitudData.prioridad) {
          solicitudData.prioridad = nuevaPrioridad;
          solicitudData.ultimaElevacion = ahora.toISOString();
          
          await prisma.document.update({
            where: { id: doc.id },
            data: {
              url: JSON.stringify(solicitudData)
            }
          });

          elevadas++;
          resultados.push({
            id: doc.id,
            numero: solicitudData.numero,
            prioridadAnterior: solicitudData.prioridad,
            nuevaPrioridad: nuevaPrioridad,
            diasTranscurridos
          });
        }
      } catch (error) {
        console.error(`Error procesando solicitud ${doc.id}:`, error);
        continue;
      }
    }

    return NextResponse.json({
      success: true,
      elevadas,
      resultados,
      message: `Se elevaron ${elevadas} solicitud(es) de prioridad`
    });
  } catch (error) {
    console.error('Error en POST /api/compras/solicitudes/auto-elevar:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (error as Error).message },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

