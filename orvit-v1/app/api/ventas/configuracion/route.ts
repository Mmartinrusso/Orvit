/**
 * Sales Configuration API
 *
 * Allows companies to customize sales workflows and behavior
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schema for configuration updates
const salesConfigSchema = z.object({
  // Document numbering
  quotePrefix: z.string().max(10).optional(),
  salePrefix: z.string().max(10).optional(),
  deliveryPrefix: z.string().max(10).optional(),
  remitoPrefix: z.string().max(10).optional(),
  invoicePrefix: z.string().max(10).optional(),
  paymentPrefix: z.string().max(10).optional(),
  puntoVenta: z.string().max(5).optional(),

  // Approval workflows
  requiereAprobacionCotizacion: z.boolean().optional(),
  montoMinimoAprobacionCot: z.number().optional(),
  requiereAprobacionDescuento: z.boolean().optional(),
  maxDescuentoSinAprobacion: z.number().optional(),
  requiereAprobacionPagos: z.boolean().optional(),
  requiereAprobacionPagosMontoMinimo: z.number().optional(),
  aprobacionPagosTiposRequieren: z.string().optional(), // JSON string
  requiereAprobacionFacturas: z.boolean().optional(),
  requiereAprobacionFacturasMontoMinimo: z.number().optional(),

  // Credit enforcement
  validarLimiteCredito: z.boolean().optional(),
  bloquearVentaSinCredito: z.boolean().optional(),
  nivelEnforcementCredito: z.enum(['STRICT', 'WARNING', 'DISABLED']).optional(),
  diasVencimientoDefault: z.number().int().optional(),

  // Stock enforcement
  validarStockDisponible: z.boolean().optional(),
  permitirVentaSinStock: z.boolean().optional(),
  decrementarStockEnConfirmacion: z.boolean().optional(),
  nivelEnforcementStock: z.enum(['STRICT', 'WARNING', 'DISABLED']).optional(),
  reservarStockEnCotizacion: z.boolean().optional(),

  // Margins
  margenMinimoPermitido: z.number().optional(),
  alertarMargenBajo: z.boolean().optional(),

  // Pricing
  pricingMethod: z.enum(['LIST', 'MARGIN', 'DISCOUNT']).optional(),
  showCostsInQuotes: z.boolean().optional(),
  showMarginsInQuotes: z.boolean().optional(),

  // Commission
  comisionVendedorDefault: z.number().optional(),

  // Tax
  tasaIvaDefault: z.number().optional(),

  // Quote validity
  diasValidezCotizacion: z.number().int().optional(),

  // Portal del Cliente
  portalEnabled: z.boolean().optional(),
  portalShowStock: z.boolean().optional(),
  portalShowOriginalPrice: z.boolean().optional(),
  portalAutoApproveOrders: z.boolean().optional(),
  portalOrderMinAmount: z.number().optional(),
  portalSessionDays: z.number().int().optional(),
  portalInviteExpiryHours: z.number().int().optional(),
  portalWelcomeMessage: z.string().optional(),
  portalNotifyEmails: z.string().optional(),
  portalRequireApprovalAbove: z.number().optional(),

  // Acopios
  habilitarAcopios: z.boolean().optional(),
  acopioPrefix: z.string().max(10).optional(),
  retiroPrefix: z.string().max(10).optional(),
  diasAlertaAcopioDefault: z.number().int().optional(),
  diasVencimientoAcopioDefault: z.number().int().optional(),
  bloquearVentaAcopioExcedido: z.boolean().optional(),
  alertarAcopioExcedido: z.boolean().optional(),

  // Client form configuration
  clientFormEnabledFields: z.record(z.boolean()).optional(),
  maxClientFormFeatures: z.number().int().nullable().optional(),

  // ═══ NEW WORKFLOW CONFIGURATION ═══

  // Sales order workflow
  requiereConfirmacionOrden: z.boolean().optional(),
  permitirOrdenSinStock: z.boolean().optional(),
  permitirOrdenSinCredito: z.boolean().optional(),

  // Notification settings
  notificarNuevaCotizacion: z.boolean().optional(),
  notificarOrdenConfirmada: z.boolean().optional(),
  notificarEntregaProgramada: z.boolean().optional(),
  notificarFacturaEmitida: z.boolean().optional(),
  notificarPagoRecibido: z.boolean().optional(),
  emailsNotificaciones: z.string().optional(),

  // Module enablement
  moduloCotizacionesHabilitado: z.boolean().optional(),
  moduloOrdenesHabilitado: z.boolean().optional(),
  moduloEntregasHabilitado: z.boolean().optional(),
  moduloFacturasHabilitado: z.boolean().optional(),
  moduloCobranzasHabilitado: z.boolean().optional(),
  moduloRemitosHabilitado: z.boolean().optional(),
  moduloNotasCreditoHabilitado: z.boolean().optional(),
  moduloTurnosHabilitado: z.boolean().optional(),
  moduloDisputasHabilitado: z.boolean().optional(),
  moduloValoresHabilitado: z.boolean().optional(),

  // Delivery requirements
  requiereConductorEnDespacho: z.boolean().optional(),
  requiereVehiculoEnDespacho: z.boolean().optional(),
  requiereEvidenciaEntrega: z.boolean().optional(),

  // Delivery SLA Configuration
  deliverySlaPreparacionMaxHoras: z.number().int().min(1).optional(),
  deliverySlaTransitoMaxHoras: z.number().int().min(1).optional(),
  deliverySlaAlertaRetrasoHoras: z.number().int().min(0).optional(),

  // Delivery Evidence Requirements
  requiereFirmaCliente: z.boolean().optional(),
  requiereFotoEntrega: z.boolean().optional(),
  requiereDniReceptor: z.boolean().optional(),

  // Delivery Notification Templates (JSON)
  deliveryNotificationTemplates: z.record(z.string()).optional(),

  // Delivery Workflow
  deliveryTipoDefault: z.enum(['ENVIO', 'RETIRO']).optional(),
  permitirEntregaSinOrden: z.boolean().optional(),
  deliveryOptionalStates: z.array(z.string()).optional(),

  // Delivery Cost
  costoFleteDefault: z.number().min(0).optional(),
  calcularFleteAutomatico: z.boolean().optional(),

  // Mandatory fields (JSON strings)
  camposObligatoriosCotizacion: z.string().optional(),
  camposObligatoriosOrden: z.string().optional(),
  camposObligatoriosFactura: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CONFIG_VIEW);
    if (error) return error;

    let config = await prisma.salesConfig.findUnique({
      where: { companyId: user!.companyId },
    });

    // If config doesn't exist, create default
    if (!config) {
      config = await prisma.salesConfig.create({
        data: {
          companyId: user!.companyId,
        },
      });
    }

    return NextResponse.json({ data: config });
  } catch (error) {
    console.error('Error fetching sales configuration:', error);
    return NextResponse.json(
      { error: 'Error al obtener configuración' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CONFIG_EDIT);
    if (error) return error;

    const body = await req.json();

    // Validate input
    const validation = salesConfigSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Datos inválidos',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Check if config exists
    let config = await prisma.salesConfig.findUnique({
      where: { companyId: user!.companyId },
    });

    if (!config) {
      // Create with provided data
      config = await prisma.salesConfig.create({
        data: {
          companyId: user!.companyId,
          ...data,
        },
      });
    } else {
      // Update existing
      config = await prisma.salesConfig.update({
        where: { companyId: user!.companyId },
        data,
      });
    }

    return NextResponse.json({ data: config });
  } catch (error) {
    console.error('Error updating sales configuration:', error);
    return NextResponse.json(
      { error: 'Error al actualizar configuración' },
      { status: 500 }
    );
  }
}

/**
 * Helper endpoint to get specific configuration value
 * GET /api/ventas/configuracion?key=requiereAprobacionPagos
 */
export async function HEAD(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CONFIG_VIEW);
    if (error) return error;

    const url = new URL(req.url);
    const key = url.searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'Key parameter required' }, { status: 400 });
    }

    const config = await prisma.salesConfig.findUnique({
      where: { companyId: user!.companyId },
      select: { [key]: true },
    });

    if (!config) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
    }

    return NextResponse.json({ data: config });
  } catch (error) {
    console.error('Error fetching configuration key:', error);
    return NextResponse.json(
      { error: 'Error al obtener configuración' },
      { status: 500 }
    );
  }
}
