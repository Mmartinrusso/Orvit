import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { subMonths, differenceInDays } from 'date-fns';

export const dynamic = 'force-dynamic';

type AlertType =
  | 'CREDITO_CERCANO'
  | 'CREDITO_EXCEDIDO'
  | 'MORA'
  | 'MORA_ALTA'
  | 'CHEQUES_VENCEN'
  | 'CHEQUE_RECHAZADO'
  | 'SIN_ACTIVIDAD'
  | 'ABANDONO'
  | 'CAIDA_VENTAS'
  | 'DATOS_INCOMPLETOS'
  | 'EXENCION_VENCE';

type Priority = 'ALTA' | 'MEDIA' | 'BAJA';

interface ClientAlert {
  id: string;
  clientId: string;
  clientName: string;
  clientCode: string | null;
  tipo: AlertType;
  prioridad: Priority;
  mensaje: string;
  detalles: {
    valorActual?: number;
    valorEsperado?: number;
    diferencia?: number;
    fechaVencimiento?: string;
    diasMora?: number;
    facturaId?: string;
  };
  sugerencias: string[];
  fechaDeteccion: Date;
}

interface AlertsResponse {
  alerts: ClientAlert[];
  summary: {
    total: number;
    porTipo: Record<string, number>;
    porPrioridad: Record<string, number>;
  };
}

