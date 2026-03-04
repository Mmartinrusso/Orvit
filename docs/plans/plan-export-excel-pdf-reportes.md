# Plan: Exportación a Excel y PDF en Reportes de Ventas

## Resumen
Agregar botones "Exportar Excel" y "Exportar PDF" a los 4 reportes de ventas existentes. Se crean funciones reutilizables de exportación server-side usando ExcelJS (Excel) y jsPDF (PDF, ya instalado). Cada endpoint de reporte acepta `?format=excel|pdf` para retornar archivos descargables.

---

## Decisiones de Diseño

### Librería PDF: jsPDF (ya instalado) en lugar de pdfkit
- El proyecto ya usa `jspdf@2.5.2` + `jspdf-autotable@3.8.4` en server-side (ver `lib/pdf/account-statement-pdf.ts`, `lib/ventas/pdf/invoice-pdf-generator.ts`)
- **No se instalará pdfkit** ya que jsPDF ya está en el proyecto y tiene el patrón establecido
- Se instalará `exceljs` que falta en package.json (ya se importa en `export-service.ts` pero no está instalado)

### Patrón de exportación: Parámetro `?format=` en endpoints existentes
- Se modifica cada route.ts para detectar `?format=excel|pdf` (default: `json`)
- Si `format=excel`: se reutiliza la lógica de datos existente + se genera xlsx con `exportReportToExcel()`
- Si `format=pdf`: se reutiliza la lógica de datos existente + se genera pdf con `exportReportToPDF()`
- Se retornan con headers `Content-Type` y `Content-Disposition` apropiados

### Permiso de exportación
- Se verificará `VENTAS_PERMISSIONS.REPORTES_EXPORT` adicionalmente cuando `format !== 'json'`
- El permiso `ventas.reportes.export` ya existe en el sistema de auth

---

## Archivos a Crear/Modificar

### Paso 1: Instalar exceljs
```bash
cd project && npm install exceljs
```

### Paso 2: Crear `lib/export/excel-exporter.ts` (NUEVO)

Función genérica reutilizable siguiendo el patrón de `lib/ventas/export-service.ts`:

```typescript
export interface ExcelColumn {
  header: string;
  key: string;
  width: number;
  numFmt?: string; // e.g., '$#,##0.00'
}

export interface ExcelExportOptions {
  sheetName: string;
  title?: string;       // Título en fila 1 (merged cells)
  subtitle?: string;    // Subtítulo en fila 2 (período, etc.)
}

export async function exportToExcel(
  data: Record<string, any>[],
  columns: ExcelColumn[],
  filename: string,
  options: ExcelExportOptions
): Promise<Buffer>
```

**Implementación:**
- Crear workbook con metadata `Sistema ORVIT`
- Fila 1: Título con merged cells (si se provee)
- Fila 2: Subtítulo/período
- Fila 3+: Headers con estilo (bold, fondo azul `FF3B82F6`, texto blanco) — patrón exacto de `export-service.ts`
- Filas de datos con formato numérico donde aplique
- Fila final: Totales con fórmulas SUM para columnas numéricas
- Auto-width según definición de columnas
- Retornar `Buffer`

### Paso 3: Crear `lib/export/pdf-exporter.ts` (NUEVO)

Función genérica reutilizable siguiendo el patrón de `lib/pdf/account-statement-pdf.ts`:

```typescript
export interface PDFColumn {
  header: string;
  key: string;
  width?: number;       // Proporción relativa
  align?: 'left' | 'center' | 'right';
  format?: 'currency' | 'number' | 'percent';
}

export interface PDFExportOptions {
  title: string;
  subtitle?: string;    // e.g., "Período: 01/01/2026 - 31/01/2026"
  orientation?: 'portrait' | 'landscape';
  kpis?: { label: string; value: string }[]; // KPIs antes de la tabla
}

export function exportToPDF(
  data: Record<string, any>[],
  columns: PDFColumn[],
  options: PDFExportOptions
): Buffer
```

**Implementación:**
- Usar `jsPDF` + `jspdf-autotable` (patrón existente del proyecto)
- Header: Logo/título del reporte, subtítulo con período
- Sección KPIs (si se proveen): boxes con métricas clave
- Tabla principal con autoTable: theme `striped`, headStyles `fillColor: [59,130,246]`
- Footer con "Página X de Y" y "Generado por Sistema ORVIT - fecha"
- Formato de moneda: `$#,##0` para columnas con format `currency`
- Retornar `Buffer` via `doc.output('arraybuffer')`

### Paso 4: Modificar `app/api/ventas/reportes/ventas-periodo/route.ts`

**Cambios:**
1. Agregar imports de los exporters
2. Leer param `format` de searchParams
3. Si `format !== 'json'`: verificar permiso `REPORTES_EXPORT`
4. Después de calcular `datosAgrupados` y `totales` (línea ~207), agregar:

```typescript
const format = searchParams.get('format') || 'json';

if (format === 'excel') {
  // Verificar permiso export
  const { error: exportError } = await requirePermission(VENTAS_PERMISSIONS.REPORTES_EXPORT);
  if (exportError) return exportError;

  const buffer = await exportToExcel(datosAgrupados, [
    { header: 'Período', key: 'periodo', width: 18 },
    { header: 'Órdenes', key: 'ordenes', width: 12 },
    { header: 'Total Órdenes', key: 'ordenesTotal', width: 18, numFmt: '$#,##0.00' },
    { header: 'Facturas', key: 'facturas', width: 12 },
    { header: 'Total Facturas', key: 'facturasTotal', width: 18, numFmt: '$#,##0.00' },
    { header: 'Cobrado', key: 'cobrado', width: 18, numFmt: '$#,##0.00' },
    { header: 'Pendiente', key: 'pendiente', width: 18, numFmt: '$#,##0.00' },
  ], 'ventas-periodo', {
    sheetName: 'Ventas por Período',
    title: 'Reporte de Ventas por Período',
    subtitle: `Período: ${fechaDesde...} - ${fechaHasta...} | Agrupación: ${agrupacion}`,
  });

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="ventas-periodo_${fecha}.xlsx"`,
    },
  });
}

