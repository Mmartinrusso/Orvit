import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

function formatDate(date: Date | null): string {
  if (!date) return '';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(date));
}

const estadoLabels: Record<string, string> = {
  BORRADOR: 'Borrador',
  ENVIADA: 'Enviada',
  EN_NEGOCIACION: 'En Negociación',
  ACEPTADA: 'Aceptada',
  CONVERTIDA: 'Convertida',
  PERDIDA: 'Perdida',
  VENCIDA: 'Vencida'
};

// GET - Exportar cotizaciones a Excel
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_EXPORT);
    if (error) return error;

    const companyId = user!.companyId;

    const { searchParams } = new URL(request.url);

    // Filtros (mismos que el listado)
    const estado = searchParams.get('estado');
    const clienteId = searchParams.get('clienteId');
    const vendedorId = searchParams.get('vendedorId');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');

    // Construir where
    const where: Prisma.QuoteWhereInput = {
      companyId,
      ...(estado && { estado: estado as any }),
      ...(clienteId && { clientId: clienteId }),
      ...(vendedorId && { sellerId: parseInt(vendedorId) }),
      ...(fechaDesde && { fechaEmision: { gte: new Date(fechaDesde) } }),
      ...(fechaHasta && { fechaEmision: { lte: new Date(fechaHasta) } }),
    };

    // Si no es admin, solo ve sus cotizaciones
    const isAdmin = user!.role === 'ADMIN' || user!.role === 'OWNER';
    if (!isAdmin && !vendedorId) {
      where.sellerId = user!.id;
    }

    // Obtener cotizaciones con items
    const cotizaciones = await prisma.quote.findMany({
      where,
      include: {
        client: {
          select: { legalName: true, name: true, cuit: true }
        },
        seller: {
          select: { name: true }
        },
        items: {
          select: {
            codigo: true,
            descripcion: true,
            cantidad: true,
            unidad: true,
            precioUnitario: true,
            descuento: true,
            subtotal: true
          },
          orderBy: { orden: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Hoja 1: Cotizaciones
    const cotizacionesData = cotizaciones.map(cot => ({
      'Número': cot.numero,
      'Fecha Emisión': formatDate(cot.fechaEmision),
      'Fecha Validez': formatDate(cot.fechaValidez),
      'Estado': estadoLabels[cot.estado] || cot.estado,
      'Cliente': cot.client.legalName || cot.client.name,
      'CUIT Cliente': cot.client.cuit || '',
      'Vendedor': cot.seller?.name || '',
      'Título': cot.titulo || '',
      'Moneda': cot.moneda,
      'Subtotal': Number(cot.subtotal),
      'Descuento %': Number(cot.descuentoGlobal),
      'Descuento $': Number(cot.descuentoMonto),
      'IVA %': Number(cot.tasaIva),
      'IVA $': Number(cot.impuestos),
      'Total': Number(cot.total),
      'Items': cot.items.length,
      'Condiciones Pago': cot.condicionesPago || '',
      'Días Plazo': cot.diasPlazo || '',
      'Condiciones Entrega': cot.condicionesEntrega || '',
      'Tiempo Entrega': cot.tiempoEntrega || '',
      'Lugar Entrega': cot.lugarEntrega || '',
      'Notas': cot.notas || '',
      'Fecha Envío': formatDate(cot.fechaEnvio),
      'Fecha Cierre': formatDate(cot.fechaCierre),
      'Motivo Pérdida': cot.motivoPerdida || '',
      'Creada': formatDate(cot.createdAt)
    }));

    // Hoja 2: Items
    const itemsData: any[] = [];
    cotizaciones.forEach(cot => {
      cot.items.forEach((item, idx) => {
        itemsData.push({
          'Cotización': cot.numero,
          'Cliente': cot.client.legalName || cot.client.name,
          '# Item': idx + 1,
          'Código': item.codigo || '',
          'Descripción': item.descripcion,
          'Cantidad': Number(item.cantidad),
          'Unidad': item.unidad,
          'Precio Unitario': Number(item.precioUnitario),
          'Descuento %': Number(item.descuento),
          'Subtotal': Number(item.subtotal)
        });
      });
    });

    // Hoja 3: Resumen (KPIs)
    const totalCotizaciones = cotizaciones.length;
    const montoTotal = cotizaciones.reduce((sum, c) => sum + Number(c.total), 0);
    const promedio = totalCotizaciones > 0 ? montoTotal / totalCotizaciones : 0;

    const porEstado = cotizaciones.reduce((acc, c) => {
      acc[c.estado] = (acc[c.estado] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const enviadas = (porEstado['ENVIADA'] || 0) +
                     (porEstado['EN_NEGOCIACION'] || 0) +
                     (porEstado['ACEPTADA'] || 0) +
                     (porEstado['CONVERTIDA'] || 0) +
                     (porEstado['PERDIDA'] || 0);
    const aceptadas = (porEstado['ACEPTADA'] || 0) + (porEstado['CONVERTIDA'] || 0);

    const resumenData = [
      { 'Métrica': 'Total Cotizaciones', 'Valor': totalCotizaciones },
      { 'Métrica': 'Monto Total', 'Valor': montoTotal },
      { 'Métrica': 'Promedio por Cotización', 'Valor': promedio },
      { 'Métrica': '', 'Valor': '' },
      { 'Métrica': 'Por Estado:', 'Valor': '' },
      { 'Métrica': '  Borradores', 'Valor': porEstado['BORRADOR'] || 0 },
      { 'Métrica': '  Enviadas', 'Valor': porEstado['ENVIADA'] || 0 },
      { 'Métrica': '  En Negociación', 'Valor': porEstado['EN_NEGOCIACION'] || 0 },
      { 'Métrica': '  Aceptadas', 'Valor': porEstado['ACEPTADA'] || 0 },
      { 'Métrica': '  Convertidas', 'Valor': porEstado['CONVERTIDA'] || 0 },
      { 'Métrica': '  Perdidas', 'Valor': porEstado['PERDIDA'] || 0 },
      { 'Métrica': '  Vencidas', 'Valor': porEstado['VENCIDA'] || 0 },
      { 'Métrica': '', 'Valor': '' },
      { 'Métrica': 'Métricas de Conversión:', 'Valor': '' },
      { 'Métrica': '  Tasa Aceptación', 'Valor': enviadas > 0 ? `${((aceptadas / enviadas) * 100).toFixed(1)}%` : 'N/A' },
      { 'Métrica': '  Total Items', 'Valor': itemsData.length }
    ];

    // Crear workbook
    const wb = XLSX.utils.book_new();

    // Agregar hojas
    const wsCotizaciones = XLSX.utils.json_to_sheet(cotizacionesData);
    const wsItems = XLSX.utils.json_to_sheet(itemsData);
    const wsResumen = XLSX.utils.json_to_sheet(resumenData);

    // Ajustar anchos de columna
    wsCotizaciones['!cols'] = [
      { wch: 18 },  // Número
      { wch: 12 },  // Fecha Emisión
      { wch: 12 },  // Fecha Validez
      { wch: 15 },  // Estado
      { wch: 30 },  // Cliente
      { wch: 15 },  // CUIT
      { wch: 20 },  // Vendedor
      { wch: 30 },  // Título
      { wch: 8 },   // Moneda
      { wch: 12 },  // Subtotal
      { wch: 12 },  // Descuento %
      { wch: 12 },  // Descuento $
      { wch: 8 },   // IVA %
      { wch: 12 },  // IVA $
      { wch: 14 },  // Total
      { wch: 8 },   // Items
    ];

    wsItems['!cols'] = [
      { wch: 18 },  // Cotización
      { wch: 30 },  // Cliente
      { wch: 8 },   // # Item
      { wch: 15 },  // Código
      { wch: 50 },  // Descripción
      { wch: 10 },  // Cantidad
      { wch: 10 },  // Unidad
      { wch: 14 },  // Precio Unitario
      { wch: 12 },  // Descuento %
      { wch: 14 },  // Subtotal
    ];

    wsResumen['!cols'] = [
      { wch: 25 },  // Métrica
      { wch: 20 },  // Valor
    ];

    XLSX.utils.book_append_sheet(wb, wsCotizaciones, 'Cotizaciones');
    XLSX.utils.book_append_sheet(wb, wsItems, 'Items');
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

    // Generar buffer
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Nombre del archivo
    const fecha = new Date().toISOString().split('T')[0];
    const filename = `cotizaciones-ventas-${fecha}.xlsx`;

    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      }
    });
  } catch (error) {
    console.error('Error exporting cotizaciones:', error);
    return NextResponse.json(
      { error: 'Error al exportar las cotizaciones', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
