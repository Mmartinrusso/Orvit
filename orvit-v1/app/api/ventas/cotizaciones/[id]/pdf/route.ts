import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

function formatCurrency(amount: number, currency: string = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(date));
}

// GET - Generar PDF de cotización (HTML imprimible)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const quoteId = parseInt(params.id);
    if (isNaN(quoteId)) {
      return NextResponse.json({ error: 'ID de cotización inválido' }, { status: 400 });
    }

    // Obtener cotización con todos los datos
    const cotizacion = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        client: {
          select: {
            id: true,
            legalName: true,
            name: true,
            cuit: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            country: true,
            zipCode: true,
            contactName: true,
            contactPosition: true
          }
        },
        seller: {
          select: { id: true, name: true, email: true, phone: true }
        },
        company: {
          select: {
            id: true,
            name: true,
            legalName: true,
            cuit: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            country: true,
            zipCode: true,
            website: true,
            logoUrl: true
          }
        },
        items: {
          select: {
            id: true,
            codigo: true,
            descripcion: true,
            cantidad: true,
            unidad: true,
            precioUnitario: true,
            descuento: true,
            subtotal: true,
            notas: true
          },
          orderBy: { orden: 'asc' }
        }
      }
    });

    if (!cotizacion) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    // Verificar permisos
    if (cotizacion.companyId !== companyId) {
      return NextResponse.json({ error: 'No tiene permisos para ver esta cotización' }, { status: 403 });
    }

    // Generar HTML
    const html = generateQuotePDF(cotizacion);

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      }
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Error al generar el PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function generateQuotePDF(cotizacion: any): string {
  const empresa = cotizacion.company;
  const cliente = cotizacion.client;
  const vendedor = cotizacion.seller;
  const items = cotizacion.items;

  const direccionEmpresa = [empresa.address, empresa.city, empresa.state, empresa.country]
    .filter(Boolean).join(', ');

  const direccionCliente = [cliente.address, cliente.city, cliente.state, cliente.country, cliente.zipCode]
    .filter(Boolean).join(', ');

  const estadoLabel: Record<string, string> = {
    BORRADOR: 'Borrador',
    ENVIADA: 'Enviada',
    EN_NEGOCIACION: 'En Negociación',
    ACEPTADA: 'Aceptada',
    CONVERTIDA: 'Convertida',
    PERDIDA: 'Perdida',
    VENCIDA: 'Vencida'
  };

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cotización ${cotizacion.numero}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #333;
      background: white;
      padding: 20mm;
    }

    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
      @page {
        size: A4;
        margin: 15mm;
      }
    }

    .print-button {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 24px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      z-index: 1000;
    }

    .print-button:hover {
      background: #1d4ed8;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e5e7eb;
    }

    .company-info {
      flex: 1;
    }

    .company-logo {
      max-width: 180px;
      max-height: 60px;
      margin-bottom: 10px;
    }

    .company-name {
      font-size: 18pt;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 4px;
    }

    .company-details {
      font-size: 9pt;
      color: #6b7280;
    }

    .quote-info {
      text-align: right;
    }

    .quote-number {
      font-size: 14pt;
      font-weight: 700;
      color: #2563eb;
      margin-bottom: 8px;
    }

    .quote-status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 9pt;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .quote-status.BORRADOR { background: #f3f4f6; color: #6b7280; }
    .quote-status.ENVIADA { background: #dbeafe; color: #1d4ed8; }
    .quote-status.EN_NEGOCIACION { background: #fef3c7; color: #d97706; }
    .quote-status.ACEPTADA { background: #d1fae5; color: #059669; }
    .quote-status.CONVERTIDA { background: #c7d2fe; color: #4f46e5; }
    .quote-status.PERDIDA { background: #fee2e2; color: #dc2626; }
    .quote-status.VENCIDA { background: #f3f4f6; color: #9ca3af; }

    .quote-dates {
      font-size: 9pt;
      color: #6b7280;
    }

    .parties {
      display: flex;
      gap: 40px;
      margin-bottom: 30px;
    }

    .party-box {
      flex: 1;
      background: #f9fafb;
      padding: 15px;
      border-radius: 8px;
    }

    .party-label {
      font-size: 9pt;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    .party-name {
      font-size: 12pt;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 4px;
    }

    .party-details {
      font-size: 9pt;
      color: #6b7280;
    }

    .title-section {
      margin-bottom: 25px;
    }

    .quote-title {
      font-size: 14pt;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 8px;
    }

    .quote-description {
      font-size: 10pt;
      color: #6b7280;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 25px;
    }

    .items-table th {
      background: #f3f4f6;
      padding: 10px 12px;
      text-align: left;
      font-size: 9pt;
      font-weight: 600;
      color: #4b5563;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      border-bottom: 2px solid #e5e7eb;
    }

    .items-table th.right,
    .items-table td.right {
      text-align: right;
    }

    .items-table th.center,
    .items-table td.center {
      text-align: center;
    }

    .items-table td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: top;
    }

    .items-table tr:last-child td {
      border-bottom: 2px solid #e5e7eb;
    }

    .item-code {
      font-size: 9pt;
      color: #6b7280;
      font-family: monospace;
    }

    .item-desc {
      font-weight: 500;
    }

    .item-notes {
      font-size: 9pt;
      color: #6b7280;
      margin-top: 4px;
    }

    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 30px;
    }

    .totals-box {
      width: 280px;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 10pt;
    }

    .total-row.subtotal {
      border-bottom: 1px solid #e5e7eb;
    }

    .total-row.grand-total {
      font-size: 14pt;
      font-weight: 700;
      color: #1f2937;
      border-top: 2px solid #1f2937;
      margin-top: 8px;
      padding-top: 12px;
    }

    .conditions-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
    }

    .condition-box {
      background: #f9fafb;
      padding: 15px;
      border-radius: 8px;
    }

    .condition-label {
      font-size: 9pt;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 6px;
    }

    .condition-value {
      font-size: 10pt;
      color: #1f2937;
    }

    .notes-section {
      margin-bottom: 30px;
    }

    .notes-box {
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      border-radius: 0 8px 8px 0;
    }

    .notes-label {
      font-size: 9pt;
      font-weight: 600;
      color: #92400e;
      margin-bottom: 6px;
    }

    .notes-content {
      font-size: 10pt;
      color: #78350f;
      white-space: pre-wrap;
    }

    .validity-banner {
      background: #dbeafe;
      border: 1px solid #93c5fd;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
      margin-bottom: 30px;
    }

    .validity-text {
      font-size: 10pt;
      color: #1e40af;
    }

    .validity-date {
      font-weight: 700;
    }

    .signature-section {
      margin-top: 50px;
      page-break-inside: avoid;
    }

    .signature-title {
      font-size: 10pt;
      font-weight: 600;
      color: #4b5563;
      margin-bottom: 15px;
    }

    .signature-boxes {
      display: flex;
      gap: 60px;
    }

    .signature-box {
      flex: 1;
      text-align: center;
    }

    .signature-line {
      border-bottom: 1px solid #9ca3af;
      height: 60px;
      margin-bottom: 8px;
    }

    .signature-label {
      font-size: 9pt;
      color: #6b7280;
    }

    .footer {
      margin-top: 40px;
      padding-top: 15px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 8pt;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <button class="print-button no-print" onclick="window.print()">
    Imprimir / Guardar PDF
  </button>

  <div class="header">
    <div class="company-info">
      ${empresa.logoUrl ? `<img src="${empresa.logoUrl}" alt="${empresa.name}" class="company-logo">` : ''}
      <div class="company-name">${empresa.legalName || empresa.name}</div>
      <div class="company-details">
        ${empresa.cuit ? `CUIT: ${empresa.cuit}<br>` : ''}
        ${direccionEmpresa ? `${direccionEmpresa}<br>` : ''}
        ${empresa.email ? `${empresa.email}` : ''}
        ${empresa.phone ? ` | ${empresa.phone}` : ''}
        ${empresa.website ? `<br>${empresa.website}` : ''}
      </div>
    </div>
    <div class="quote-info">
      <div class="quote-number">${cotizacion.numero}</div>
      <div class="quote-status ${cotizacion.estado}">${estadoLabel[cotizacion.estado] || cotizacion.estado}</div>
      <div class="quote-dates">
        <strong>Emisión:</strong> ${formatDate(cotizacion.fechaEmision)}<br>
        <strong>Válida hasta:</strong> ${formatDate(cotizacion.fechaValidez)}
      </div>
    </div>
  </div>

  <div class="parties">
    <div class="party-box">
      <div class="party-label">Cliente</div>
      <div class="party-name">${cliente.legalName || cliente.name}</div>
      <div class="party-details">
        ${cliente.cuit ? `CUIT: ${cliente.cuit}<br>` : ''}
        ${direccionCliente ? `${direccionCliente}<br>` : ''}
        ${cliente.email ? `${cliente.email}` : ''}
        ${cliente.phone ? ` | ${cliente.phone}` : ''}
        ${cliente.contactName ? `<br>Atención: ${cliente.contactName}${cliente.contactPosition ? ` (${cliente.contactPosition})` : ''}` : ''}
      </div>
    </div>
    ${vendedor ? `
    <div class="party-box">
      <div class="party-label">Vendedor</div>
      <div class="party-name">${vendedor.name}</div>
      <div class="party-details">
        ${vendedor.email ? `${vendedor.email}` : ''}
        ${vendedor.phone ? `<br>${vendedor.phone}` : ''}
      </div>
    </div>
    ` : ''}
  </div>

  ${cotizacion.titulo || cotizacion.descripcion ? `
  <div class="title-section">
    ${cotizacion.titulo ? `<div class="quote-title">${cotizacion.titulo}</div>` : ''}
    ${cotizacion.descripcion ? `<div class="quote-description">${cotizacion.descripcion}</div>` : ''}
  </div>
  ` : ''}

  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 80px;">Código</th>
        <th>Descripción</th>
        <th class="center" style="width: 70px;">Cant.</th>
        <th class="center" style="width: 50px;">Un.</th>
        <th class="right" style="width: 100px;">P. Unit.</th>
        <th class="center" style="width: 60px;">Dto.</th>
        <th class="right" style="width: 110px;">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((item: any) => `
      <tr>
        <td class="item-code">${item.codigo || '-'}</td>
        <td>
          <div class="item-desc">${item.descripcion}</div>
          ${item.notas ? `<div class="item-notes">${item.notas}</div>` : ''}
        </td>
        <td class="center">${Number(item.cantidad).toLocaleString('es-AR')}</td>
        <td class="center">${item.unidad}</td>
        <td class="right">${formatCurrency(Number(item.precioUnitario), cotizacion.moneda)}</td>
        <td class="center">${Number(item.descuento) > 0 ? `${Number(item.descuento)}%` : '-'}</td>
        <td class="right">${formatCurrency(Number(item.subtotal), cotizacion.moneda)}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals-section">
    <div class="totals-box">
      <div class="total-row subtotal">
        <span>Subtotal:</span>
        <span>${formatCurrency(Number(cotizacion.subtotal), cotizacion.moneda)}</span>
      </div>
      ${Number(cotizacion.descuentoGlobal) > 0 ? `
      <div class="total-row">
        <span>Descuento (${Number(cotizacion.descuentoGlobal)}%):</span>
        <span>-${formatCurrency(Number(cotizacion.descuentoMonto), cotizacion.moneda)}</span>
      </div>
      ` : ''}
      <div class="total-row">
        <span>IVA (${Number(cotizacion.tasaIva)}%):</span>
        <span>${formatCurrency(Number(cotizacion.impuestos), cotizacion.moneda)}</span>
      </div>
      <div class="total-row grand-total">
        <span>TOTAL:</span>
        <span>${formatCurrency(Number(cotizacion.total), cotizacion.moneda)}</span>
      </div>
    </div>
  </div>

  ${cotizacion.condicionesPago || cotizacion.condicionesEntrega || cotizacion.incluyeFlete || cotizacion.tiempoEntrega || cotizacion.lugarEntrega ? `
  <div class="conditions-section">
    ${cotizacion.condicionesPago ? `
    <div class="condition-box">
      <div class="condition-label">Condiciones de Pago</div>
      <div class="condition-value">
        ${cotizacion.condicionesPago}
        ${cotizacion.diasPlazo ? ` (${cotizacion.diasPlazo} días)` : ''}
      </div>
    </div>
    ` : ''}
    ${cotizacion.incluyeFlete || cotizacion.condicionesEntrega ? `
    <div class="condition-box">
      <div class="condition-label">Condiciones de Entrega</div>
      <div class="condition-value">
        ${cotizacion.incluyeFlete ? '<span style="display:inline-block;background:#dcfce7;color:#166534;font-weight:600;border-radius:4px;padding:1px 7px;font-size:9pt;margin-bottom:4px;">&#10003; FLETE INCLUIDO</span>' : ''}
        ${cotizacion.condicionesEntrega ? `${cotizacion.incluyeFlete ? '<br>' : ''}${cotizacion.condicionesEntrega}` : ''}
      </div>
    </div>
    ` : ''}
    ${cotizacion.tiempoEntrega ? `
    <div class="condition-box">
      <div class="condition-label">Tiempo de Entrega</div>
      <div class="condition-value">${cotizacion.tiempoEntrega}</div>
    </div>
    ` : ''}
    ${cotizacion.lugarEntrega ? `
    <div class="condition-box">
      <div class="condition-label">Lugar de Entrega</div>
      <div class="condition-value">${cotizacion.lugarEntrega}</div>
    </div>
    ` : ''}
  </div>
  ` : ''}

  ${cotizacion.notas ? `
  <div class="notes-section">
    <div class="notes-box">
      <div class="notes-label">Notas</div>
      <div class="notes-content">${cotizacion.notas}</div>
    </div>
  </div>
  ` : ''}

  <div class="validity-banner">
    <div class="validity-text">
      Esta cotización es válida hasta el <span class="validity-date">${formatDate(cotizacion.fechaValidez)}</span>.
      Los precios pueden variar después de esta fecha.
    </div>
  </div>

  <div class="signature-section">
    <div class="signature-title">Aceptación del Cliente</div>
    <div class="signature-boxes">
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Firma y Aclaración</div>
      </div>
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Fecha</div>
      </div>
    </div>
  </div>

  <div class="footer">
    <p>Documento generado el ${formatDate(new Date())} | ${empresa.legalName || empresa.name}</p>
  </div>
</body>
</html>
  `;
}
