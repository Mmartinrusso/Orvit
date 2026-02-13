import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export interface ExportOptions {
  includeItems?: boolean;
  includeCharts?: boolean;
  formatCurrency?: boolean;
}

export async function exportOrdenesToExcel(
  ordenes: any[],
  options: ExportOptions = {}
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = 'Sistema ORVIT';
  workbook.created = new Date();

  // Hoja principal: Órdenes
  const sheet = workbook.addWorksheet('Órdenes de Venta');

  // Estilos del header
  sheet.columns = [
    { header: 'Número', key: 'numero', width: 20 },
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Cliente', key: 'cliente', width: 30 },
    { header: 'Vendedor', key: 'vendedor', width: 20 },
    { header: 'Estado', key: 'estado', width: 18 },
    { header: 'Moneda', key: 'moneda', width: 10 },
    { header: 'Subtotal', key: 'subtotal', width: 15 },
    { header: 'IVA', key: 'iva', width: 15 },
    { header: 'Total', key: 'total', width: 15 },
  ];

  // Header styling
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF3B82F6' },
  };
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  // Datos
  ordenes.forEach((orden) => {
    const row = sheet.addRow({
      numero: orden.numero,
      fecha: format(new Date(orden.fechaEmision), 'dd/MM/yyyy', { locale: es }),
      cliente: orden.client?.legalName || orden.client?.name || 'N/A',
      vendedor: orden.seller?.name || 'N/A',
      estado: orden.estado,
      moneda: orden.moneda,
      subtotal: Number(orden.subtotal),
      iva: Number(orden.impuestos),
      total: Number(orden.total),
    });

    // Formato moneda
    if (options.formatCurrency) {
      row.getCell('subtotal').numFmt = '$#,##0.00';
      row.getCell('iva').numFmt = '$#,##0.00';
      row.getCell('total').numFmt = '$#,##0.00';
    }

    // Color según estado
    const estadoColors: Record<string, string> = {
      BORRADOR: 'FFE5E7EB',
      CONFIRMADA: 'FFDBEAFE',
      EN_PREPARACION: 'FFFEF3C7',
      ENTREGADA: 'FFD1FAE5',
      FACTURADA: 'FFE0E7FF',
      COMPLETADA: 'FFCCFBF1',
      CANCELADA: 'FFFECACA',
    };

    const colorEstado = estadoColors[orden.estado];
    if (colorEstado) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: colorEstado },
        };
      });
    }
  });

  // Totales
  const totalRow = sheet.addRow({
    numero: '',
    fecha: '',
    cliente: '',
    vendedor: '',
    estado: 'TOTALES',
    moneda: '',
    subtotal: { formula: `SUM(G2:G${ordenes.length + 1})` },
    iva: { formula: `SUM(H2:H${ordenes.length + 1})` },
    total: { formula: `SUM(I2:I${ordenes.length + 1})` },
  });

  totalRow.font = { bold: true };
  totalRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE5E7EB' },
  };

  if (options.formatCurrency) {
    totalRow.getCell('subtotal').numFmt = '$#,##0.00';
    totalRow.getCell('iva').numFmt = '$#,##0.00';
    totalRow.getCell('total').numFmt = '$#,##0.00';
  }

  // Hoja de Items (si se solicita)
  if (options.includeItems) {
    const itemsSheet = workbook.addWorksheet('Items');

    itemsSheet.columns = [
      { header: 'Orden', key: 'orden', width: 20 },
      { header: 'Código', key: 'codigo', width: 15 },
      { header: 'Descripción', key: 'descripcion', width: 40 },
      { header: 'Cantidad', key: 'cantidad', width: 12 },
      { header: 'Unidad', key: 'unidad', width: 10 },
      { header: 'Precio Unit.', key: 'precio', width: 15 },
      { header: 'Desc. %', key: 'descuento', width: 10 },
      { header: 'Subtotal', key: 'subtotal', width: 15 },
    ];

    // Header styling
    itemsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    itemsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3B82F6' },
    };

    // Items
    ordenes.forEach((orden) => {
      if (orden.items) {
        orden.items.forEach((item: any) => {
          const subtotal =
            Number(item.cantidad) *
            Number(item.precioUnitario) *
            (1 - Number(item.descuento) / 100);

          itemsSheet.addRow({
            orden: orden.numero,
            codigo: item.codigo || '',
            descripcion: item.descripcion,
            cantidad: Number(item.cantidad),
            unidad: item.unidad,
            precio: Number(item.precioUnitario),
            descuento: Number(item.descuento),
            subtotal,
          });
        });
      }
    });
  }

  // Generar buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function exportOrdenesCSV(ordenes: any[]): Promise<string> {
  const headers = [
    'Número',
    'Fecha',
    'Cliente',
    'Vendedor',
    'Estado',
    'Moneda',
    'Subtotal',
    'IVA',
    'Total',
  ];

  const rows = ordenes.map((orden) => [
    orden.numero,
    format(new Date(orden.fechaEmision), 'dd/MM/yyyy', { locale: es }),
    orden.client?.legalName || orden.client?.name || 'N/A',
    orden.seller?.name || 'N/A',
    orden.estado,
    orden.moneda,
    Number(orden.subtotal).toFixed(2),
    Number(orden.impuestos).toFixed(2),
    Number(orden.total).toFixed(2),
  ]);

  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  return csv;
}
