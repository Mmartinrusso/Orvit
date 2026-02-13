import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

/**
 * GET - Exportar cuenta corriente a Excel
 *
 * Query params:
 * - clientId: ID del cliente (required)
 * - dateFrom: Fecha desde (YYYY-MM-DD)
 * - dateTo: Fecha hasta (YYYY-MM-DD)
 * - format: "excel" (default)
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CLIENTES_CREDIT_VIEW);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    if (!clientId) {
      return NextResponse.json({ error: 'clientId requerido' }, { status: 400 });
    }

    // Fetch data from main endpoint
    const apiUrl = new URL(`/api/ventas/cuenta-corriente`, request.url);
    apiUrl.searchParams.set('clientId', clientId);
    if (dateFrom) apiUrl.searchParams.set('dateFrom', dateFrom);
    if (dateTo) apiUrl.searchParams.set('dateTo', dateTo);

    const response = await fetch(apiUrl.toString(), {
      headers: request.headers,
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Error al obtener datos' }, { status: 500 });
    }

    const data = await response.json();

    // Generate Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Cuenta Corriente');

    // Title
    worksheet.mergeCells('A1:H1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'ESTADO DE CUENTA CORRIENTE';
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Client info
    worksheet.mergeCells('A3:B3');
    worksheet.getCell('A3').value = 'Cliente:';
    worksheet.getCell('A3').font = { bold: true };
    worksheet.mergeCells('C3:H3');
    worksheet.getCell('C3').value = data.client.legalName;

    worksheet.mergeCells('A4:B4');
    worksheet.getCell('A4').value = 'CUIT:';
    worksheet.getCell('A4').font = { bold: true };
    worksheet.mergeCells('C4:H4');
    worksheet.getCell('C4').value = data.client.taxId;

    worksheet.mergeCells('A5:B5');
    worksheet.getCell('A5').value = 'Período:';
    worksheet.getCell('A5').font = { bold: true };
    worksheet.mergeCells('C5:H5');
    worksheet.getCell('C5').value = `${dateFrom || 'Todos'} al ${dateTo || format(new Date(), 'yyyy-MM-dd')}`;

    // Summary section
    worksheet.addRow([]);
    worksheet.addRow(['RESUMEN', '', '', '', '', '', '', '']);
    worksheet.getCell('A7').font = { bold: true, size: 12 };

    worksheet.addRow([
      'Saldo Inicial',
      `$${data.summary.saldoInicial.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
      '',
      'Saldo Final',
      `$${data.summary.saldoFinal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
    ]);
    worksheet.addRow([
      'Total Debe',
      `$${data.summary.totalDebe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
      '',
      'Saldo Vencido',
      `$${data.summary.saldoVencido.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
    ]);
    worksheet.addRow([
      'Total Haber',
      `$${data.summary.totalHaber.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
      '',
      'Crédito Disponible',
      `$${data.summary.creditoDisponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
    ]);

    // Transactions header
    worksheet.addRow([]);
    worksheet.addRow([]);
    const headerRow = worksheet.addRow([
      'Fecha',
      'Tipo',
      'Número',
      'Concepto',
      'Debe',
      'Haber',
      'Saldo',
      'Estado',
    ]);

    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Transactions
    data.transactions.forEach((transaction: any) => {
      const row = worksheet.addRow([
        format(new Date(transaction.fecha), 'dd/MM/yyyy', { locale: es }),
        transaction.tipo,
        transaction.numero,
        transaction.concepto,
        transaction.debe > 0 ? transaction.debe : '',
        transaction.haber > 0 ? transaction.haber : '',
        transaction.saldo,
        transaction.estado,
      ]);

      // Color coding
      if (transaction.estado === 'VENCIDA') {
        row.getCell(8).font = { color: { argb: 'FFFF0000' }, bold: true };
      } else if (transaction.estado === 'PAGADA') {
        row.getCell(8).font = { color: { argb: 'FF00AA00' } };
      }

      // Format numbers
      row.getCell(5).numFmt = '#,##0.00';
      row.getCell(6).numFmt = '#,##0.00';
      row.getCell(7).numFmt = '#,##0.00';

      // Alignment
      row.getCell(5).alignment = { horizontal: 'right' };
      row.getCell(6).alignment = { horizontal: 'right' };
      row.getCell(7).alignment = { horizontal: 'right' };
    });

    // Column widths
    worksheet.columns = [
      { width: 12 },  // Fecha
      { width: 15 },  // Tipo
      { width: 15 },  // Número
      { width: 40 },  // Concepto
      { width: 15 },  // Debe
      { width: 15 },  // Haber
      { width: 15 },  // Saldo
      { width: 12 },  // Estado
    ];

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Return as download
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="cuenta-corriente-${data.client.legalName.replace(/[^a-zA-Z0-9]/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Error exporting cuenta corriente:', error);
    return NextResponse.json({ error: 'Error al exportar' }, { status: 500 });
  }
}
