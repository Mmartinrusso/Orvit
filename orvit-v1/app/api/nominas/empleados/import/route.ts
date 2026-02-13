import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPayrollAuth, hasPayrollAccess } from '@/lib/nominas/auth-helper';

export const dynamic = 'force-dynamic';

interface ImportRow {
  name: string;
  role?: string;
  cuil?: string;
  grossSalary?: number;
  payrollTaxes?: number;
  hireDate?: string;
  unionCategoryCode?: string;
  unionCategoryName?: string;
  workSectorName?: string;
}

// POST - Importar empleados desde JSON (procesado del Excel en frontend)
export async function POST(request: NextRequest) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { employees, updateExisting = false } = body as {
      employees: ImportRow[];
      updateExisting?: boolean;
    };

    if (!employees || !Array.isArray(employees) || employees.length === 0) {
      return NextResponse.json(
        { error: 'No se recibieron empleados para importar' },
        { status: 400 }
      );
    }

    // Obtener categorías de la empresa para mapeo
    const categories = await prisma.$queryRaw<any[]>`
      SELECT uc.id, uc.code, uc.name, pu.code as "unionCode", pu.name as "unionName"
      FROM union_categories uc
      JOIN payroll_unions pu ON pu.id = uc.union_id
      WHERE pu.company_id = ${auth.companyId} AND uc.is_active = true
    `;

    // Crear mapa de categorías por código y nombre
    const categoryByCode = new Map<string, number>();
    const categoryByName = new Map<string, number>();
    for (const cat of categories) {
      if (cat.code) categoryByCode.set(cat.code.toLowerCase(), cat.id);
      categoryByName.set(cat.name.toLowerCase(), cat.id);
      // También mapear con el nombre del gremio
      categoryByName.set(`${cat.unionName} - ${cat.name}`.toLowerCase(), cat.id);
    }

    // Obtener sectores de la empresa para mapeo
    const sectors = await prisma.$queryRaw<any[]>`
      SELECT id, name, code FROM work_sectors
      WHERE company_id = ${auth.companyId} AND is_active = true
    `;

    const sectorByName = new Map<string, number>();
    for (const sector of sectors) {
      sectorByName.set(sector.name.toLowerCase(), sector.id);
      if (sector.code) sectorByName.set(sector.code.toLowerCase(), sector.id);
    }

    // Obtener CUILs existentes para detectar duplicados
    const existingCuils = await prisma.$queryRaw<any[]>`
      SELECT id, cuil, name FROM employees
      WHERE company_id = ${auth.companyId} AND cuil IS NOT NULL
    `;

    const cuilToEmployee = new Map<string, { id: string; name: string }>();
    for (const emp of existingCuils) {
      if (emp.cuil) {
        cuilToEmployee.set(emp.cuil, { id: emp.id, name: emp.name });
      }
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < employees.length; i++) {
      const row = employees[i];
      const rowNum = i + 2; // Excel row (1-indexed + header)

      try {
        // Validar nombre
        if (!row.name || !row.name.trim()) {
          errors.push(`Fila ${rowNum}: Nombre vacío`);
          skipped++;
          continue;
        }

        // Buscar categoría
        let unionCategoryId: number | null = null;
        if (row.unionCategoryCode) {
          unionCategoryId = categoryByCode.get(row.unionCategoryCode.toLowerCase()) || null;
        }
        if (!unionCategoryId && row.unionCategoryName) {
          unionCategoryId = categoryByName.get(row.unionCategoryName.toLowerCase()) || null;
        }
        if ((row.unionCategoryCode || row.unionCategoryName) && !unionCategoryId) {
          warnings.push(`Fila ${rowNum}: Categoría "${row.unionCategoryCode || row.unionCategoryName}" no encontrada`);
        }

        // Buscar sector
        let workSectorId: number | null = null;
        if (row.workSectorName) {
          workSectorId = sectorByName.get(row.workSectorName.toLowerCase()) || null;
          if (!workSectorId) {
            warnings.push(`Fila ${rowNum}: Sector "${row.workSectorName}" no encontrado`);
          }
        }

        // Verificar CUIL duplicado
        if (row.cuil) {
          const existing = cuilToEmployee.get(row.cuil);
          if (existing) {
            if (updateExisting) {
              // Actualizar empleado existente
              await prisma.$queryRaw`
                UPDATE employees
                SET
                  name = ${row.name.trim()},
                  role = ${row.role || ''},
                  gross_salary = ${row.grossSalary || 0},
                  payroll_taxes = ${row.payrollTaxes || 0},
                  hire_date = ${row.hireDate ? new Date(row.hireDate) : null},
                  union_category_id = ${unionCategoryId},
                  work_sector_id = ${workSectorId},
                  updated_at = NOW()
                WHERE id = ${existing.id}
              `;
              updated++;
              continue;
            } else {
              errors.push(`Fila ${rowNum}: CUIL ${row.cuil} ya existe (${existing.name})`);
              skipped++;
              continue;
            }
          }
        }

        // Crear nuevo empleado
        const newEmp = await prisma.$queryRaw<any[]>`
          INSERT INTO employees (
            company_id, name, role, cuil, gross_salary, payroll_taxes,
            hire_date, union_category_id, work_sector_id,
            active, created_at, updated_at
          )
          VALUES (
            ${auth.companyId},
            ${row.name.trim()},
            ${row.role || ''},
            ${row.cuil || null},
            ${row.grossSalary || 0},
            ${row.payrollTaxes || 0},
            ${row.hireDate ? new Date(row.hireDate) : null},
            ${unionCategoryId},
            ${workSectorId},
            true,
            NOW(),
            NOW()
          )
          RETURNING id, cuil
        `;

        // Agregar al mapa para evitar duplicados en el mismo import
        if (row.cuil) {
          cuilToEmployee.set(row.cuil, { id: newEmp[0].id, name: row.name });
        }

        created++;
      } catch (e) {
        errors.push(`Fila ${rowNum}: Error al procesar - ${(e as Error).message}`);
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      created,
      updated,
      skipped,
      total: employees.length,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      message: `Importación completada: ${created} creados${updated > 0 ? `, ${updated} actualizados` : ''}${skipped > 0 ? `, ${skipped} omitidos` : ''}`
    });
  } catch (error) {
    console.error('Error importando empleados:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// GET - Obtener plantilla de importación (columnas esperadas)
export async function GET(request: NextRequest) {
  try {
    const auth = await getPayrollAuth();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Obtener categorías y sectores disponibles para referencia
    const categories = await prisma.$queryRaw<any[]>`
      SELECT uc.code, uc.name, pu.name as "unionName"
      FROM union_categories uc
      JOIN payroll_unions pu ON pu.id = uc.union_id
      WHERE pu.company_id = ${auth.companyId} AND uc.is_active = true
      ORDER BY pu.name, uc.name
    `;

    const sectors = await prisma.$queryRaw<any[]>`
      SELECT name, code FROM work_sectors
      WHERE company_id = ${auth.companyId} AND is_active = true
      ORDER BY name
    `;

    return NextResponse.json({
      template: {
        columns: [
          { key: 'name', label: 'Nombre', required: true, example: 'Juan Pérez' },
          { key: 'cuil', label: 'CUIL', required: false, example: '20-12345678-9' },
          { key: 'role', label: 'Cargo', required: false, example: 'Operario' },
          { key: 'grossSalary', label: 'Salario Bruto', required: false, example: '500000' },
          { key: 'payrollTaxes', label: 'Cargas Sociales', required: false, example: '150000' },
          { key: 'hireDate', label: 'Fecha Ingreso', required: false, example: '2024-01-15' },
          { key: 'unionCategoryCode', label: 'Código Categoría', required: false, example: 'OF' },
          { key: 'unionCategoryName', label: 'Categoría', required: false, example: 'OFICIAL' },
          { key: 'workSectorName', label: 'Sector', required: false, example: 'Albañilería' },
        ],
      },
      availableCategories: categories.map(c => ({
        code: c.code,
        name: c.name,
        union: c.unionName,
        fullName: `${c.unionName} - ${c.name}`
      })),
      availableSectors: sectors.map(s => ({
        name: s.name,
        code: s.code
      }))
    });
  } catch (error) {
    console.error('Error obteniendo plantilla:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
