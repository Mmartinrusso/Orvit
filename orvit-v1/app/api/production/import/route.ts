import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

// Schema de validación para filas del Excel
const ProductionImportRowSchema = z.object({
  productCode: z.string().min(1, 'Código de producto requerido'),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Formato de mes inválido (YYYY-MM)'),
  quantity: z.number().min(0, 'Cantidad debe ser positiva'),
  notes: z.string().optional(),
});

type ProductionImportRow = z.infer<typeof ProductionImportRowSchema>;

interface ImportResult {
  success: boolean;
  totalRows: number;
  validRows: number;
  errors: Array<{
    row: number;
    error: string;
    data?: any;
  }>;
  inserted: number;
  updated: number;
}

// POST /api/production/import - Importar producción desde Excel/CSV
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId requerido' },
        { status: 400 }
      );
    }

    // Verificar que la empresa existe
    const company = await prisma.company.findUnique({
      where: { id: parseInt(companyId) },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Archivo requerido' },
        { status: 400 }
      );
    }

    // Verificar tipo de archivo
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];

    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      return NextResponse.json(
        { error: 'Tipo de archivo no válido. Use Excel (.xlsx, .xls) o CSV' },
        { status: 400 }
      );
    }

    // Leer archivo
    const buffer = Buffer.from(await file.arrayBuffer());
    let workbook: XLSX.WorkBook;

    try {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    } catch (error) {
      return NextResponse.json(
        { error: 'Error al leer el archivo. Verifique que sea un archivo válido' },
        { status: 400 }
      );
    }

    // Usar la primera hoja
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      return NextResponse.json(
        { error: 'El archivo no contiene datos válidos' },
        { status: 400 }
      );
    }

    // Convertir a JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    if (rawData.length === 0) {
      return NextResponse.json(
        { error: 'El archivo está vacío' },
        { status: 400 }
      );
    }

    const result: ImportResult = {
      success: true,
      totalRows: rawData.length,
      validRows: 0,
      errors: [],
      inserted: 0,
      updated: 0,
    };

    // Obtener productos de la empresa para validar códigos
    const products = await prisma.costProduct.findMany({
      where: { companyId: parseInt(companyId) },
      select: { id: true, name: true, unitLabel: true },
    });

    const productsByCode = new Map();
    products.forEach(product => {
      // Crear un mapa con diferentes variantes del nombre como código
      const possibleCodes = [
        product.name.toLowerCase().trim(),
        product.name.toLowerCase().replace(/\s+/g, ''),
        product.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
      ];
      possibleCodes.forEach(code => {
        productsByCode.set(code, product);
      });
    });

    // Procesar cada fila
    const validatedRows: Array<ProductionImportRow & { productId: string }> = [];

    for (let i = 0; i < rawData.length; i++) {
      const rowNum = i + 1;
      const rawRow = rawData[i] as any;

      try {
        // Normalizar nombres de columnas (case insensitive)
        const normalizedRow: any = {};
        Object.keys(rawRow).forEach(key => {
          const normalizedKey = key.toLowerCase().trim();
          if (normalizedKey.includes('product') || normalizedKey.includes('codigo')) {
            normalizedRow.productCode = rawRow[key];
          } else if (normalizedKey.includes('month') || normalizedKey.includes('mes')) {
            normalizedRow.month = rawRow[key];
          } else if (normalizedKey.includes('quantity') || normalizedKey.includes('cantidad')) {
            normalizedRow.quantity = rawRow[key];
          } else if (normalizedKey.includes('note') || normalizedKey.includes('nota')) {
            normalizedRow.notes = rawRow[key];
          }
        });

        // Convertir quantity a número si es string
        if (typeof normalizedRow.quantity === 'string') {
          normalizedRow.quantity = parseFloat(normalizedRow.quantity.replace(/,/g, '.'));
        }

        // Validar con schema
        const validatedRow = ProductionImportRowSchema.parse(normalizedRow);

        // Buscar producto por código
        const productCode = validatedRow.productCode.toLowerCase().trim();
        const product = productsByCode.get(productCode) || 
                       productsByCode.get(productCode.replace(/\s+/g, '')) ||
                       productsByCode.get(productCode.replace(/[^a-z0-9]/g, ''));

        if (!product) {
          result.errors.push({
            row: rowNum,
            error: `Producto no encontrado: "${validatedRow.productCode}"`,
            data: validatedRow,
          });
          continue;
        }

        validatedRows.push({
          ...validatedRow,
          productId: product.id,
        });
        result.validRows++;

      } catch (error) {
        let errorMessage = 'Error de validación';
        if (error instanceof z.ZodError) {
          errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }

        result.errors.push({
          row: rowNum,
          error: errorMessage,
          data: rawRow,
        });
      }
    }

    // Si hay demasiados errores, no procesar
    if (result.errors.length > result.totalRows * 0.5) {
      return NextResponse.json({
        ...result,
        success: false,
        message: 'Demasiados errores en el archivo. Verifique el formato y datos.',
      });
    }

    // Insertar/actualizar datos válidos en transacción
    if (validatedRows.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const row of validatedRows) {
          const existing = await tx.monthlyProduction.findUnique({
            where: {
              productId_month: {
                productId: row.productId,
                month: row.month,
              },
            },
          });

          if (existing) {
            // Actualizar (sumar cantidad)
            await tx.monthlyProduction.update({
              where: { id: existing.id },
              data: {
                producedQuantity: {
                  increment: row.quantity,
                },
              },
            });
            result.updated++;
          } else {
            // Crear nuevo
            await tx.monthlyProduction.create({
              data: {
                companyId: parseInt(companyId),
                productId: row.productId,
                month: row.month,
                producedQuantity: row.quantity,
              },
            });
            result.inserted++;
          }
        }
      });
    }

    return NextResponse.json({
      ...result,
      message: `Importación completada. ${result.inserted} registros nuevos, ${result.updated} actualizados.`,
    });

  } catch (error) {
    console.error('Error importing production data:', error);
    return NextResponse.json(
      { 
        error: 'Error al procesar archivo',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}
