import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

// Schema de validación para filas del Excel
const EmployeeImportRowSchema = z.object({
  documentOrCode: z.string().min(1, 'Documento o código requerido'),
  name: z.string().min(2, 'Nombre debe tener al menos 2 caracteres'),
  role: z.string().min(2, 'Rol debe tener al menos 2 caracteres'),
  grossSalary: z.number().min(0, 'Salario bruto debe ser positivo'),
  payrollTaxes: z.number().min(0, 'Cargas patronales deben ser positivas'),
  effectiveFrom: z.coerce.date(),
});

type EmployeeImportRow = z.infer<typeof EmployeeImportRowSchema>;

interface ImportResult {
  success: boolean;
  totalRows: number;
  validRows: number;
  errors: Array<{
    row: number;
    error: string;
    data?: any;
  }>;
  employeesCreated: number;
  employeesUpdated: number;
  historyRecords: number;
}

// POST /api/employees/import - Importar empleados desde Excel/CSV
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
      employeesCreated: 0,
      employeesUpdated: 0,
      historyRecords: 0,
    };

    // Procesar cada fila
    const validatedRows: EmployeeImportRow[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const rowNum = i + 1;
      const rawRow = rawData[i] as any;

      try {
        // Normalizar nombres de columnas (case insensitive)
        const normalizedRow: any = {};
        Object.keys(rawRow).forEach(key => {
          const normalizedKey = key.toLowerCase().trim();
          if (normalizedKey.includes('document') || normalizedKey.includes('codigo') || 
              normalizedKey.includes('dni') || normalizedKey.includes('cuil')) {
            normalizedRow.documentOrCode = rawRow[key];
          } else if (normalizedKey.includes('name') || normalizedKey.includes('nombre')) {
            normalizedRow.name = rawRow[key];
          } else if (normalizedKey.includes('role') || normalizedKey.includes('cargo') || normalizedKey.includes('puesto')) {
            normalizedRow.role = rawRow[key];
          } else if (normalizedKey.includes('gross') || normalizedKey.includes('salario') || normalizedKey.includes('bruto')) {
            normalizedRow.grossSalary = rawRow[key];
          } else if (normalizedKey.includes('payroll') || normalizedKey.includes('cargas') || normalizedKey.includes('aportes')) {
            normalizedRow.payrollTaxes = rawRow[key];
          } else if (normalizedKey.includes('effective') || normalizedKey.includes('vigencia') || 
                     normalizedKey.includes('fecha') || normalizedKey.includes('desde')) {
            normalizedRow.effectiveFrom = rawRow[key];
          }
        });

        // Convertir números si son strings
        if (typeof normalizedRow.grossSalary === 'string') {
          normalizedRow.grossSalary = parseFloat(normalizedRow.grossSalary.replace(/,/g, '.'));
        }
        if (typeof normalizedRow.payrollTaxes === 'string') {
          normalizedRow.payrollTaxes = parseFloat(normalizedRow.payrollTaxes.replace(/,/g, '.'));
        }

        // Convertir documentOrCode a string
        if (typeof normalizedRow.documentOrCode === 'number') {
          normalizedRow.documentOrCode = normalizedRow.documentOrCode.toString();
        }

        // Validar con schema
        const validatedRow = EmployeeImportRowSchema.parse(normalizedRow);

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
          // Buscar empleado existente por documento/código
          const existingEmployee = await tx.costEmployee.findFirst({
            where: {
              companyId: parseInt(companyId),
              name: row.documentOrCode, // Usar el campo name como identificador único
            },
          });

          let employee;
          let isNewEmployee = false;

          if (existingEmployee) {
            // Actualizar empleado existente
            employee = await tx.costEmployee.update({
              where: { id: existingEmployee.id },
              data: {
                name: row.name,
                role: row.role,
                grossSalary: row.grossSalary,
                payrollTaxes: row.payrollTaxes,
                active: true,
              },
            });
            result.employeesUpdated++;
          } else {
            // Crear nuevo empleado
            employee = await tx.costEmployee.create({
              data: {
                companyId: parseInt(companyId),
                name: row.name,
                role: row.role,
                grossSalary: row.grossSalary,
                payrollTaxes: row.payrollTaxes,
                active: true,
              },
            });
            isNewEmployee = true;
            result.employeesCreated++;
          }

          // Obtener último registro de historial para calcular cambio porcentual
          let changePct: number | null = null;
          if (!isNewEmployee) {
            const lastHistory = await tx.employeeCompHistory.findFirst({
              where: { employeeId: employee.id },
              orderBy: { effectiveFrom: 'desc' },
            });

            if (lastHistory) {
              const previousSalary = lastHistory.grossSalary.toNumber();
              if (previousSalary > 0) {
                changePct = ((row.grossSalary - previousSalary) / previousSalary) * 100;
              }
            }
          }

          // Crear registro de historial
          await tx.employeeCompHistory.create({
            data: {
              companyId: parseInt(companyId),
              employeeId: employee.id,
              effectiveFrom: row.effectiveFrom,
              grossSalary: row.grossSalary,
              payrollTaxes: row.payrollTaxes,
              changePct: changePct,
            },
          });
          result.historyRecords++;
        }
      });
    }

    return NextResponse.json({
      ...result,
      message: `Importación completada. ${result.employeesCreated} empleados nuevos, ${result.employeesUpdated} actualizados, ${result.historyRecords} registros de historial.`,
    });

  } catch (error) {
    console.error('Error importing employee data:', error);
    return NextResponse.json(
      { 
        error: 'Error al procesar archivo',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}
