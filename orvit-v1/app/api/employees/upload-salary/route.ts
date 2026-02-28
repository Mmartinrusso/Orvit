import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// POST /api/employees/upload-salary - Cargar plantilla de sueldos mensuales
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const companyId = String(user!.companyId);

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Archivo es requerido' },
        { status: 400 }
      );
    }

    // Leer el archivo
    const fileContent = await file.text();
    const lines = fileContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'El archivo debe tener al menos una fila de encabezados y una fila de datos' },
        { status: 400 }
      );
    }

    // Detectar el separador automáticamente
    const firstLine = lines[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    
    const separator = semicolonCount > commaCount ? ';' : ',';
    console.log('Separador detectado:', separator);
    
    // Parsear encabezados con el separador detectado
    const headers = lines[0].split(separator).map(h => h.trim().toLowerCase());
    console.log('Headers encontrados:', headers);

    // Validar encabezados requeridos para sueldos
    const requiredHeaders = ['nombre_empleado', 'sueldo', 'mes_imputacion'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
      return NextResponse.json(
        { 
          error: `Faltan los siguientes encabezados requeridos: ${missingHeaders.join(', ')}`,
          requiredHeaders,
          foundHeaders: headers
        },
        { status: 400 }
      );
    }

    const results = {
      created: 0,
      updated: 0,
      errors: [] as string[],
      salaries: [] as any[]
    };

    // Procesar cada línea de datos
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(separator).map(v => v.trim());
        if (values.length !== headers.length) {
          results.errors.push(`Línea ${i + 1}: Número de columnas incorrecto (esperado: ${headers.length}, encontrado: ${values.length})`);
          continue;
        }

        // Crear objeto con los datos
        const salaryData: any = {};
        headers.forEach((header, index) => {
          salaryData[header] = values[index];
        });

        const {
          nombre_empleado,
          sueldo,
          mes_imputacion
        } = salaryData;

        // Validar datos requeridos
        if (!nombre_empleado || !sueldo || !mes_imputacion) {
          results.errors.push(`Línea ${i + 1}: Faltan datos requeridos`);
          continue;
        }

        // Limpiar y procesar los datos
        const nombreEmpleado = nombre_empleado.toString().trim();
        const sueldoStr = sueldo.toString().replace(',', '.');
        const mesImputacion = mes_imputacion.toString().trim();

        // Validar sueldo
        const sueldoNumerico = parseFloat(sueldoStr);
        if (isNaN(sueldoNumerico) || sueldoNumerico <= 0) {
          results.errors.push(`Línea ${i + 1}: El sueldo "${sueldo}" no es un número válido`);
          continue;
        }

        // Validar formato de mes (YYYY-MM)
        const mesRegex = /^\d{4}-\d{2}$/;
        if (!mesRegex.test(mesImputacion)) {
          results.errors.push(`Línea ${i + 1}: El mes debe tener formato YYYY-MM (ej: 2025-01)`);
          continue;
        }

        // Buscar empleado existente
        const employee = await prisma.employee.findFirst({
          where: {
            name: {
              equals: nombreEmpleado,
              mode: 'insensitive'
            },
            company_id: parseInt(companyId),
            active: true
          },
          include: {
            employee_categories: true
          }
        });

        if (!employee) {
          results.errors.push(`Línea ${i + 1}: El empleado "${nombreEmpleado}" no existe o está inactivo`);
          continue;
        }

        // Verificar si ya existe un registro de sueldo para este empleado en este mes
        const [yearCheck, monthCheck] = mesImputacion.split('-');
        const startDate = new Date(parseInt(yearCheck), parseInt(monthCheck) - 1, 1);
        const endDate = new Date(parseInt(yearCheck), parseInt(monthCheck), 1);
        
        const existingSalary = await prisma.employeeSalaryHistory.findFirst({
          where: {
            employee_id: employee.id,
            effective_from: {
              gte: startDate,
              lt: endDate
            }
          }
        });

        // Crear fecha sin UTC para evitar problemas de zona horaria
        const [year, month] = mesImputacion.split('-');
        const effectiveDate = new Date(parseInt(year), parseInt(month) - 1, 1, 12, 0, 0);
        
        const salaryInfo = {
          employee_id: employee.id,
          gross_salary: sueldoNumerico,
          payroll_taxes: 0, // Valor por defecto
          effective_from: effectiveDate,
          company_id: parseInt(companyId),
          created_at: new Date()
        };

        if (existingSalary) {
          // Actualizar sueldo existente
          await prisma.employeeSalaryHistory.update({
            where: { id: existingSalary.id },
            data: {
              gross_salary: salaryInfo.gross_salary,
              payroll_taxes: salaryInfo.payroll_taxes
            }
          });
          results.updated++;
        } else {
          // Crear nuevo registro de sueldo
          await prisma.employeeSalaryHistory.create({
            data: salaryInfo
          });
          results.created++;
        }

        results.salaries.push({
          nombre: nombreEmpleado,
          rol: employee.role,
          categoria: employee.employee_categories?.name || 'Sin categoría',
          sueldo: sueldoNumerico,
          mes: mesImputacion
        });

      } catch (error) {
        results.errors.push(`Línea ${i + 1}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Plantilla de sueldos procesada exitosamente`,
      results
    });

  } catch (error) {
    console.error('Error procesando plantilla de sueldos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