if (format === 'pdf') {
  // Similar con exportToPDF
}
```

### Paso 5: Modificar `app/api/ventas/reportes/ranking-clientes/route.ts`

**Columnas Excel/PDF:**
| Header | Key | Formato |
|--------|-----|---------|
| Posición | posicion | number |
| Cliente | cliente.nombre | text |
| CUIT | cliente.cuit | text |
| Total Compras | metricas.totalCompras | currency |
| Cant. Órdenes | metricas.cantidadOrdenes | number |
| Ticket Promedio | metricas.ticketPromedio | currency |
| Participación | participacion | percent |

**Datos:** Se aplana el ranking array: `ranking.map(r => ({ posicion, nombre: r.cliente.nombre, ... }))`

**KPIs para PDF:** Total Ventas, Clientes Activos, Ticket Promedio, Concentración 80%

### Paso 6: Modificar `app/api/ventas/reportes/ranking-productos/route.ts`

**Columnas Excel/PDF:**
| Header | Key | Formato |
|--------|-----|---------|
| Posición | posicion | number |
| Producto | producto.nombre | text |
| SKU | producto.sku | text |
| Cantidad Vendida | metricas.cantidadVendida | number |
| Monto Total | metricas.montoTotal | currency |
| Clientes Únicos | metricas.clientesUnicos | number |
| Participación | participacion | percent |

**KPIs para PDF:** Total Ventas, Unidades Vendidas, Productos Vendidos, Concentración 80%

**Nota:** Se respetan los filtros de permisos existentes (`filterRankingProductFields`)

### Paso 7: Modificar `app/api/ventas/reportes/resumen-ejecutivo/route.ts`

**Para Excel:** 3 hojas:
1. "KPIs" - Métricas principales (ventas, facturado, cobrado, pendiente, etc.)
2. "Top Clientes" - topClientes array
3. "Top Vendedores" - topVendedores array

**Para PDF:** Layout especial:
- Sección KPIs en grid 2x4
- Tabla Top Clientes
- Tabla Top Vendedores
- Comparativa período actual vs anterior

### Paso 8: Modificar `app/administracion/ventas/reportes/page.tsx` (Frontend)

**Cambios en la barra de acciones (líneas 429-438):**
- Reemplazar el botón "Exportar CSV" por un DropdownMenu con 3 opciones:
  - Exportar CSV (mantener funcionalidad actual client-side)
  - Exportar Excel (nuevo - fetch con `?format=excel`)
  - Exportar PDF (nuevo - fetch con `?format=pdf`)

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="sm">
      <Download className="w-4 h-4 mr-2" />
      Exportar
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={exportarCSV}>
      <FileText className="w-4 h-4 mr-2" />
      Exportar CSV
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => exportarArchivo('excel')}>
      <FileSpreadsheet className="w-4 h-4 mr-2" />
      Exportar Excel
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => exportarArchivo('pdf')}>
      <Printer className="w-4 h-4 mr-2" />
      Exportar PDF
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Nueva función `exportarArchivo`:**
```typescript
const exportarArchivo = async (formato: 'excel' | 'pdf') => {
  if (!reporteActivo) return;

  toast.loading('Generando archivo...', { id: 'export' });

  const params = new URLSearchParams();
  // ... mismos params que generarReporte ...
  params.append('format', formato);

  const res = await fetch(`/api/ventas/reportes/${reporteActivo}?${params}`);

  if (res.ok) {
    const blob = await res.blob();
    const ext = formato === 'excel' ? 'xlsx' : 'pdf';
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reporteActivo}_${format(new Date(), 'yyyy-MM-dd')}.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Archivo descargado', { id: 'export' });
  } else {
    toast.error('Error al exportar', { id: 'export' });
  }
};
```

**Iconos:** `FileSpreadsheet` y `Printer` ya están importados en el componente (líneas 45-46).

**Imports adicionales:** `DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger` de `@/components/ui/dropdown-menu`.

---

## Reportes que NO se modifican
- Los reportes `ventas-cliente`, `ventas-vendedor`, `cobranzas-pendientes`, `estado-cuenta` quedan fuera del alcance según la tarea (solo los 4 endpoints listados).

## Orden de Implementación
1. `npm install exceljs`
2. `lib/export/excel-exporter.ts` (nuevo)
3. `lib/export/pdf-exporter.ts` (nuevo)
4. `ventas-periodo/route.ts` (modificar)
5. `ranking-clientes/route.ts` (modificar)
6. `ranking-productos/route.ts` (modificar)
7. `resumen-ejecutivo/route.ts` (modificar)
8. `page.tsx` frontend (modificar)

## Notas Técnicas
- ExcelJS no está instalado (aunque se importa en `export-service.ts`) → necesita `npm install exceljs`
- jsPDF + jspdf-autotable ya están instalados → se reutilizan
- El patrón de exportación server-side ya existe en `app/api/ventas/cuenta-corriente/export/route.ts`
- Se usa el mismo patrón de headers de respuesta: `Content-Type` + `Content-Disposition`
- Se necesita `declare module 'jspdf'` para autoTable (patrón de `account-statement-pdf.ts`)
- Variable `format` conflicta con import de `date-fns/format` → se usará `formatParam` como nombre
