import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startPerf, endParse, startDb, endDb, startCompute, endCompute, startJson, endJson, withPerfHeaders, shouldDisableCache } from '@/lib/perf';

export const dynamic = 'force-dynamic';

/**
 * ✨ ENDPOINT OPTIMIZADO: Catálogos unificados de administración
 * Reemplaza múltiples requests individuales con una sola llamada
 * Usa Promise.all para ejecutar queries en paralelo
 * 
 * ANTES: ~10-15 requests (productos, categorías, insumos, empleados, clientes, proveedores, etc.)
 * DESPUÉS: 1 request
 */
export async function GET(request: NextRequest) {
  const perfCtx = startPerf();
  const { searchParams } = new URL(request.url);
  
  try {
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    endParse(perfCtx);
    startDb(perfCtx);

    const companyIdNum = parseInt(companyId);

    // ✨ OPTIMIZACIÓN: Ejecutar todas las queries en paralelo con Promise.all
    const [
      products,
      categories,
      subcategories,
      supplies,
      employees,
      employeeCategories,
      clients,
      suppliers
    ] = await Promise.all([
      // 1. Productos
      getProducts(companyIdNum),
      
      // 2. Categorías de productos
      getProductCategories(companyIdNum),
      
      // 3. Subcategorías de productos
      getProductSubcategories(companyIdNum),
      
      // 4. Insumos
      getSupplies(companyIdNum),
      
      // 5. Empleados (para costos)
      getEmployees(),
      
      // 6. Categorías de empleados
      getEmployeeCategories(),
      
      // 7. Clientes
      getClients(companyIdNum),
      
      // 8. Proveedores
      getSuppliers(companyIdNum)
    ]);

    endDb(perfCtx);
    startCompute(perfCtx);
    // No hay compute pesado aquí, solo preparación de datos
    endCompute(perfCtx);
    startJson(perfCtx);

    const responseData = {
      products: products,
      categories: categories,
      subcategories: subcategories,
      supplies: supplies,
      employees: employees,
      employeeCategories: employeeCategories,
      clients: clients,
      suppliers: suppliers,
      metadata: {
        companyId: companyIdNum,
        timestamp: new Date().toISOString(),
        counts: {
          products: products.length,
          categories: categories.length,
          subcategories: subcategories.length,
          supplies: supplies.length,
          employees: employees.length,
          employeeCategories: employeeCategories.length,
          clients: clients.length,
          suppliers: suppliers.length
        }
      }
    };

    const response = NextResponse.json(responseData, {
      headers: {
        // ✨ FIX: Agregar cache HTTP (5 minutos - catálogos cambian poco)
        'Cache-Control': shouldDisableCache(searchParams) 
          ? 'no-store' 
          : 'private, max-age=300, s-maxage=300',
      }
    });

    const metrics = endJson(perfCtx, responseData);
    return withPerfHeaders(response, metrics, searchParams);

  } catch (error) {
    console.error('❌ Error en catálogos de administración:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// ============================================================================
// FUNCIONES HELPER
// ============================================================================

/**
 * Obtener productos
 */
async function getProducts(companyId: number) {
  try {
    const products = await prisma.$queryRaw`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.sku,
        p.category_id as "categoryId",
        p.subcategory_id as "subcategoryId",
        p.company_id as "companyId",
        p.unit_price as "unitPrice",
        p.unit_cost as "unitCost",
        p.stock_quantity as "stockQuantity",
        p.min_stock_level as "minStockLevel",
        p.is_active as "isActive",
        p.weight,
        p.volume,
        p.volume_unit as "volumeUnit",
        pc.name as "categoryName",
        ps.name as "subcategoryName"
      FROM products p
      INNER JOIN product_categories pc ON p.category_id = pc.id
      LEFT JOIN product_subcategories ps ON p.subcategory_id = ps.id
      WHERE p.company_id = ${companyId}
      ORDER BY p.name
    ` as any[];
    return products;
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}

/**
 * Obtener categorías de productos
 */
async function getProductCategories(companyId: number) {
  try {
    const categories = await prisma.$queryRaw`
      SELECT 
        id,
        name,
        description,
        company_id as "companyId",
        created_at as "createdAt"
      FROM product_categories
      WHERE company_id = ${companyId}
      ORDER BY name
    ` as any[];
    return categories;
  } catch (error) {
    console.error('Error fetching product categories:', error);
    return [];
  }
}

/**
 * Obtener subcategorías de productos
 */
async function getProductSubcategories(companyId: number) {
  try {
    const subcategories = await prisma.$queryRaw`
      SELECT 
        ps.id,
        ps.name,
        ps.description,
        ps.category_id as "categoryId",
        ps.company_id as "companyId",
        pc.name as "categoryName"
      FROM product_subcategories ps
      INNER JOIN product_categories pc ON ps.category_id = pc.id
      WHERE ps.company_id = ${companyId}
      ORDER BY ps.name
    ` as any[];
    return subcategories;
  } catch (error) {
    console.error('Error fetching product subcategories:', error);
    return [];
  }
}

/**
 * Obtener insumos
 */
async function getSupplies(companyId: number) {
  try {
    const supplies = await prisma.$queryRaw`
      SELECT 
        s.id,
        s.name,
        s.unit_measure as "unit",
        s.supplier_id as "supplierId",
        s.company_id as "companyId",
        s.is_active as "isActive",
        sup.name as "supplierName"
      FROM supplies s
      LEFT JOIN suppliers sup ON s.supplier_id = sup.id
      WHERE s.company_id = ${companyId}
      ORDER BY s.name
    ` as any[];
    return supplies;
  } catch (error) {
    console.error('Error fetching supplies:', error);
    return [];
  }
}

/**
 * Obtener empleados
 */
async function getEmployees() {
  try {
    const employees = await prisma.costEmployee.findMany({
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        role: true,
        grossSalary: true,
        payrollTaxes: true,
        active: true,
        companyId: true
      }
    });
    return employees;
  } catch (error) {
    console.error('Error fetching employees:', error);
    return [];
  }
}

/**
 * Obtener categorías de empleados
 */
async function getEmployeeCategories() {
  try {
    // Usar employee_categories de la tabla real
    const categories = await prisma.$queryRaw`
      SELECT 
        id,
        name,
        description,
        company_id as "companyId",
        is_active as "isActive"
      FROM employee_categories
      WHERE is_active = true
      ORDER BY name
    ` as any[];
    return categories;
  } catch (error) {
    console.error('Error fetching employee categories:', error);
    return [];
  }
}

/**
 * Obtener clientes
 */
async function getClients(companyId: number) {
  try {
    // Usar la tabla Client que existe en el schema
    const clients = await prisma.client.findMany({
      where: {
        companyId: companyId,
        isActive: true
      },
      orderBy: {
        name: 'asc'
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        companyId: true,
        cuit: true,
        legalName: true,
        createdAt: true
      }
    });
    return clients;
  } catch (error) {
    console.error('Error fetching clients:', error);
    return [];
  }
}

/**
 * Obtener proveedores
 */
async function getSuppliers(companyId: number) {
  try {
    const suppliers = await prisma.$queryRaw`
      SELECT 
        id,
        name,
        email,
        phone,
        address,
        company_id as "companyId",
        cuit,
        razon_social as "razonSocial",
        created_at as "createdAt"
      FROM suppliers
      WHERE company_id = ${companyId}
      ORDER BY name
    ` as any[];
    return suppliers;
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return [];
  }
}

