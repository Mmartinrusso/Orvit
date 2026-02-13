import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * GET /api/almacen/despachos/[id]/picklist
 *
 * Generate a printable picklist HTML for a dispatch
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!id || isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const despacho = await prisma.despacho.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            supplierItem: {
              select: {
                id: true,
                nombre: true,
                codigoProveedor: true,
                unidad: true,
              },
            },
            stockLocation: {
              select: {
                id: true,
                ubicacion: true,
                ubicacionFisica: true,
              },
            },
          },
        },
        warehouse: {
          select: { id: true, nombre: true, codigo: true },
        },
        materialRequest: {
          select: { id: true, numero: true, motivo: true },
        },
        workOrder: {
          select: { id: true, orderNumber: true },
        },
        productionOrder: {
          select: { id: true, orderNumber: true },
        },
        despachador: {
          select: { id: true, name: true },
        },
        destinatario: {
          select: { id: true, name: true },
        },
        company: {
          select: { id: true, name: true },
        },
      },
    });

    if (!despacho) {
      return NextResponse.json({ error: 'Despacho no encontrado' }, { status: 404 });
    }

    // Generate HTML picklist
    const html = generatePicklistHTML(despacho);

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error generating picklist:', error);
    return NextResponse.json(
      { error: 'Error al generar picklist' },
      { status: 500 }
    );
  }
}

function generatePicklistHTML(despacho: any): string {
  const items = despacho.items || [];
  const today = format(new Date(), "dd/MM/yyyy HH:mm", { locale: es });

  const tipoLabels: Record<string, string> = {
    ENTREGA_OT: 'Entrega OT Mantenimiento',
    ENTREGA_OP: 'Entrega OP Producción',
    ENTREGA_PERSONA: 'Entrega a Persona',
    CONSUMO_INTERNO: 'Consumo Interno',
  };

  const estadoLabels: Record<string, string> = {
    BORRADOR: 'Borrador',
    EN_PREPARACION: 'En Preparación',
    LISTO_DESPACHO: 'Listo para Despacho',
    DESPACHADO: 'Despachado',
    RECIBIDO: 'Recibido',
    CANCELADO: 'Cancelado',
  };

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Picklist - ${despacho.numero}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #333;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .header-left h1 {
      font-size: 24px;
      margin-bottom: 5px;
    }
    .header-left p {
      color: #666;
    }
    .header-right {
      text-align: right;
    }
    .header-right .numero {
      font-size: 20px;
      font-weight: bold;
      font-family: monospace;
    }
    .header-right .fecha {
      color: #666;
      margin-top: 5px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    .info-box {
      border: 1px solid #ddd;
      padding: 12px;
      border-radius: 4px;
    }
    .info-box h3 {
      font-size: 11px;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 5px;
    }
    .info-box p {
      font-size: 14px;
      font-weight: 500;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .status-borrador { background: #f3f4f6; color: #374151; }
    .status-en_preparacion { background: #fef3c7; color: #92400e; }
    .status-listo_despacho { background: #dbeafe; color: #1e40af; }
    .status-despachado { background: #d1fae5; color: #065f46; }
    .status-recibido { background: #d1fae5; color: #065f46; }
    .status-cancelado { background: #fee2e2; color: #991b1b; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 10px 8px;
      text-align: left;
    }
    th {
      background: #f8f9fa;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
    }
    .item-row:nth-child(even) {
      background: #f9fafb;
    }
    .item-code {
      font-family: monospace;
      font-size: 11px;
      color: #666;
    }
    .item-location {
      font-family: monospace;
      background: #e5e7eb;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
    }
    .qty-cell {
      text-align: center;
      font-weight: 600;
      font-size: 14px;
    }
    .check-cell {
      width: 40px;
      text-align: center;
    }
    .checkbox {
      width: 20px;
      height: 20px;
      border: 2px solid #333;
      display: inline-block;
    }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
    }
    .signature-box {
      text-align: center;
    }
    .signature-line {
      border-top: 1px solid #333;
      margin-top: 60px;
      padding-top: 5px;
    }
    .signature-label {
      font-size: 11px;
      color: #666;
    }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #ddd;
      font-size: 10px;
      color: #666;
      display: flex;
      justify-content: space-between;
    }
    .notes {
      margin-top: 20px;
      padding: 12px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
    }
    .notes h4 {
      font-size: 11px;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 5px;
    }
    @media print {
      body { padding: 10px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>PICKLIST DE DESPACHO</h1>
      <p>${despacho.company?.name || 'Empresa'}</p>
    </div>
    <div class="header-right">
      <div class="numero">${despacho.numero}</div>
      <div class="fecha">Generado: ${today}</div>
      <div style="margin-top: 8px;">
        <span class="status-badge status-${despacho.estado.toLowerCase()}">${estadoLabels[despacho.estado] || despacho.estado}</span>
      </div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h3>Tipo de Despacho</h3>
      <p>${tipoLabels[despacho.tipo] || despacho.tipo}</p>
    </div>
    <div class="info-box">
      <h3>Depósito Origen</h3>
      <p>${despacho.warehouse?.nombre || '-'}</p>
    </div>
    <div class="info-box">
      <h3>Solicitud</h3>
      <p>${despacho.materialRequest?.numero || 'Sin solicitud asociada'}</p>
      ${despacho.materialRequest?.motivo ? `<p style="font-size:11px;color:#666;margin-top:3px;">${despacho.materialRequest.motivo}</p>` : ''}
    </div>
    <div class="info-box">
      <h3>Destinatario</h3>
      <p>${despacho.destinatario?.name || despacho.despachador?.name || '-'}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="check-cell">✓</th>
        <th style="width: 40%;">Item</th>
        <th>Ubicación</th>
        <th>Lote</th>
        <th class="qty-cell">Cant.</th>
        <th>Unidad</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((item: any, index: number) => `
        <tr class="item-row">
          <td class="check-cell"><span class="checkbox"></span></td>
          <td>
            <strong>${item.supplierItem?.nombre || `Item ${index + 1}`}</strong>
            <br>
            <span class="item-code">${item.supplierItem?.codigoProveedor || ''}</span>
          </td>
          <td>
            ${item.stockLocation?.ubicacionFisica || item.stockLocation?.ubicacion
              ? `<span class="item-location">${item.stockLocation?.ubicacionFisica || item.stockLocation?.ubicacion}</span>`
              : '-'
            }
          </td>
          <td>${item.lote || '-'}</td>
          <td class="qty-cell">${Number(item.cantidadDespachada).toFixed(2)}</td>
          <td>${item.unidad || item.supplierItem?.unidad || '-'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  ${despacho.notas ? `
    <div class="notes">
      <h4>Notas</h4>
      <p>${despacho.notas}</p>
    </div>
  ` : ''}

  <div class="signatures">
    <div class="signature-box">
      <div class="signature-line">
        <span class="signature-label">Despachador: ${despacho.despachador?.name || '_______________'}</span>
      </div>
    </div>
    <div class="signature-box">
      <div class="signature-line">
        <span class="signature-label">Receptor: ${despacho.destinatario?.name || '_______________'}</span>
      </div>
    </div>
  </div>

  <div class="footer">
    <span>Despacho ${despacho.numero}</span>
    <span>Total items: ${items.length}</span>
    <span>Impreso: ${today}</span>
  </div>

  <script class="no-print">
    // Auto-print on load (optional)
    // window.onload = function() { window.print(); }
  </script>
</body>
</html>
  `.trim();
}
