import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST /api/employees/upload-payroll - Cargar planilla de empleados
export async function POST(request: NextRequest) {
  try {
    // Obtener companyId de los query parameters
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file || !companyId) {
      return NextResponse.json(
        { error: 'Archivo y companyId son requeridos' },
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

    // Validar encabezados requeridos
    const requiredHeaders = ['nombre', 'rol', 'categoria'];
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
      employees: [] as any[]
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
        const employeeData: any = {};
        headers.forEach((header, index) => {
          employeeData[header] = values[index];
        });

        const {
          nombre,
          rol,
          categoria
        } = employeeData;

        // Validar datos requeridos
        if (!nombre || !rol || !categoria) {
          results.errors.push(`Línea ${i + 1}: Faltan datos requeridos`);
          continue;
        }

        // Limpiar y procesar los datos
        const nombreEmpleado = nombre.toString().trim();
        const rolEmpleado = rol.toString().trim();
        const categoriaEmpleado = categoria.toString().trim();

        // Buscar la categoría de empleado por nombre exacto
        const employeeCategory = await prisma.employeeCategory.findFirst({
          where: {
            name: {
              equals: categoriaEmpleado,
              mode: 'insensitive'
            },
            company_id: parseInt(companyId)
          }
        });

        if (!employeeCategory) {
          results.errors.push(`Línea ${i + 1}: La categoría "${categoriaEmpleado}" no existe en el sistema`);
          continue;
        }

        const categoryId = employeeCategory.id;

        // Buscar empleado existente por nombre
        const existingEmployee = await prisma.employee.findFirst({
          where: {
            name: {
              equals: nombreEmpleado,
              mode: 'insensitive'
            },
            company_id: parseInt(companyId)
          }
        });

        const employeeInfo = {
          name: nombreEmpleado,
          role: rolEmpleado,
          gross_salary: 0, // Valor por defecto, se asignará después con la plantilla de sueldos
          payroll_taxes: 0, // Valor por defecto
          active: true, // Por defecto activo
          company_id: parseInt(companyId),
          category_id: categoryId
        };

        if (existingEmployee) {
          // Verificar si el salario cambió para crear registro en historial
          const salarioAnterior = existingEmployee.gross_salary;
          const salarioNuevo = employeeInfo.gross_salary;
          
          // Actualizar empleado existente
          await prisma.employee.update({
            where: { id: existingEmployee.id },
            data: {
              name: employeeInfo.name,
              role: employeeInfo.role,
              gross_salary: employeeInfo.gross_salary,
              payroll_taxes: employeeInfo.payroll_taxes,
              active: employeeInfo.active,
              category_id: employeeInfo.category_id,
              updated_at: new Date()
            }
          });

          // Crear registro en historial si el salario cambió
          if (salarioAnterior !== salarioNuevo) {
            await prisma.employeeSalaryHistory.create({
              data: {
                employee_id: existingEmployee.id,
                company_id: parseInt(companyId),
                effective_from: new Date(), // Fecha actual
                gross_salary: salarioNuevo,
                payroll_taxes: employeeInfo.payroll_taxes,
                reason: 'Actualización desde planilla de empleados',
                created_at: new Date()
              }
            });
          }
          
          results.updated++;
        } else {
          // Crear nuevo empleado
          const newEmployee = await prisma.employee.create({
            data: {
              name: employeeInfo.name,
              role: employeeInfo.role,
              gross_salary: employeeInfo.gross_salary,
              payroll_taxes: employeeInfo.payroll_taxes,
              active: employeeInfo.active,
              company_id: employeeInfo.company_id,
              category_id: employeeInfo.category_id,
              created_at: new Date(),
              updated_at: new Date()
            }
          });

          // Crear registro inicial en historial si el empleado tiene salario
          if (employeeInfo.gross_salary > 0) {
            await prisma.employeeSalaryHistory.create({
              data: {
                employee_id: newEmployee.id,
                company_id: parseInt(companyId),
                effective_from: new Date(), // Fecha actual
                gross_salary: employeeInfo.gross_salary,
                payroll_taxes: employeeInfo.payroll_taxes,
                reason: 'Creación desde planilla de empleados',
                created_at: new Date()
              }
            });
          }
          
          results.created++;
        }

        results.employees.push({
          nombre: nombreEmpleado,
          rol: rolEmpleado,
          categoria: categoriaEmpleado
        });

      } catch (error) {
        results.errors.push(`Línea ${i + 1}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Planilla procesada exitosamente`,
      results
    });

  } catch (error) {
    console.error('Error procesando planilla:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
