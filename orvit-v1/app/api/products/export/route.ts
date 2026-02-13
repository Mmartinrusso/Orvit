import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

// GET /api/products/export - Exportar productos a Excel
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'xlsx';
    const onlyActive = searchParams.get('onlyActive') !== 'false';
    const categoryId = searchParams.get('categoryId');

    // Construir filtro
    const where: any = {
      companyId: auth.companyId,
    };

    if (onlyActive) {
      where.isActive = true;
    }

    if (categoryId) {
      where.categoryId = parseInt(categoryId);
    }

    // Obtener productos
    const products = await prisma.product.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true }
        },
        recipe: {
          select: { id: true, name: true }
        },
        purchaseInput: {
          select: { id: true, name: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Preparar datos para Excel
    const data = products.map((product) => {
      // Calcular margen si hay precios
      let margin = null;
      if (product.costPrice && product.costPrice > 0 && product.salePrice && product.salePrice > 0) {
        margin = ((product.salePrice - product.costPrice) / product.costPrice) * 100;
      }

      return {
        'Codigo': product.code,
        'Nombre': product.name,
        'Descripcion': product.description || '',
        'Categoria': product.category?.name || '',
        'Unidad': product.unit,
        'Estado': product.isActive ? 'Activo' : 'Inactivo',

        // Costos
        'Precio Costo': product.costPrice,
        'Moneda Costo': product.costCurrency,
        'Tipo Costo': product.costType,
        'Receta': product.recipe?.name || '',
        'Insumo Compra': product.purchaseInput?.name || '',

        // Precios de venta
        'Precio Venta': product.salePrice,
        'Moneda Venta': product.saleCurrency,
        'Margen %': margin ? margin.toFixed(2) : '',
        'Margen Min %': product.marginMin || '',
        'Margen Max %': product.marginMax || '',

        // Stock
        'Stock Actual': product.currentStock,
        'Stock Minimo': product.minStock,
        'Ubicacion': product.location || '',

        // Medidas
        'Peso': product.weight || '',
        'Volumen': product.volume || '',
        'Bloques/m2': product.blocksPerM2 || '',

        // Codigos
        'Codigo Barras': product.barcode || '',
        'SKU': product.sku || '',

        // Trazabilidad
        'Trazabilidad Lotes': product.trackBatches ? 'Si' : 'No',
        'Trazabilidad Vencimiento': product.trackExpiration ? 'Si' : 'No',

        // Tags
        'Etiquetas': Array.isArray(product.tags) ? (product.tags as string[]).join(', ') : '',

        // Fechas
        'Creado': product.createdAt?.toISOString().split('T')[0] || '',
        'Actualizado': product.updatedAt?.toISOString().split('T')[0] || '',
      };
    });

    if (format === 'csv') {
      // Exportar a CSV
      const ws = XLSX.utils.json_to_sheet(data);
      const csv = XLSX.utils.sheet_to_csv(ws);

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="productos_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Exportar a Excel
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Ajustar ancho de columnas
    const colWidths = [
      { wch: 15 }, // Codigo
      { wch: 35 }, // Nombre
      { wch: 40 }, // Descripcion
      { wch: 20 }, // Categoria
      { wch: 10 }, // Unidad
      { wch: 10 }, // Estado
      { wch: 12 }, // Precio Costo
      { wch: 12 }, // Moneda Costo
      { wch: 12 }, // Tipo Costo
      { wch: 20 }, // Receta
      { wch: 20 }, // Insumo Compra
      { wch: 12 }, // Precio Venta
      { wch: 12 }, // Moneda Venta
      { wch: 10 }, // Margen %
      { wch: 10 }, // Margen Min
      { wch: 10 }, // Margen Max
      { wch: 12 }, // Stock Actual
      { wch: 12 }, // Stock Minimo
      { wch: 15 }, // Ubicacion
      { wch: 8 },  // Peso
      { wch: 8 },  // Volumen
      { wch: 10 }, // Bloques/m2
      { wch: 15 }, // Codigo Barras
      { wch: 15 }, // SKU
      { wch: 15 }, // Trazabilidad Lotes
      { wch: 18 }, // Trazabilidad Vencimiento
      { wch: 25 }, // Etiquetas
      { wch: 12 }, // Creado
      { wch: 12 }, // Actualizado
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Productos');

    // Generar buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="productos_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/products/export:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
