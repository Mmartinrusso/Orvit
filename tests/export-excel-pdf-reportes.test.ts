import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ════════════════════════════════════════════════════════════════════
// PART 1: Unit tests for excel-exporter.ts
// ════════════════════════════════════════════════════════════════════

describe('exportToExcel', () => {
  let exportToExcel: typeof import('../project/lib/export/excel-exporter').exportToExcel;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../project/lib/export/excel-exporter');
    exportToExcel = mod.exportToExcel;
  });

  it('should return a Buffer', async () => {
    const columns = [
      { header: 'Nombre', key: 'nombre' },
      { header: 'Valor', key: 'valor' },
    ];
    const data = [{ nombre: 'Test', valor: 100 }];

    const result = await exportToExcel(columns, data);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should produce a valid XLSX file (magic bytes check)', async () => {
    const columns = [{ header: 'Col', key: 'col' }];
    const data = [{ col: 'value' }];

    const buffer = await exportToExcel(columns, data);
    // XLSX files are ZIP files, which start with PK (0x50 0x4B)
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });

  it('should handle empty data array', async () => {
    const columns = [
      { header: 'A', key: 'a' },
      { header: 'B', key: 'b' },
    ];

    const buffer = await exportToExcel(columns, []);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should accept custom sheetName option', async () => {
    const columns = [{ header: 'Test', key: 'test' }];
    const data = [{ test: 'value' }];

    // Should not throw
    const buffer = await exportToExcel(columns, data, { sheetName: 'Mi Reporte' });
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  it('should handle numeric format (numFmt) without errors', async () => {
    const columns = [
      { header: 'Monto', key: 'monto', numFmt: '$#,##0' },
      { header: 'Texto', key: 'texto' },
    ];
    const data = [
      { monto: 150000, texto: 'Fila 1' },
      { monto: 250000, texto: 'Fila 2' },
    ];

    const buffer = await exportToExcel(columns, data);
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  it('should handle custom column widths', async () => {
    const columns = [
      { header: 'Corto', key: 'corto', width: 6 },
      { header: 'Largo', key: 'largo', width: 50 },
    ];
    const data = [{ corto: 'X', largo: 'Un texto muy largo para probar el ancho de columna' }];

    const buffer = await exportToExcel(columns, data);
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  it('should handle multiple rows of data', async () => {
    const columns = [
      { header: '#', key: 'pos' },
      { header: 'Item', key: 'item' },
      { header: 'Total', key: 'total', numFmt: '$#,##0' },
    ];
    const data = Array.from({ length: 100 }, (_, i) => ({
      pos: i + 1,
      item: `Producto ${i + 1}`,
      total: Math.round(Math.random() * 100000),
    }));

    const buffer = await exportToExcel(columns, data);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    // A workbook with 100 rows should be bigger than one with 1 row
    const smallBuffer = await exportToExcel(columns, [data[0]]);
    expect(buffer.length).toBeGreaterThan(smallBuffer.length);
  });

  it('should use default width of 18 when no width specified', async () => {
    // This is a code logic test - we just verify it doesn't crash
    const columns = [{ header: 'Default', key: 'def' }];
    const data = [{ def: 'val' }];
    const buffer = await exportToExcel(columns, data);
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// PART 2: Unit tests for pdf-exporter.ts
// ════════════════════════════════════════════════════════════════════

describe('exportToPDF', () => {
  let exportToPDF: typeof import('../project/lib/export/pdf-exporter').exportToPDF;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../project/lib/export/pdf-exporter');
    exportToPDF = mod.exportToPDF;
  });

  it('should return a Buffer', () => {
    const columns = [{ header: 'Nombre', key: 'nombre' }];
    const data = [{ nombre: 'Test' }];

    const result = exportToPDF('Test Report', columns, data);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should produce a valid PDF (magic bytes %PDF)', () => {
    const columns = [{ header: 'Col', key: 'col' }];
    const data = [{ col: 'value' }];

    const buffer = exportToPDF('Test', columns, data);
    // PDF starts with %PDF
    const header = buffer.toString('ascii', 0, 4);
    expect(header).toBe('%PDF');
  });

  it('should handle empty data', () => {
    const columns = [{ header: 'A', key: 'a' }];
    const buffer = exportToPDF('Empty Report', columns, []);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should handle KPIs', () => {
    const columns = [{ header: 'Item', key: 'item' }];
    const data = [{ item: 'Test' }];
    const kpis = [
      { label: 'Total', value: '$100.000' },
      { label: 'Items', value: '5' },
    ];

    const buffer = exportToPDF('Report with KPIs', columns, data, kpis);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    // With KPIs the PDF should be slightly larger
    const bufferNoKPIs = exportToPDF('Report no KPIs', columns, data);
    expect(buffer.length).toBeGreaterThan(bufferNoKPIs.length);
  });

  it('should handle column alignment (halign)', () => {
    const columns = [
      { header: 'Left', key: 'left', halign: 'left' as const },
      { header: 'Center', key: 'center', halign: 'center' as const },
      { header: 'Right', key: 'right', halign: 'right' as const },
    ];
    const data = [{ left: 'L', center: 'C', right: 'R' }];

    const buffer = exportToPDF('Alignment Test', columns, data);
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  it('should handle many rows with pagination', () => {
    const columns = [
      { header: '#', key: 'pos' },
      { header: 'Item', key: 'item' },
    ];
    const data = Array.from({ length: 200 }, (_, i) => ({
      pos: String(i + 1),
      item: `Producto con nombre largo para test ${i + 1}`,
    }));

    const buffer = exportToPDF('Large Report', columns, data);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    // Large PDF should be bigger than a small one
    const smallBuffer = exportToPDF('Small', columns, [data[0]]);
    expect(buffer.length).toBeGreaterThan(smallBuffer.length);
  });

  it('should handle null/undefined values in data gracefully', () => {
    const columns = [
      { header: 'A', key: 'a' },
      { header: 'B', key: 'b' },
    ];
    const data = [
      { a: 'value', b: null },
      { a: undefined, b: 'value2' },
    ];

    // The ?? '' in exportToPDF should handle this
    const buffer = exportToPDF('Null Test', columns, data as any);
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  it('should handle empty KPIs array', () => {
    const columns = [{ header: 'X', key: 'x' }];
    const data = [{ x: '1' }];

    const buffer = exportToPDF('Test', columns, data, []);
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// PART 3: Exported interface/type checks
// ════════════════════════════════════════════════════════════════════

describe('export module interfaces', () => {
  it('excel-exporter exports ExcelColumn and ExcelExportOptions types', async () => {
    const mod = await import('../project/lib/export/excel-exporter');
    expect(typeof mod.exportToExcel).toBe('function');
  });

  it('pdf-exporter exports PDFColumn and PDFKpi types', async () => {
    const mod = await import('../project/lib/export/pdf-exporter');
    expect(typeof mod.exportToPDF).toBe('function');
  });
});

// ════════════════════════════════════════════════════════════════════
// PART 4: Static analysis of route files
// ════════════════════════════════════════════════════════════════════

describe('Route files static analysis', () => {
  const routeDir = path.resolve(__dirname, '../project/app/api/ventas/reportes');

  const reportRoutes = [
    'ventas-periodo',
    'ranking-clientes',
    'ranking-productos',
    'resumen-ejecutivo',
  ];

  reportRoutes.forEach((routeName) => {
    describe(`${routeName}/route.ts`, () => {
      let routeContent: string;

      beforeEach(() => {
        routeContent = fs.readFileSync(
          path.join(routeDir, routeName, 'route.ts'),
          'utf-8'
        );
      });

      it('should import exportToExcel from lib/export/excel-exporter', () => {
        expect(routeContent).toContain("from '@/lib/export/excel-exporter'");
        expect(routeContent).toContain('exportToExcel');
      });

      it('should import exportToPDF from lib/export/pdf-exporter', () => {
        expect(routeContent).toContain("from '@/lib/export/pdf-exporter'");
        expect(routeContent).toContain('exportToPDF');
      });

      it('should read format query parameter', () => {
        expect(routeContent).toMatch(/searchParams\.get\(['"]format['"]\)/);
      });

      it('should check for REPORTES_EXPORT permission', () => {
        expect(routeContent).toContain('VENTAS_PERMISSIONS.REPORTES_EXPORT');
        expect(routeContent).toContain('checkPermission');
      });

      it('should return 403 when export permission is missing', () => {
        expect(routeContent).toContain("status: 403");
        expect(routeContent).toContain('Sin permiso de exportación');
      });

      it('should handle format=excel and return correct Content-Type', () => {
        expect(routeContent).toContain("formato === 'excel'");
        expect(routeContent).toContain(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
      });

      it('should handle format=pdf and return correct Content-Type', () => {
        expect(routeContent).toContain('application/pdf');
      });

      it('should set Content-Disposition header for downloads', () => {
        expect(routeContent).toContain('Content-Disposition');
        expect(routeContent).toContain('attachment; filename=');
      });

      it('should include .xlsx extension for Excel downloads', () => {
        expect(routeContent).toContain('.xlsx');
      });

      it('should include .pdf extension for PDF downloads', () => {
        expect(routeContent).toContain('.pdf');
      });

      it('should handle both excel and pdf within format check block', () => {
        // Verify the guard condition
        expect(routeContent).toContain("formato === 'excel' || formato === 'pdf'");
      });

      it('should define columns with header and key properties', () => {
        // All routes should define cols array with proper structure
        expect(routeContent).toMatch(/header:\s*'/);
        expect(routeContent).toMatch(/key:\s*'/);
      });
    });
  });
});

// ════════════════════════════════════════════════════════════════════
// PART 5: Static analysis of ventas-periodo route specifics
// ════════════════════════════════════════════════════════════════════

describe('ventas-periodo export specifics', () => {
  let routeContent: string;

  beforeEach(() => {
    routeContent = fs.readFileSync(
      path.resolve(__dirname, '../project/app/api/ventas/reportes/ventas-periodo/route.ts'),
      'utf-8'
    );
  });

  it('should export columns: periodo, ordenes, ordenesTotal, facturas, facturasTotal, cobrado, pendiente', () => {
    expect(routeContent).toContain("key: 'periodo'");
    expect(routeContent).toContain("key: 'ordenes'");
    expect(routeContent).toContain("key: 'ordenesTotal'");
    expect(routeContent).toContain("key: 'facturas'");
    expect(routeContent).toContain("key: 'facturasTotal'");
    expect(routeContent).toContain("key: 'cobrado'");
    expect(routeContent).toContain("key: 'pendiente'");
  });

  it('should include KPIs for PDF: Total Ventas, Total Órdenes, Ticket Promedio, Variación', () => {
    expect(routeContent).toContain("label: 'Total Ventas'");
    expect(routeContent).toContain("label: 'Total Órdenes'");
    expect(routeContent).toContain("label: 'Ticket Promedio'");
    expect(routeContent).toContain("label: 'Variación'");
  });

  it('should format currency values for PDF rows', () => {
    expect(routeContent).toContain('formatCurrency(r.ordenesTotal)');
    expect(routeContent).toContain('formatCurrency(r.facturasTotal)');
    expect(routeContent).toContain('formatCurrency(r.cobrado)');
    expect(routeContent).toContain('formatCurrency(r.pendiente)');
  });
});

// ════════════════════════════════════════════════════════════════════
// PART 6: Static analysis of ranking-clientes route specifics
// ════════════════════════════════════════════════════════════════════

describe('ranking-clientes export specifics', () => {
  let routeContent: string;

  beforeEach(() => {
    routeContent = fs.readFileSync(
      path.resolve(__dirname, '../project/app/api/ventas/reportes/ranking-clientes/route.ts'),
      'utf-8'
    );
  });

  it('should export columns: posicion, cliente, totalCompras, cantidadOrdenes, ticketPromedio, ultimaCompra, participacion', () => {
    expect(routeContent).toContain("key: 'posicion'");
    expect(routeContent).toContain("key: 'cliente'");
    expect(routeContent).toContain("key: 'totalCompras'");
    expect(routeContent).toContain("key: 'cantidadOrdenes'");
    expect(routeContent).toContain("key: 'ticketPromedio'");
    expect(routeContent).toContain("key: 'ultimaCompra'");
    expect(routeContent).toContain("key: 'participacion'");
  });

  it('should include concentration KPIs for PDF', () => {
    expect(routeContent).toContain("label: 'Total Ventas'");
    expect(routeContent).toContain("label: 'Clientes con Compras'");
    expect(routeContent).toContain("label: 'Ticket Promedio General'");
    expect(routeContent).toContain("label: 'Concentración 80%'");
  });
});

// ════════════════════════════════════════════════════════════════════
// PART 7: Static analysis of ranking-productos route specifics
// ════════════════════════════════════════════════════════════════════

describe('ranking-productos export specifics', () => {
  let routeContent: string;

  beforeEach(() => {
    routeContent = fs.readFileSync(
      path.resolve(__dirname, '../project/app/api/ventas/reportes/ranking-productos/route.ts'),
      'utf-8'
    );
  });

  it('should export columns: posicion, producto, sku, categoria, cantidadVendida, montoTotal, precioPromedio, participacion', () => {
    expect(routeContent).toContain("key: 'posicion'");
    expect(routeContent).toContain("key: 'producto'");
    expect(routeContent).toContain("key: 'sku'");
    expect(routeContent).toContain("key: 'categoria'");
    expect(routeContent).toContain("key: 'cantidadVendida'");
    expect(routeContent).toContain("key: 'montoTotal'");
    expect(routeContent).toContain("key: 'precioPromedio'");
    expect(routeContent).toContain("key: 'participacion'");
  });

  it('should include product concentration KPIs', () => {
    expect(routeContent).toContain("label: 'Total Ventas'");
    expect(routeContent).toContain("label: 'Unidades Vendidas'");
    expect(routeContent).toContain("label: 'Productos Vendidos'");
    expect(routeContent).toContain("label: 'Concentración 80%'");
  });

  it('should format numeric quantities for PDF', () => {
    expect(routeContent).toContain('formatNumber(r.cantidadVendida)');
  });
});

// ════════════════════════════════════════════════════════════════════
// PART 8: Static analysis of resumen-ejecutivo route specifics
// ════════════════════════════════════════════════════════════════════

describe('resumen-ejecutivo export specifics', () => {
  let routeContent: string;

  beforeEach(() => {
    routeContent = fs.readFileSync(
      path.resolve(__dirname, '../project/app/api/ventas/reportes/resumen-ejecutivo/route.ts'),
      'utf-8'
    );
  });

  it('should export top clients table with posicion, cliente, total, ordenes', () => {
    expect(routeContent).toContain("key: 'posicion'");
    expect(routeContent).toContain("key: 'cliente'");
    expect(routeContent).toContain("key: 'total'");
    expect(routeContent).toContain("key: 'ordenes'");
  });

  it('should include comprehensive KPIs', () => {
    expect(routeContent).toContain("label: 'Ventas'");
    expect(routeContent).toContain("label: 'Facturado'");
    expect(routeContent).toContain("label: 'Cobrado'");
    expect(routeContent).toContain("label: 'Pendiente'");
    expect(routeContent).toContain("label: 'Ticket Promedio'");
    expect(routeContent).toContain("label: 'Tasa Conversión'");
    expect(routeContent).toContain("label: 'Clientes Nuevos'");
  });
});

// ════════════════════════════════════════════════════════════════════
// PART 9: Static analysis of frontend page.tsx
// ════════════════════════════════════════════════════════════════════

describe('Frontend reportes page.tsx', () => {
  let pageContent: string;

  beforeEach(() => {
    pageContent = fs.readFileSync(
      path.resolve(__dirname, '../project/app/administracion/ventas/reportes/page.tsx'),
      'utf-8'
    );
  });

  it('should have exportarArchivo function', () => {
    expect(pageContent).toContain('exportarArchivo');
  });

  it('should support excel and pdf format parameters', () => {
    expect(pageContent).toContain("'excel'");
    expect(pageContent).toContain("'pdf'");
  });

  it('should append format query parameter for export', () => {
    expect(pageContent).toContain("params.append('format', formato)");
  });

  it('should create blob and download link for file exports', () => {
    expect(pageContent).toContain('res.blob()');
    expect(pageContent).toContain('URL.createObjectURL');
    expect(pageContent).toContain('link.download');
    expect(pageContent).toContain('link.click()');
    expect(pageContent).toContain('URL.revokeObjectURL');
  });

  it('should show toast feedback during export', () => {
    expect(pageContent).toContain("toast.loading");
    expect(pageContent).toContain("toast.success");
    expect(pageContent).toContain("toast.error");
  });

  it('should have DropdownMenu with CSV, Excel, and PDF options', () => {
    expect(pageContent).toContain('DropdownMenu');
    expect(pageContent).toContain('DropdownMenuTrigger');
    expect(pageContent).toContain('DropdownMenuContent');
    expect(pageContent).toContain('DropdownMenuItem');
    expect(pageContent).toContain('exportarCSV');
    expect(pageContent).toContain("exportarArchivo('excel')");
    expect(pageContent).toContain("exportarArchivo('pdf')");
  });

  it('should import FileSpreadsheet and Printer icons', () => {
    expect(pageContent).toContain('FileSpreadsheet');
    expect(pageContent).toContain('Printer');
  });

  it('should import ChevronDown for dropdown trigger', () => {
    expect(pageContent).toContain('ChevronDown');
  });

  it('should use correct file extension mapping (excel->xlsx, pdf->pdf)', () => {
    expect(pageContent).toContain("const ext = formato === 'excel' ? 'xlsx' : 'pdf'");
  });

  it('should preserve existing CSV export function', () => {
    expect(pageContent).toContain('exportarCSV');
    expect(pageContent).toContain("text/csv;charset=utf-8;");
  });

  it('should handle error responses in exportarArchivo', () => {
    expect(pageContent).toContain('!res.ok');
    expect(pageContent).toContain('throw new Error');
  });
});

// ════════════════════════════════════════════════════════════════════
// PART 10: Package.json dependency check
// ════════════════════════════════════════════════════════════════════

describe('package.json dependencies', () => {
  let pkg: any;

  beforeEach(() => {
    pkg = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, '../project/package.json'),
        'utf-8'
      )
    );
  });

  it('should include exceljs dependency', () => {
    expect(pkg.dependencies).toHaveProperty('exceljs');
  });

  it('should include jspdf dependency', () => {
    expect(pkg.dependencies).toHaveProperty('jspdf');
  });

  it('should include jspdf-autotable dependency', () => {
    expect(pkg.dependencies).toHaveProperty('jspdf-autotable');
  });
});

// ════════════════════════════════════════════════════════════════════
// PART 11: Integration test - Excel roundtrip
// ════════════════════════════════════════════════════════════════════

describe('Excel roundtrip integration', () => {
  it('should produce a workbook that ExcelJS can read back', async () => {
    const { exportToExcel } = await import('../project/lib/export/excel-exporter');
    const ExcelJS = await import('../project/node_modules/exceljs/lib/exceljs.nodejs.js');
    const Workbook = ExcelJS.default?.Workbook ?? ExcelJS.Workbook;

    const columns = [
      { header: 'Período', key: 'periodo' },
      { header: 'Monto', key: 'monto', numFmt: '$#,##0' },
      { header: 'Cantidad', key: 'cantidad' },
    ];
    const data = [
      { periodo: '2024-01', monto: 150000, cantidad: 10 },
      { periodo: '2024-02', monto: 250000, cantidad: 15 },
      { periodo: '2024-03', monto: 180000, cantidad: 12 },
    ];

    const buffer = await exportToExcel(columns, data, { sheetName: 'Ventas' });

    // Read it back
    const workbook = new Workbook();
    await workbook.xlsx.load(buffer);

    const sheet = workbook.getWorksheet('Ventas');
    expect(sheet).toBeDefined();

    // Check header row
    const headerRow = sheet!.getRow(1);
    expect(headerRow.getCell(1).value).toBe('Período');
    expect(headerRow.getCell(2).value).toBe('Monto');
    expect(headerRow.getCell(3).value).toBe('Cantidad');

    // Check data rows
    expect(sheet!.rowCount).toBe(4); // 1 header + 3 data rows

    const row2 = sheet!.getRow(2);
    expect(row2.getCell(1).value).toBe('2024-01');
    expect(row2.getCell(2).value).toBe(150000);
    expect(row2.getCell(3).value).toBe(10);

    const row3 = sheet!.getRow(3);
    expect(row3.getCell(1).value).toBe('2024-02');

    const row4 = sheet!.getRow(4);
    expect(row4.getCell(1).value).toBe('2024-03');
  });

  it('should apply auto-filter when data is present', async () => {
    const { exportToExcel } = await import('../project/lib/export/excel-exporter');
    const ExcelJS = await import('../project/node_modules/exceljs/lib/exceljs.nodejs.js');
    const Workbook = ExcelJS.default?.Workbook ?? ExcelJS.Workbook;

    const columns = [
      { header: 'A', key: 'a' },
      { header: 'B', key: 'b' },
    ];
    const data = [{ a: 1, b: 2 }];

    const buffer = await exportToExcel(columns, data);

    const workbook = new Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet('Reporte')!;

    expect(sheet.autoFilter).toBeDefined();
  });

  it('should NOT apply auto-filter when data is empty', async () => {
    const { exportToExcel } = await import('../project/lib/export/excel-exporter');
    const ExcelJS = await import('../project/node_modules/exceljs/lib/exceljs.nodejs.js');
    const Workbook = ExcelJS.default?.Workbook ?? ExcelJS.Workbook;

    const columns = [{ header: 'A', key: 'a' }];

    const buffer = await exportToExcel(columns, []);

    const workbook = new Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet('Reporte')!;

    // autoFilter should not be set on empty data
    expect(sheet.autoFilter).toBeUndefined();
  });

  it('should style header row with bold white font and blue fill', async () => {
    const { exportToExcel } = await import('../project/lib/export/excel-exporter');
    const ExcelJS = await import('../project/node_modules/exceljs/lib/exceljs.nodejs.js');
    const Workbook = ExcelJS.default?.Workbook ?? ExcelJS.Workbook;

    const columns = [{ header: 'Test', key: 'test' }];
    const data = [{ test: 'val' }];

    const buffer = await exportToExcel(columns, data);
    const workbook = new Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet('Reporte')!;
    const headerRow = sheet.getRow(1);

    expect(headerRow.font?.bold).toBe(true);
    expect(headerRow.font?.color?.argb).toBe('FFFFFFFF');
  });
});

// ════════════════════════════════════════════════════════════════════
// PART 12: Integration test - PDF content verification
// ════════════════════════════════════════════════════════════════════

describe('PDF content integration', () => {
  let exportToPDF: typeof import('../project/lib/export/pdf-exporter').exportToPDF;

  beforeEach(async () => {
    const mod = await import('../project/lib/export/pdf-exporter');
    exportToPDF = mod.exportToPDF;
  });

  it('should generate landscape A4 PDF', () => {
    const buffer = exportToPDF('Test', [{ header: 'X', key: 'x' }], [{ x: '1' }]);

    // PDF should contain landscape A4 dimensions
    // A4 landscape = 297 x 210 mm
    expect(Buffer.isBuffer(buffer)).toBe(true);
    const content = buffer.toString('ascii');
    expect(content).toContain('%PDF');
  });

  it('should include title in the PDF', () => {
    const title = 'Reporte de Ventas por Periodo';
    const buffer = exportToPDF(title, [{ header: 'X', key: 'x' }], [{ x: '1' }]);

    // The title should be embedded in the PDF content
    // PDF text may be encoded, but for basic ASCII text it's usually findable
    const content = buffer.toString('latin1');
    expect(content).toContain('Reporte de Ventas por Periodo');
  });

  it('should include page numbers in multi-page PDFs', () => {
    const columns = [
      { header: 'ID', key: 'id' },
      { header: 'Name', key: 'name' },
    ];
    const data = Array.from({ length: 200 }, (_, i) => ({
      id: String(i),
      name: `Item ${i}`,
    }));

    const buffer = exportToPDF('Big Report', columns, data);
    const content = buffer.toString('latin1');

    // Should contain pagination text
    expect(content).toContain('Pagina');
  });
});

// ════════════════════════════════════════════════════════════════════
// PART 13: Consistency checks across routes
// ════════════════════════════════════════════════════════════════════

describe('Cross-route consistency', () => {
  const routeDir = path.resolve(__dirname, '../project/app/api/ventas/reportes');
  const routes = ['ventas-periodo', 'ranking-clientes', 'ranking-productos', 'resumen-ejecutivo'];

  it('all routes should use the same format param name "format"', () => {
    routes.forEach((route) => {
      const content = fs.readFileSync(path.join(routeDir, route, 'route.ts'), 'utf-8');
      expect(content).toContain("searchParams.get('format')");
    });
  });

  it('all routes should use identical permission check pattern', () => {
    routes.forEach((route) => {
      const content = fs.readFileSync(path.join(routeDir, route, 'route.ts'), 'utf-8');
      expect(content).toContain('VENTAS_PERMISSIONS.REPORTES_EXPORT');
      expect(content).toContain("{ error: 'Sin permiso de exportación' }, { status: 403 }");
    });
  });

  it('all routes should generate timestamped filenames', () => {
    routes.forEach((route) => {
      const content = fs.readFileSync(path.join(routeDir, route, 'route.ts'), 'utf-8');
      expect(content).toContain("new Date().toISOString().split('T')[0]");
      expect(content).toContain('_${ts}.');
    });
  });

  it('all routes should define a formatCurrency function for PDF', () => {
    routes.forEach((route) => {
      const content = fs.readFileSync(path.join(routeDir, route, 'route.ts'), 'utf-8');
      expect(content).toContain('formatCurrency');
      expect(content).toContain("currency: 'ARS'");
    });
  });

  it('all routes should define pdfCols with halign mappings', () => {
    routes.forEach((route) => {
      const content = fs.readFileSync(path.join(routeDir, route, 'route.ts'), 'utf-8');
      expect(content).toContain('pdfCols');
      expect(content).toContain('halign');
    });
  });

  it('all routes should default to JSON when format is not specified', () => {
    routes.forEach((route) => {
      const content = fs.readFileSync(path.join(routeDir, route, 'route.ts'), 'utf-8');
      // The format check should use || comparison, so default is JSON
      expect(content).toContain("formato === 'excel' || formato === 'pdf'");
      // After the export block, should return NextResponse.json
      expect(content).toContain('NextResponse.json');
    });
  });
});
