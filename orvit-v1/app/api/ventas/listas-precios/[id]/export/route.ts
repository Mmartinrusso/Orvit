import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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

function formatCurrency(value: number, moneda: string = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 2,
  }).format(value);
}

// GET - Exportar lista de precios a Excel
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.LISTAS_PRECIOS_VIEW);
    if (error) return error;

    const listId = parseInt(params.id);
    if (isNaN(listId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    try {
      // Obtener lista con items y productos
      const lista = await (prisma as any).salesPriceList.findFirst({
        where: { id: listId, companyId: user!.companyId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  costPrice: true,
                  salePrice: true,
                  unit: true,
                  category: { select: { id: true, name: true } }
                }
              }
            },
            orderBy: { product: { name: 'asc' } }
          }
        }
      });

      if (!lista) {
        return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 });
      }

      // Hoja 1: Información de la Lista
      const infoData = [
        { 'Campo': 'ID', 'Valor': lista.id },
        { 'Campo': 'Nombre', 'Valor': lista.nombre },
        { 'Campo': 'Descripción', 'Valor': lista.descripcion || 'N/A' },
        { 'Campo': 'Moneda', 'Valor': lista.moneda },
        { 'Campo': 'Porcentaje Base', 'Valor': lista.porcentajeBase ? `${lista.porcentajeBase}%` : 'N/A' },
        { 'Campo': 'Es Default', 'Valor': lista.esDefault ? 'Sí' : 'No' },
        { 'Campo': 'Activa', 'Valor': lista.isActive ? 'Sí' : 'No' },
        { 'Campo': 'Válida Desde', 'Valor': formatDate(lista.validFrom) },
        { 'Campo': 'Válida Hasta', 'Valor': formatDate(lista.validUntil) },
        { 'Campo': 'Total Productos', 'Valor': lista.items.length },
        { 'Campo': 'Fecha Creación', 'Valor': formatDate(lista.createdAt) },
        { 'Campo': 'Última Actualización', 'Valor': formatDate(lista.updatedAt) },
      ];

      // Hoja 2: Items (Productos y Precios)
      const itemsData = lista.items.map((item: any, idx: number) => {
        const producto = item.product;
        const precioLista = Number(item.precioUnitario || 0);
        const costoProducto = Number(producto.costPrice || 0);
        const precioVentaBase = Number(producto.salePrice || 0);
        const margen = costoProducto > 0 ? ((precioLista - costoProducto) / precioLista * 100) : 0;

        return {
          '#': idx + 1,
          'Código': producto.code || '',
          'Producto': producto.name,
          'Categoría': producto.category?.name || 'Sin categoría',
          'Unidad': producto.unit || '',
          'Costo': costoProducto,
          'Precio Base': precioVentaBase,
          'Precio Lista': precioLista,
          'Porcentaje': item.porcentaje ? `${Number(item.porcentaje)}%` : '',
          'Margen %': margen.toFixed(2),
          'Diferencia vs Base': precioLista - precioVentaBase,
        };
      });

      // Hoja 3: Resumen y Estadísticas
      const totalItems = lista.items.length;
      const precios = lista.items.map((i: any) => Number(i.precioUnitario || 0)).filter((p: number) => p > 0);
      const precioMin = precios.length > 0 ? Math.min(...precios) : 0;
      const precioMax = precios.length > 0 ? Math.max(...precios) : 0;
      const precioPromedio = precios.length > 0 ? precios.reduce((a: number, b: number) => a + b, 0) / precios.length : 0;

      // Calcular márgenes
      const margenes = lista.items
        .filter((i: any) => i.product.costPrice && i.precioUnitario)
        .map((i: any) => {
          const costo = Number(i.product.costPrice);
          const precio = Number(i.precioUnitario);
          return ((precio - costo) / precio * 100);
        });

      const margenPromedio = margenes.length > 0 ? margenes.reduce((a: number, b: number) => a + b, 0) / margenes.length : 0;
      const margenMin = margenes.length > 0 ? Math.min(...margenes) : 0;
      const margenMax = margenes.length > 0 ? Math.max(...margenes) : 0;

      // Contar por categoría
      const porCategoria = lista.items.reduce((acc: any, item: any) => {
        const cat = item.product.category?.name || 'Sin categoría';
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      }, {});

      const resumenData = [
        { 'Métrica': 'Información General', 'Valor': '' },
        { 'Métrica': '  Total Productos', 'Valor': totalItems },
        { 'Métrica': '  Lista Activa', 'Valor': lista.isActive ? 'Sí' : 'No' },
        { 'Métrica': '  Es Default', 'Valor': lista.esDefault ? 'Sí' : 'No' },
        { 'Métrica': '', 'Valor': '' },
        { 'Métrica': 'Análisis de Precios', 'Valor': '' },
        { 'Métrica': '  Precio Mínimo', 'Valor': formatCurrency(precioMin, lista.moneda) },
        { 'Métrica': '  Precio Máximo', 'Valor': formatCurrency(precioMax, lista.moneda) },
        { 'Métrica': '  Precio Promedio', 'Valor': formatCurrency(precioPromedio, lista.moneda) },
        { 'Métrica': '', 'Valor': '' },
        { 'Métrica': 'Análisis de Márgenes', 'Valor': '' },
        { 'Métrica': '  Margen Promedio', 'Valor': `${margenPromedio.toFixed(2)}%` },
        { 'Métrica': '  Margen Mínimo', 'Valor': `${margenMin.toFixed(2)}%` },
        { 'Métrica': '  Margen Máximo', 'Valor': `${margenMax.toFixed(2)}%` },
        { 'Métrica': '  Productos con Margen', 'Valor': margenes.length },
        { 'Métrica': '', 'Valor': '' },
        { 'Métrica': 'Distribución por Categoría', 'Valor': '' },
        ...Object.entries(porCategoria).map(([cat, count]) => ({
          'Métrica': `  ${cat}`,
          'Valor': count
        })),
      ];

      // Crear workbook
      const wb = XLSX.utils.book_new();

      // Agregar hojas
      const wsInfo = XLSX.utils.json_to_sheet(infoData);
      const wsItems = XLSX.utils.json_to_sheet(itemsData);
      const wsResumen = XLSX.utils.json_to_sheet(resumenData);

      // Ajustar anchos de columna
      wsInfo['!cols'] = [
        { wch: 25 },  // Campo
        { wch: 40 },  // Valor
      ];

      wsItems['!cols'] = [
        { wch: 5 },   // #
        { wch: 15 },  // Código
        { wch: 40 },  // Producto
        { wch: 20 },  // Categoría
        { wch: 10 },  // Unidad
        { wch: 12 },  // Costo
        { wch: 12 },  // Precio Base
        { wch: 12 },  // Precio Lista
        { wch: 12 },  // Porcentaje
        { wch: 10 },  // Margen %
        { wch: 15 },  // Diferencia vs Base
      ];

      wsResumen['!cols'] = [
        { wch: 30 },  // Métrica
        { wch: 25 },  // Valor
      ];

      XLSX.utils.book_append_sheet(wb, wsInfo, 'Información');
      XLSX.utils.book_append_sheet(wb, wsItems, 'Productos');
      XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

      // Generar buffer
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      // Nombre del archivo
      const fecha = new Date().toISOString().split('T')[0];
      const nombreLista = lista.nombre.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const filename = `lista-precios-${nombreLista}-${fecha}.xlsx`;

      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        }
      });
    } catch (error: any) {
      // Fallback con raw SQL si Prisma no reconoce el modelo
      if (error.message?.includes('Unknown model')) {
        const listas = await prisma.$queryRaw`
          SELECT * FROM "sales_price_lists" WHERE id = ${listId} AND "companyId" = ${user!.companyId}
        ` as any[];

        if (listas.length === 0) {
          return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 });
        }

        const lista = listas[0];

        const items = await prisma.$queryRaw`
          SELECT
            spli.*,
            p.code as "productCode",
            p.name as "productName",
            p."costPrice" as "productCostPrice",
            p."salePrice" as "productSalePrice",
            p.unit as "productUnit",
            c.name as "categoryName"
          FROM "sales_price_list_items" spli
          LEFT JOIN "Product" p ON p.id = spli."productId"
          LEFT JOIN "Category" c ON c.id = p."categoryId"
          WHERE spli."priceListId" = ${listId}
          ORDER BY p.name ASC
        ` as any[];

        // Generar las mismas hojas pero con datos de raw SQL
        const infoData = [
          { 'Campo': 'ID', 'Valor': lista.id },
          { 'Campo': 'Nombre', 'Valor': lista.nombre },
          { 'Campo': 'Descripción', 'Valor': lista.descripcion || 'N/A' },
          { 'Campo': 'Moneda', 'Valor': lista.moneda },
          { 'Campo': 'Porcentaje Base', 'Valor': lista.porcentajeBase ? `${lista.porcentajeBase}%` : 'N/A' },
          { 'Campo': 'Es Default', 'Valor': lista.esDefault ? 'Sí' : 'No' },
          { 'Campo': 'Activa', 'Valor': lista.isActive ? 'Sí' : 'No' },
          { 'Campo': 'Total Productos', 'Valor': items.length },
        ];

        const itemsData = items.map((item: any, idx: number) => {
          const precioLista = Number(item.precioUnitario || 0);
          const costoProducto = Number(item.productCostPrice || 0);
          const margen = costoProducto > 0 ? ((precioLista - costoProducto) / precioLista * 100) : 0;

          return {
            '#': idx + 1,
            'Código': item.productCode || '',
            'Producto': item.productName,
            'Categoría': item.categoryName || 'Sin categoría',
            'Unidad': item.productUnit || '',
            'Costo': costoProducto,
            'Precio Lista': precioLista,
            'Margen %': margen.toFixed(2),
          };
        });

        const wb = XLSX.utils.book_new();
        const wsInfo = XLSX.utils.json_to_sheet(infoData);
        const wsItems = XLSX.utils.json_to_sheet(itemsData);

        wsInfo['!cols'] = [{ wch: 25 }, { wch: 40 }];
        wsItems['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 40 }, { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 }];

        XLSX.utils.book_append_sheet(wb, wsInfo, 'Información');
        XLSX.utils.book_append_sheet(wb, wsItems, 'Productos');

        const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const fecha = new Date().toISOString().split('T')[0];
        const nombreLista = lista.nombre.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        const filename = `lista-precios-${nombreLista}-${fecha}.xlsx`;

        return new NextResponse(excelBuffer, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
          }
        });
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error exporting price list:', error);
    return NextResponse.json(
      { error: 'Error al exportar lista de precios', details: error.message },
      { status: 500 }
    );
  }
}
