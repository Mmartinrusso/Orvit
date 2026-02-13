import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

// Schema de validación para filas del Excel
const InputImportRowSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(100, 'Nombre muy largo'),
  unitLabel: z.string().min(1, 'Unidad requerida').max(20, 'Unidad muy larga'),
  supplier: z.string().max(100, 'Proveedor muy largo').optional(),
  currentPrice: z.number().positive('Precio debe ser positivo'),
  effectiveFrom: z.coerce.date().optional(),
});

type InputImportRow = z.infer<typeof InputImportRowSchema>;

interface ImportResult {
  success: boolean;
  totalRows: number;
  validRows: number;
  errors: Array<{
    row: number;
    error: string;
    data?: any;
  }>;
  inputsCreated: number;
  inputsUpdated: number;
  historyRecords: number;
}

// POST /api/inputs/import - Importar insumos desde Excel/CSV
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
      inputsCreated: 0,
      inputsUpdated: 0,
      historyRecords: 0,
    };

    // Procesar cada fila
    const validatedRows: InputImportRow[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const rowNum = i + 1;
      const rawRow = rawData[i] as any;

      try {
        // Normalizar nombres de columnas (case insensitive)
        const normalizedRow: any = {};
        Object.keys(rawRow).forEach(key => {
          const normalizedKey = key.toLowerCase().trim();
          if (normalizedKey.includes('name') || normalizedKey.includes('nombre') || normalizedKey.includes('insumo')) {
            normalizedRow.name = rawRow[key];
          } else if (normalizedKey.includes('unit') || normalizedKey.includes('unidad') || normalizedKey.includes('medida')) {
            normalizedRow.unitLabel = rawRow[key];
          } else if (normalizedKey.includes('supplier') || normalizedKey.includes('proveedor')) {
            normalizedRow.supplier = rawRow[key];
          } else if (normalizedKey.includes('price') || normalizedKey.includes('precio') || normalizedKey.includes('costo')) {
            normalizedRow.currentPrice = rawRow[key];
          } else if (normalizedKey.includes('effective') || normalizedKey.includes('vigencia') || 
                     normalizedKey.includes('fecha') || normalizedKey.includes('desde')) {
            normalizedRow.effectiveFrom = rawRow[key];
          }
        });

        // Convertir precio a número si es string
        if (typeof normalizedRow.currentPrice === 'string') {
          normalizedRow.currentPrice = parseFloat(normalizedRow.currentPrice.replace(/,/g, '.'));
        }

        // Si no se especifica fecha efectiva, usar fecha actual
        if (!normalizedRow.effectiveFrom) {
          normalizedRow.effectiveFrom = new Date();
        }

        // Validar con schema
        const validatedRow = InputImportRowSchema.parse(normalizedRow);

        validatedRows.push(validatedRow);
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
          // Buscar insumo existente por nombre
          const existingInput = await tx.inputItem.findFirst({
            where: {
              companyId: parseInt(companyId),
              name: row.name,
            },
          });

          let input;
          let isNewInput = false;

          if (existingInput) {
            // Actualizar insumo existente
            input = await tx.inputItem.update({
              where: { id: existingInput.id },
              data: {
                unitLabel: row.unitLabel,
                supplier: row.supplier,
                currentPrice: row.currentPrice,
              },
            });
            result.inputsUpdated++;
          } else {
            // Crear nuevo insumo
            input = await tx.inputItem.create({
              data: {
                companyId: parseInt(companyId),
                name: row.name,
                unitLabel: row.unitLabel,
                supplier: row.supplier,
                currentPrice: row.currentPrice,
              },
            });
            isNewInput = true;
            result.inputsCreated++;
          }

          // Verificar si ya existe un precio para la misma fecha
          const effectiveDate = row.effectiveFrom || new Date();
          const existingPriceHistory = await tx.inputPriceHistory.findFirst({
            where: {
              inputId: input.id,
              effectiveFrom: effectiveDate,
            },
          });

          if (!existingPriceHistory) {
            // Crear registro de historial
            await tx.inputPriceHistory.create({
              data: {
                companyId: parseInt(companyId),
                inputId: input.id,
                effectiveFrom: effectiveDate,
                price: row.currentPrice,
              },
            });
            result.historyRecords++;
          }
        }
      });
    }

    return NextResponse.json({
      ...result,
      message: `Importación completada. ${result.inputsCreated} insumos nuevos, ${result.inputsUpdated} actualizados, ${result.historyRecords} registros de historial.`,
    });

  } catch (error) {
    console.error('Error importing inputs data:', error);
    return NextResponse.json(
      { 
        error: 'Error al procesar archivo',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}