// GET: Obtener alertas de clientes
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CLIENTES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const viewMode = getViewMode(request);
    const { searchParams } = new URL(request.url);

    const tipo = searchParams.get('tipo') || 'all'; // Filtro por tipo
    const prioridad = searchParams.get('prioridad') || 'all'; // Filtro por prioridad
    const limite = parseInt(searchParams.get('limite') || '100', 10);

    const now = new Date();
    const last90Days = subMonths(now, 3);
    const last180Days = subMonths(now, 6);

    // Obtener todos los clientes activos
    const clients = await prisma.client.findMany({
      where: {
        companyId,
        isActive: true,
      },
      select: {
        id: true,
        legalName: true,
        name: true,
        email: true,
        phone: true,
        creditLimit: true,
        currentBalance: true,
        isBlocked: true,
        createdAt: true,
        // Exenciones
        isVatPerceptionExempt: true,
        vatPerceptionExemptUntil: true,
        isGrossIncomeExempt: true,
        grossIncomeExemptUntil: true,
      },
    });

    const alerts: ClientAlert[] = [];

    // Procesar cada cliente
    for (const client of clients) {
      const clientAlerts: ClientAlert[] = [];
      const creditLimit = Number(client.creditLimit || 0);
      const currentBalance = Number(client.currentBalance || 0);
      const clientDisplayName = client.legalName || client.name || 'Cliente sin nombre';

      // ========================================
      // 1. ALERTAS DE CRÉDITO
      // ========================================
      if (creditLimit > 0 && tipo === 'all' || tipo === 'credito') {
        const utilizationRate = (currentBalance / creditLimit) * 100;

        // Crédito excedido
        if (utilizationRate >= 100) {
          clientAlerts.push({
            id: `${client.id}-credito-excedido`,
            clientId: client.id,
            clientName: clientDisplayName,
            clientCode: null,
            tipo: 'CREDITO_EXCEDIDO',
            prioridad: 'ALTA',
            mensaje: `Límite de crédito excedido: $${currentBalance.toFixed(2)} / $${creditLimit.toFixed(2)}`,
            detalles: {
              valorActual: currentBalance,
              valorEsperado: creditLimit,
              diferencia: currentBalance - creditLimit,
            },
            sugerencias: [
              'Bloquear nuevas ventas hasta regularizar',
              'Contactar al cliente para gestionar pago',
              'Revisar historial de pagos',
            ],
            fechaDeteccion: now,
          });
        }
        // Cerca del límite (>80%)
        else if (utilizationRate >= 80) {
          clientAlerts.push({
            id: `${client.id}-credito-cercano`,
            clientId: client.id,
            clientName: clientDisplayName,
            clientCode: null,
            tipo: 'CREDITO_CERCANO',
            prioridad: 'MEDIA',
            mensaje: `Cerca del límite de crédito: ${utilizationRate.toFixed(1)}% utilizado`,
            detalles: {
              valorActual: currentBalance,
              valorEsperado: creditLimit,
            },
            sugerencias: [
              'Monitorear próximas ventas',
              'Considerar aumentar límite si historial es bueno',
              'Contactar cliente para coordinar pago',
            ],
            fechaDeteccion: now,
          });
        }
      }

      // ========================================
      // 2. ALERTAS DE MORA
      // ========================================
      if (tipo === 'all' || tipo === 'mora') {
        const overdueInvoices = await prisma.salesInvoice.findMany({
          where: applyViewMode(
            {
              clientId: client.id,
              companyId,
              fechaVencimiento: { lt: now },
              saldoPendiente: { gt: 0 },
              estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] },
            },
            viewMode
          ),
          select: {
            id: true,
            numero: true,
            fechaVencimiento: true,
            saldoPendiente: true,
          },
        });

        if (overdueInvoices.length > 0) {
          const totalOverdue = overdueInvoices.reduce(
            (sum, inv) => sum + Number(inv.saldoPendiente || 0),
            0
          );
          const oldestInvoice = overdueInvoices.sort(
            (a, b) =>
              (a.fechaVencimiento?.getTime() || 0) - (b.fechaVencimiento?.getTime() || 0)
          )[0];
          const diasMora = oldestInvoice.fechaVencimiento
            ? differenceInDays(now, oldestInvoice.fechaVencimiento)
            : 0;

          const prioridad: Priority = diasMora > 60 ? 'ALTA' : diasMora > 30 ? 'MEDIA' : 'BAJA';
          const tipo: AlertType = diasMora > 60 ? 'MORA_ALTA' : 'MORA';

          clientAlerts.push({
            id: `${client.id}-mora`,
            clientId: client.id,
            clientName: clientDisplayName,
            clientCode: null,
            tipo,
            prioridad,
            mensaje: `${overdueInvoices.length} factura(s) vencida(s) - ${diasMora} días de mora`,
            detalles: {
              valorActual: totalOverdue,
              diasMora,
              facturaId: oldestInvoice.numero,
            },
            sugerencias: [
              'Contactar urgente al cliente',
              'Evaluar bloqueo de cuenta',
              'Revisar garantías o cheques',
              'Iniciar gestión de cobranza legal',
            ],
            fechaDeteccion: now,
          });
        }
      }

      // ========================================
      // 3. ALERTAS DE ACTIVIDAD
      // ========================================
      if (tipo === 'all' || tipo === 'actividad') {
        const recentInvoices = await prisma.salesInvoice.count({
          where: applyViewMode(
            {
              clientId: client.id,
              companyId,
              fechaEmision: { gte: last90Days },
              estado: { notIn: ['CANCELADA', 'ANULADA'] },
            },
            viewMode
          ),
        });

        const veryOldInvoices = await prisma.salesInvoice.count({
          where: applyViewMode(
            {
              clientId: client.id,
              companyId,
              fechaEmision: { gte: last180Days },
              estado: { notIn: ['CANCELADA', 'ANULADA'] },
            },
            viewMode
          ),
        });

        const daysSinceCreation = differenceInDays(now, client.createdAt);

        // Sin actividad en 90 días (solo si es cliente "maduro" > 90 días)
        if (recentInvoices === 0 && daysSinceCreation > 90) {
          if (veryOldInvoices === 0) {
            // Abandono total (>180 días sin compras)
            clientAlerts.push({
              id: `${client.id}-abandono`,
              clientId: client.id,
              clientName: clientDisplayName,
              clientCode: null,
              tipo: 'ABANDONO',
              prioridad: 'ALTA',
              mensaje: 'Cliente sin compras en los últimos 6 meses',
              detalles: {},
              sugerencias: [
                'Contactar para entender motivo de inactividad',
                'Ofrecer promoción de reactivación',
                'Evaluar si desactivar el cliente',
              ],
              fechaDeteccion: now,
            });
          } else {
            // Sin actividad reciente (90-180 días)
            clientAlerts.push({
              id: `${client.id}-sin-actividad`,
              clientId: client.id,
              clientName: clientDisplayName,
              clientCode: null,
              tipo: 'SIN_ACTIVIDAD',
              prioridad: 'MEDIA',
              mensaje: 'Cliente sin compras en los últimos 3 meses',
              detalles: {},
              sugerencias: [
                'Contactar para coordinar visita',
                'Enviar ofertas o novedades',
                'Verificar satisfacción del cliente',
              ],
              fechaDeteccion: now,
            });
          }
        }
      }

      // ========================================
      // 4. ALERTAS DE DATOS INCOMPLETOS
      // ========================================
      if (tipo === 'all' || tipo === 'datos') {
        const missingFields: string[] = [];
        if (!client.email) missingFields.push('email');
        if (!client.phone) missingFields.push('teléfono');

        if (missingFields.length > 0) {
          clientAlerts.push({
            id: `${client.id}-datos-incompletos`,
            clientId: client.id,
            clientName: clientDisplayName,
            clientCode: null,
            tipo: 'DATOS_INCOMPLETOS',
            prioridad: 'BAJA',
            mensaje: `Datos incompletos: faltan ${missingFields.join(', ')}`,
            detalles: {},
            sugerencias: ['Completar datos de contacto', 'Solicitar información al vendedor'],
            fechaDeteccion: now,
          });
        }
      }

      // ========================================
      // 5. ALERTAS DE EXENCIONES
      // ========================================
      if (tipo === 'all' || tipo === 'exenciones') {
        const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        if (
          client.isVatPerceptionExempt &&
          client.vatPerceptionExemptUntil &&
          client.vatPerceptionExemptUntil <= next30Days
        ) {
          const daysUntilExpiry = differenceInDays(client.vatPerceptionExemptUntil, now);
          clientAlerts.push({
            id: `${client.id}-exencion-vence`,
            clientId: client.id,
            clientName: clientDisplayName,
            clientCode: null,
            tipo: 'EXENCION_VENCE',
            prioridad: daysUntilExpiry <= 7 ? 'ALTA' : 'MEDIA',
            mensaje: `Exención de percepción IVA vence en ${daysUntilExpiry} días`,
            detalles: {
              fechaVencimiento: client.vatPerceptionExemptUntil.toISOString().substring(0, 10),
            },
            sugerencias: [
              'Solicitar renovación de certificado',
              'Actualizar datos en el sistema',
            ],
            fechaDeteccion: now,
          });
        }

        if (
          client.isGrossIncomeExempt &&
          client.grossIncomeExemptUntil &&
          client.grossIncomeExemptUntil <= next30Days
        ) {
          const daysUntilExpiry = differenceInDays(client.grossIncomeExemptUntil, now);
          clientAlerts.push({
            id: `${client.id}-exencion-iibb-vence`,
            clientId: client.id,
            clientName: clientDisplayName,
            clientCode: null,
            tipo: 'EXENCION_VENCE',
            prioridad: daysUntilExpiry <= 7 ? 'ALTA' : 'MEDIA',
            mensaje: `Exención de IIBB vence en ${daysUntilExpiry} días`,
            detalles: {
              fechaVencimiento: client.grossIncomeExemptUntil.toISOString().substring(0, 10),
            },
            sugerencias: [
              'Solicitar renovación de certificado',
              'Actualizar datos en el sistema',
            ],
            fechaDeteccion: now,
          });
        }
      }

      alerts.push(...clientAlerts);
    }

    // Aplicar filtros
    let filteredAlerts = alerts;
    if (tipo !== 'all') {
      const typeMap: Record<string, AlertType[]> = {
        credito: ['CREDITO_CERCANO', 'CREDITO_EXCEDIDO'],
        mora: ['MORA', 'MORA_ALTA'],
        actividad: ['SIN_ACTIVIDAD', 'ABANDONO', 'CAIDA_VENTAS'],
        datos: ['DATOS_INCOMPLETOS'],
        exenciones: ['EXENCION_VENCE'],
      };
      if (typeMap[tipo]) {
        filteredAlerts = filteredAlerts.filter((a) => typeMap[tipo].includes(a.tipo));
      }
    }

    if (prioridad !== 'all') {
      filteredAlerts = filteredAlerts.filter(
        (a) => a.prioridad === prioridad.toUpperCase()
      );
    }

    // Ordenar por prioridad (ALTA > MEDIA > BAJA)
    const priorityOrder = { ALTA: 1, MEDIA: 2, BAJA: 3 };
    filteredAlerts.sort((a, b) => priorityOrder[a.prioridad] - priorityOrder[b.prioridad]);

    // Limitar resultados
    const limitedAlerts = filteredAlerts.slice(0, limite);

    // Calcular resumen
    const porTipo: Record<string, number> = {};
    const porPrioridad: Record<string, number> = {};

    filteredAlerts.forEach((alert) => {
      porTipo[alert.tipo] = (porTipo[alert.tipo] || 0) + 1;
      porPrioridad[alert.prioridad] = (porPrioridad[alert.prioridad] || 0) + 1;
    });

    const response: AlertsResponse = {
      alerts: limitedAlerts,
      summary: {
        total: filteredAlerts.length,
        porTipo,
        porPrioridad,
      },
    };

    const headers = new Headers();
    headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=600'); // 5 min cache

    return NextResponse.json(response, { headers });
  } catch (error) {
    console.error('Error obteniendo alertas de clientes:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
