import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';
import { PaymentRequestStatus, Priority } from '@prisma/client';
import { logCreation } from '@/lib/compras/audit-helper';
import { getViewMode } from '@/lib/view-mode/get-mode';
import { MODE } from '@/lib/view-mode/types';
import { hasUserPermission } from '@/lib/permissions-helpers';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Caché en memoria para solicitudes (5 minutos TTL)
const solicitudesCache = new Map<string, { data: any; timestamp: number }>();
const SOLICITUDES_CACHE_TTL = 5 * 60 * 1000;

async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    // JWT tiene userId, no id
    return {
      id: payload.userId as number,
      email: payload.email as string,
      name: payload.name as string
    };
  } catch (error) {
    return null;
  }
}

// Mapeo de prioridades frontend -> backend
const mapPrioridad = (prioridad: string): Priority => {
  const map: Record<string, Priority> = {
    'baja': 'LOW',
    'media': 'MEDIUM',
    'alta': 'HIGH',
    'urgente': 'URGENT',
    'LOW': 'LOW',
    'MEDIUM': 'MEDIUM',
    'HIGH': 'HIGH',
    'URGENT': 'URGENT'
  };
  return map[prioridad] || 'MEDIUM';
};

// Mapeo de prioridades backend -> frontend
const mapPrioridadToFrontend = (prioridad: Priority): string => {
  const map: Record<Priority, string> = {
    'LOW': 'baja',
    'MEDIUM': 'media',
    'HIGH': 'alta',
    'URGENT': 'urgente'
  };
  return map[prioridad] || 'media';
};

// Mapeo de estados backend -> frontend
const mapEstadoToFrontend = (estado: PaymentRequestStatus): string => {
  const map: Record<PaymentRequestStatus, string> = {
    'BORRADOR': 'borrador',
    'SOLICITADA': 'pendiente',
    'EN_REVISION': 'en_revision',
    'APROBADA': 'aprobada',
    'RECHAZADA': 'rechazada',
    'CONVERTIDA': 'convertida',
    'PAGADA': 'pagada',
    'CANCELADA': 'cancelada'
  };
  return map[estado] || 'pendiente';
};

