import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function parseCSVLine(line: string, separator: string): string[] {
  const result = [];
  let current = '';
  let inQuotes = false;

  const cleanLine = line.replace(/\r/g, '').trim();

  for (let i = 0; i < cleanLine.length; i++) {
    const char = cleanLine[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === separator && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());

  while (result.length > 0 && result[result.length - 1] === '') {
    result.pop();
  }

  return result;
}

function detectSeparator(firstLine: string): string {
  if (firstLine.includes('\t')) return '\t';
  if (firstLine.includes(';')) return ';';
  return ',';
}

export async function POST(request: NextRequest) {
  console.log('🚀 POST /api/products/bulk-upload - Iniciando...');

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const companyIdStr = formData.get('companyId') as string;

    if (!file || !companyIdStr) {
      return NextResponse.json(
        { error: 'Archivo y companyId son requeridos' },
        { status: 400 }
      );
    }

    const companyId = parseInt(companyIdStr);
    const fileContent = await file.text();
    const lines = fileContent.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'El archivo debe tener al menos un encabezado y una línea de datos' },
        { status: 400 }
      );
    }

    const separator = detectSeparator(lines[0]);
    const headers = parseCSVLine(lines[0], separator);

    const requiredHeaders = ['nombre', 'sku', 'categoria'];
    const missingHeaders = requiredHeaders.filter(header =>
      !headers.some(h => h.toLowerCase().trim() === header)
    );

    if (missingHeaders.length > 0) {
      return NextResponse.json(
        { error: `Encabezados faltantes: ${missingHeaders.join(', ')}` },
        { status: 400 }
      );
    }

    const results = [];
    const errors = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('//')) continue;

      const values = parseCSVLine(line, separator);

      if (values.length < 3) {
        errors.push(`Línea ${i + 1}: Datos insuficientes (${values.length} campos, se requieren mínimo 3)`);
        errorCount++;
        continue;
      }

      const nombre = values[0]?.trim();
      const sku = values[1]?.trim();
      const categoria = values[2]?.trim();
      const subcategoria = values[3]?.trim() || '';
      const descripcion = values[4]?.trim() || '';

      if (!nombre || !sku || !categoria) {
        errors.push(`Línea ${i + 1}: Campos requeridos faltantes (nombre, sku, categoria)`);
        errorCount++;
        continue;
      }


      try {
        // Buscar la categoría por nombre
        const categoriaEncontrada = await prisma.$queryRawUnsafe(`
          SELECT id FROM product_categories
          WHERE name ILIKE $1 AND company_id = $2
        `, categoria, companyId);

        if (!categoriaEncontrada || (categoriaEncontrada as any[]).length === 0) {
          errors.push(`Línea ${i + 1}: Categoría "${categoria}" no encontrada para la empresa.`);
          errorCount++;
          continue;
        }

        const categoryId = (categoriaEncontrada as any[])[0].id;

        // Buscar la subcategoría si se proporciona
        let subcategoryId = null;
        if (subcategoria) {
          const subcategoriaEncontrada = await prisma.$queryRawUnsafe(`
            SELECT id FROM product_subcategories
            WHERE name ILIKE $1 AND category_id = $2 AND company_id = $3
          `, subcategoria, categoryId, companyId);

          if (subcategoriaEncontrada && (subcategoriaEncontrada as any[]).length > 0) {
            subcategoryId = (subcategoriaEncontrada as any[])[0].id;
          } else {
            errors.push(`Línea ${i + 1}: Subcategoría "${subcategoria}" no encontrada en la categoría "${categoria}".`);
            errorCount++;
            continue;
          }
        }

        // Verificar si el SKU ya existe
        const skuExistente = await prisma.$queryRawUnsafe(`
          SELECT id FROM products
          WHERE sku = $1 AND company_id = $2
        `, sku, companyId);

        if (skuExistente && (skuExistente as any[]).length > 0) {
          // Actualizar producto existente
          await prisma.$queryRawUnsafe(`
            UPDATE products
            SET name = $1, description = $2, category_id = $3, subcategory_id = $4,
                updated_at = CURRENT_TIMESTAMP
            WHERE sku = $5 AND company_id = $6
          `, nombre, descripcion, categoryId, subcategoryId, sku, companyId);

          results.push({
            line: i + 1,
            product: nombre,
            sku: sku,
            action: 'updated'
          });
        } else {
          // Crear nuevo producto
          await prisma.$queryRawUnsafe(`
            INSERT INTO products (
              name, description, sku, category_id, subcategory_id, company_id,
              unit_price, unit_cost, stock_quantity, min_stock_level,
              is_active, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, 0, 0, 0, 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
          `, nombre, descripcion, sku, categoryId, subcategoryId, companyId);

          results.push({
            line: i + 1,
            product: nombre,
            sku: sku,
            action: 'created'
          });
        }

        successCount++;

      } catch (error: any) {
        console.error(`Error procesando línea ${i + 1}:`, error);
        errors.push(`Línea ${i + 1}: Error interno al procesar producto`);
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Procesamiento completado: ${successCount} productos procesados, ${errorCount} errores`,
      summary: {
        total: lines.length - 1,
        success: successCount,
        errors: errorCount
      },
      results,
      errors: errors.slice(0, 50)
    });

  } catch (error) {
    console.error('Error en carga masiva de productos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
