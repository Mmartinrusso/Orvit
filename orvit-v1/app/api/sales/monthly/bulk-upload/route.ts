import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function parseCSVLine(line: string, separator: string): string[] {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  // Limpiar la línea de caracteres de control
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
  
  // Filtrar campos vacíos al final
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
  console.log('🚀 POST /api/sales/monthly/bulk-upload - Iniciando...');
  
  try {
    console.log('🔍 Iniciando carga masiva de ventas mensuales...');
    
    console.log('📥 Parseando FormData...');
    const formData = await request.formData();
    
    console.log('📋 FormData keys:', Array.from(formData.keys()));
    
    const file = formData.get('file') as File;
    const companyIdStr = formData.get('companyId') as string;
    
    console.log('📋 Datos recibidos:', {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      companyIdStr,
      hasCompanyId: !!companyIdStr,
      companyIdType: typeof companyIdStr
    });
    
    if (!file || !companyIdStr) {
      console.error('❌ Datos faltantes:', {
        file: !!file,
        companyId: !!companyIdStr
      });
      return NextResponse.json(
        { error: 'Archivo y companyId son requeridos' },
        { status: 400 }
      );
    }
    
    const companyId = parseInt(companyIdStr);
    const fileContent = await file.text();
    const lines = fileContent.split('\n').filter(line => line.trim());
    
    console.log('📄 Contenido del archivo:', {
      totalLines: lines.length,
      firstLine: lines[0],
      secondLine: lines[1],
      contentPreview: fileContent.substring(0, 200)
    });
    
    if (lines.length < 2) {
      console.error('❌ Archivo insuficiente:', { lines: lines.length });
      return NextResponse.json(
        { error: 'El archivo debe tener al menos un encabezado y una línea de datos' },
        { status: 400 }
      );
    }
    
    // Detectar separador automáticamente
    const separator = detectSeparator(lines[0]);
    
    // Parsear encabezados
    const headers = parseCSVLine(lines[0], separator);
    
    // Validar encabezados básicos (sin discount_percentage)
    const requiredHeaders = ['nombre_producto', 'mes', 'unidades_vendidas', 'precio_unitario'];
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
    
    // Procesar cada línea de datos
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('//')) continue;
      
      const values = parseCSVLine(line, separator);
      
      console.log(`📝 Línea ${i + 1} - Datos parseados:`, {
        line: line.substring(0, 100) + '...',
        values,
        length: values.length
      });
      
      if (values.length < 4) {
        errors.push(`Línea ${i + 1}: Datos insuficientes (${values.length} campos, se requieren mínimo 4)`);
        errorCount++;
        continue;
      }
      
      const nombreProducto = values[0]?.trim();
      const mes = values[1]?.trim();
      const unidadesVendidas = values[2]?.trim();
      const precioUnitario = values[3]?.trim();
      const observaciones = values[4]?.trim() || '';
      
      // Validar datos básicos
      if (!nombreProducto || !mes || !unidadesVendidas || !precioUnitario) {
        errors.push(`Línea ${i + 1}: Campos requeridos faltantes`);
        errorCount++;
        continue;
      }
      
      // Validar formato de mes
      if (!/^\d{4}-\d{2}$/.test(mes)) {
        errors.push(`Línea ${i + 1}: Formato de mes inválido. Use YYYY-MM (ej: 2025-08)`);
        errorCount++;
        continue;
      }
      
      // Validar y limpiar números con manejo robusto
      console.log(`🔍 Línea ${i + 1} - Valores originales:`, {
        unidadesVendidas: `"${unidadesVendidas}"`,
        precioUnitario: `"${precioUnitario}"`,
        unidadesLength: unidadesVendidas.length,
        precioLength: precioUnitario.length
      });
      
      // Para unidades: limpiar todo lo que no sea dígito
      const unidadesLimpias = unidadesVendidas.replace(/[^\d]/g, '');
      const unidadesNum = parseInt(unidadesLimpias) || 0;
      
      // Para precio: manejar diferentes formatos de decimal
      let precioLimpio = precioUnitario.trim();
      // Si tiene puntos Y comas, asumir que la coma es decimal
      if (precioLimpio.includes('.') && precioLimpio.includes(',')) {
        precioLimpio = precioLimpio.replace(/\./g, '').replace(',', '.');
      }
      // Si solo tiene coma, convertir a punto decimal
      else if (precioLimpio.includes(',') && !precioLimpio.includes('.')) {
        precioLimpio = precioLimpio.replace(',', '.');
      }
      // Si solo tiene puntos, asumir formato americano
      const precioNum = parseFloat(precioLimpio) || 0;
      
      console.log(`🔢 Línea ${i + 1} - Conversión numérica:`, {
        unidadesOriginal: unidadesVendidas,
        unidadesLimpias,
        unidadesNum,
        precioOriginal: precioUnitario,
        precioLimpio,
        precioNum,
        isUnidadesValid: !isNaN(unidadesNum) && unidadesNum > 0,
        isPrecioValid: !isNaN(precioNum) && precioNum > 0
      });
      
      if (isNaN(unidadesNum) || isNaN(precioNum) || unidadesNum <= 0 || precioNum <= 0) {
        errors.push(`Línea ${i + 1}: Valores numéricos inválidos (unidades: ${unidadesNum}, precio: ${precioNum})`);
        errorCount++;
        continue;
      }
      
      try {
        // Buscar producto por nombre
        const productos = await prisma.$queryRawUnsafe(`
          SELECT id, name FROM products 
          WHERE name ILIKE $1 AND company_id = $2 AND is_active = true
          LIMIT 1
        `, `%${nombreProducto}%`, companyId);
        
        if (!productos || (productos as any[]).length === 0) {
          errors.push(`Línea ${i + 1}: Producto "${nombreProducto}" no encontrado`);
          errorCount++;
          continue;
        }
        
        const productId = (productos as any[])[0].id;
        const totalRevenue = unidadesNum * precioNum;
        const monthDate = new Date(mes + '-01');
        
        console.log(`💾 Línea ${i + 1} - Preparando para guardar:`, {
          companyId,
          productId: productId.toString(),
          nombreProducto,
          mes,
          monthDate,
          unidadesNum,
          precioNum,
          totalRevenue,
          observaciones
        });
        
        // Verificar si ya existe
        const existing = await prisma.$queryRawUnsafe(`
          SELECT id FROM monthly_sales 
          WHERE company_id = $1 AND product_id = $2 AND fecha_imputacion = $3
        `, companyId, productId.toString(), mes);
        
        if (existing && (existing as any[]).length > 0) {
          // Actualizar
          await prisma.$queryRawUnsafe(`
            UPDATE monthly_sales 
            SET quantity_sold = $1, unit_price = $2, total_revenue = $3, 
                notes = $4, updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
          `, unidadesNum, precioNum, totalRevenue, observaciones, (existing as any[])[0].id);
          
          console.log(`✅ Línea ${i + 1} - ACTUALIZADO en BD:`, {
            id: (existing as any[])[0].id,
            quantity_sold: unidadesNum,
            unit_price: precioNum,
            total_revenue: totalRevenue
          });
          
          results.push({
            line: i + 1,
            product: nombreProducto,
            action: 'updated',
            month: mes
          });
        } else {
          // Crear nuevo
          await prisma.$queryRawUnsafe(`
            INSERT INTO monthly_sales (
              company_id, product_id, product_name, month_year, fecha_imputacion,
              quantity_sold, unit_price, total_revenue, notes,
              created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
          `, companyId, productId.toString(), nombreProducto, monthDate, mes, 
             unidadesNum, precioNum, totalRevenue, observaciones);
          
          console.log(`✅ Línea ${i + 1} - CREADO en BD:`, {
            company_id: companyId,
            product_id: productId.toString(),
            quantity_sold: unidadesNum,
            unit_price: precioNum,
            total_revenue: totalRevenue
          });
          
          results.push({
            line: i + 1,
            product: nombreProducto,
            action: 'created',
            month: mes
          });
        }
        
        successCount++;
        
      } catch (error: any) {
        console.error(`Error procesando línea ${i + 1}:`, error);
        errors.push(`Línea ${i + 1}: Error interno - ${error.message}`);
        errorCount++;
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Procesamiento completado: ${successCount} registros procesados, ${errorCount} errores`,
      summary: {
        total: lines.length - 1,
        success: successCount,
        errors: errorCount
      },
      results,
      errors: errors.slice(0, 50)
    });
    
  } catch (error: any) {
    console.error('Error en carga masiva:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}