// GET /api/compras/solicitudes - Obtener solicitudes de pago
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
    const companyId = searchParams.get('companyId');
    const forceRefresh = searchParams.get('_refresh') === 'true';

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    // Obtener ViewMode desde header X-VM (inyectado por middleware)
    const viewMode = getViewMode(request);

    // Verificar caché solo si no se fuerza la recarga
    // Incluir viewMode en cache key para separar resultados
    const cacheKey = `solicitudes-${companyId}-${viewMode}`;
    if (!forceRefresh) {
      const cached = solicitudesCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < SOLICITUDES_CACHE_TTL) {
        return NextResponse.json(cached.data, {
          headers: {
            'Cache-Control': 'public, max-age=300',
            'X-Cache': 'HIT'
          }
        });
      }
    }

    // Obtener solicitudes desde PaymentRequest
    const paymentRequests = await prisma.paymentRequest.findMany({
      where: {
        companyId: parseInt(companyId)
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        proveedor: {
          select: {
            id: true,
            name: true,
            razon_social: true
          }
        },
        createdByUser: {
          select: {
            id: true,
            name: true
          }
        },
        facturas: {
          include: {
            receipt: {
              select: {
                id: true,
                numeroSerie: true,
                numeroFactura: true,
                tipo: true,
                total: true,
                estado: true,
                fechaVencimiento: true,
                docType: true  // Incluir docType para filtrado ViewMode
              }
            }
          }
        }
      },
      take: 200
    });

    // ========================================
    // FILTRADO POR VIEWMODE
    // ========================================
    // Standard mode: solo mostrar solicitudes donde TODAS las facturas son T1 o null
    // Extended mode: mostrar todas las solicitudes
    let filteredRequests = paymentRequests;

    if (viewMode === MODE.STANDARD) {
      filteredRequests = paymentRequests.filter(pr => {
        // Si no tiene facturas, mostrar (legacy)
        if (!pr.facturas || pr.facturas.length === 0) return true;

        // Verificar que NINGUNA factura sea T2
        return pr.facturas.every(f => {
          const docType = f.receipt?.docType;
          // T1 o null (legacy) son permitidos en Standard
          return docType === 'T1' || docType === null || docType === undefined;
        });
      });
    }

    // Transformar al formato esperado por el frontend
    const solicitudes = filteredRequests.map(pr => {
      // Determinar docType de la solicitud basado en sus facturas
      const docTypes = pr.facturas.map(f => f.receipt?.docType || 'T1');
      const hasT1 = docTypes.some(dt => dt === 'T1');
      const hasT2 = docTypes.some(dt => dt === 'T2');
      // Si tiene ambos tipos, es "mixto". Si no tiene facturas, es T1 por defecto
      const solicitudDocType = hasT1 && hasT2 ? 'MIXED' : (hasT2 ? 'T2' : 'T1');

      return {
        id: pr.id.toString(),
        numero: pr.numero,
        proveedor: pr.proveedor?.name || pr.proveedor?.razon_social || 'N/A',
        proveedorId: pr.proveedorId,
        solicitante: pr.createdByUser?.name || 'Usuario',
        departamento: 'Compras', // TODO: agregar campo departamento si se necesita
        fecha: pr.fechaSolicitud.toISOString(),
        fechaRequerida: pr.fechaObjetivo?.toISOString() || pr.fechaSolicitud.toISOString(),
        estado: mapEstadoToFrontend(pr.estado),
        monto: Number(pr.montoTotal),
        items: pr.facturas.length,
        prioridad: mapPrioridadToFrontend(pr.prioridad),
        observaciones: pr.motivo || null,
        docType: solicitudDocType,  // T1, T2, o MIXED (solo visible en Extended mode)
        facturas: pr.facturas.map(f => ({
          id: f.receiptId,
          numeroSerie: f.receipt?.numeroSerie || '',
          numeroFactura: f.receipt?.numeroFactura || '',
          tipo: f.receipt?.tipo || '',
          total: Number(f.montoSolicitado),
          estado: f.receipt?.estado || 'pendiente',
          fechaVencimiento: f.receipt?.fechaVencimiento?.toISOString() || null,
          docType: f.receipt?.docType || 'T1'  // Incluir docType de cada factura
        })),
        esUrgente: pr.esUrgente,
        createdAt: pr.createdAt.toISOString()
      };
    });

    const response = {
      success: true,
      solicitudes
    };

    // Guardar en caché
    solicitudesCache.set(cacheKey, {
      data: response,
      timestamp: Date.now()
    });

    // Limpiar caché antiguo
    if (solicitudesCache.size > 50) {
      const now = Date.now();
      for (const [key, value] of solicitudesCache.entries()) {
        if (now - value.timestamp > SOLICITUDES_CACHE_TTL) {
          solicitudesCache.delete(key);
        }
      }
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300',
        'X-Cache': 'MISS'
      }
    });
  } catch (error) {
    console.error('Error en GET /api/compras/solicitudes:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/compras/solicitudes - Crear nueva solicitud de pago
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      companyId,
      proveedorId,
      prioridad,
      facturas,
      observaciones,
      total,
      fechaObjetivo,
      esBorrador = false
    } = body;

    // Validaciones
    if (!companyId || !proveedorId || !prioridad) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos (companyId, proveedorId, prioridad)' },
        { status: 400 }
      );
    }

    if (!facturas || facturas.length === 0) {
      return NextResponse.json(
        { error: 'Debe seleccionar al menos un comprobante' },
        { status: 400 }
      );
    }

    // Permission check: ingresar_compras
    const hasPerm = await hasUserPermission(user.id, parseInt(companyId), 'ingresar_compras');
    if (!hasPerm) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    // Obtener ViewMode desde header X-VM (inyectado por middleware)
    const viewMode = getViewMode(request);

    // Usar transacción para garantizar consistencia
    const result = await prisma.$transaction(async (tx) => {
      // 0. VALIDACIÓN VIEWMODE: Verificar docType de las facturas seleccionadas
      const receiptIds = facturas.map((f: any) => parseInt(f.id));
      const receiptsConDocType = await tx.purchaseReceipt.findMany({
        where: { id: { in: receiptIds } },
        select: { id: true, docType: true, numeroFactura: true }
      });

      // En Standard mode, no se pueden incluir facturas T2
      if (viewMode === MODE.STANDARD) {
        const facturasT2 = receiptsConDocType.filter(r => r.docType === 'T2');
        if (facturasT2.length > 0) {
          throw new Error('No autorizado: las facturas seleccionadas no son accesibles');
        }
      }

      // 1. Verificar que el proveedor existe
      const proveedor = await tx.suppliers.findFirst({
        where: {
          id: parseInt(proveedorId),
          company_id: parseInt(companyId)
        },
        select: {
          id: true,
          name: true,
          razon_social: true
        }
      });

      if (!proveedor) {
        throw new Error('Proveedor no encontrado');
      }

      // 2. Validar que los comprobantes no estén en otra solicitud activa
      // (receiptIds ya fue declarado en la validación de ViewMode)
      const duplicados = await tx.paymentRequestReceipt.findMany({
        where: {
          receiptId: { in: receiptIds },
          paymentRequest: {
            estado: { notIn: ['RECHAZADA', 'CANCELADA', 'PAGADA'] }
          }
        },
        include: {
          paymentRequest: {
            select: { numero: true }
          }
        }
      });

      if (duplicados.length > 0) {
        const numeros = [...new Set(duplicados.map(d => d.paymentRequest.numero))];
        throw new Error(`Comprobante(s) ya incluido(s) en solicitud(es): ${numeros.join(', ')}`);
      }

      // 3. Generar número de solicitud transaccional
      // Usar MAX número en lugar de COUNT para evitar colisiones
      const year = new Date().getFullYear();
      const prefix = `SP-${year}-`;

      const lastSolicitud = await tx.paymentRequest.findFirst({
        where: {
          companyId: parseInt(companyId),
          numero: { startsWith: prefix }
        },
        orderBy: { numero: 'desc' },
        select: { numero: true }
      });

      let nextNumber = 1;
      if (lastSolicitud?.numero) {
        // Extraer el número del formato SP-2026-00005
        const parts = lastSolicitud.numero.split('-');
        const lastNum = parseInt(parts[2] || '0', 10);
        nextNumber = lastNum + 1;
      }

      const numero = `${prefix}${String(nextNumber).padStart(5, '0')}`;

      // 4. Calcular total en backend (no confiar en frontend)
      const montoTotal = facturas.reduce((sum: number, f: any) => {
        const monto = parseFloat(f.total) || 0;
        return sum + monto;
      }, 0);

      // 5. Crear la solicitud
      const paymentRequest = await tx.paymentRequest.create({
        data: {
          numero,
          companyId: parseInt(companyId),
          proveedorId: parseInt(proveedorId),
          estado: esBorrador ? 'BORRADOR' : 'SOLICITADA',
          prioridad: mapPrioridad(prioridad),
          fechaSolicitud: new Date(),
          fechaObjetivo: fechaObjetivo ? new Date(fechaObjetivo) : null,
          montoTotal,
          motivo: observaciones || null,
          esUrgente: prioridad === 'urgente' || prioridad === 'URGENT',
          createdBy: user.id,
          facturas: {
            create: facturas.map((f: any) => ({
              receiptId: parseInt(f.id),
              montoSolicitado: parseFloat(f.total) || 0
            }))
          }
        },
        include: {
          proveedor: {
            select: { name: true, razon_social: true }
          },
          facturas: true
        }
      });

      // 6. Registrar en auditoría - comentado hasta que se ejecute la migración
      // await tx.paymentRequestLog.create({
      //   data: {
      //     paymentRequestId: paymentRequest.id,
      //     accion: 'CREADA',
      //     estadoNuevo: paymentRequest.estado,
      //     prioridadNueva: paymentRequest.prioridad,
      //     userId: user.id,
      //     detalles: {
      //       numero,
      //       proveedorId: parseInt(proveedorId),
      //       proveedorNombre: proveedor.name || proveedor.razon_social,
      //       cantidadComprobantes: facturas.length,
      //       montoTotal
      //     }
      //   }
      // });

      return {
        paymentRequest,
        proveedor
      };
    });

    // Invalidar caché (ambos modos, ya que una nueva solicitud puede afectar ambos)
    solicitudesCache.delete(`solicitudes-${companyId}-S`);
    solicitudesCache.delete(`solicitudes-${companyId}-E`);

    // Invalidar caché de Next.js
    try {
      const { revalidatePath } = await import('next/cache');
      revalidatePath('/administracion/compras/solicitudes');
    } catch (error) {
      console.error('Error al revalidar ruta:', error);
    }

    // Registrar auditoría
    await logCreation({
      entidad: 'payment_request',
      entidadId: result.paymentRequest.id,
      companyId: parseInt(companyId),
      userId: user.id as number,
      estadoInicial: result.paymentRequest.estado,
      amount: Number(result.paymentRequest.montoTotal),
    });

    return NextResponse.json({
      success: true,
      solicitud: {
        id: result.paymentRequest.id,
        numero: result.paymentRequest.numero,
        proveedor: result.proveedor.name || result.proveedor.razon_social,
        proveedorId: result.paymentRequest.proveedorId,
        estado: mapEstadoToFrontend(result.paymentRequest.estado),
        prioridad: mapPrioridadToFrontend(result.paymentRequest.prioridad),
        monto: Number(result.paymentRequest.montoTotal),
        items: result.paymentRequest.facturas.length,
        createdAt: result.paymentRequest.createdAt.toISOString()
      },
      message: 'Solicitud de pago creada exitosamente'
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      }
    });
  } catch (error) {
    console.error('Error en POST /api/compras/solicitudes:', error);

    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    const isValidationError = message.includes('Comprobante') ||
                              message.includes('Proveedor') ||
                              message.includes('requerido');

    return NextResponse.json(
      {
        error: message,
        success: false
      },
      { status: isValidationError ? 400 : 500 }
    );
  }
}

// Función para invalidar caché de solicitudes (exportada para uso en otros endpoints)
export function invalidateSolicitudesCache(companyId: number) {
  // Invalidar ambos modos (S y E)
  solicitudesCache.delete(`solicitudes-${companyId}-S`);
  solicitudesCache.delete(`solicitudes-${companyId}-E`);
}
