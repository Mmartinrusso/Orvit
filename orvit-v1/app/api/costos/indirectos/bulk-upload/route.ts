import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    console.log('🔍 Iniciando carga masiva de costos indirectos...');

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const companyId = String(user!.companyId);

    console.log('📊 Datos recibidos:', {
      fileName: file?.name,
      fileSize: file?.size,
      companyId
    });

    if (!file) {
      console.log('❌ Error: Archivo faltante');
      return NextResponse.json(
        { error: 'Archivo es requerido' },
        { status: 400 }
      );
    }

    // Leer el contenido del archivo CSV
    const csvText = await file.text();
    const lines = csvText.split('\n').filter(line => line.trim());
    
    console.log('📊 CSV procesado:', { 
      totalLines: lines.length, 
      firstLine: lines[0], 
      sampleLines: lines.slice(0, 3) 
    });
    
    if (lines.length < 2) {
      console.log('❌ Error: CSV insuficiente');
      return NextResponse.json(
        { error: 'El archivo CSV debe tener al menos una fila de encabezados y una fila de datos' },
        { status: 400 }
      );
    }

    // Parsear encabezados (intentar con punto y coma primero, luego con coma)
    let headers = lines[0].split(';').map(h => h.trim());
    if (headers.length < 4) {
      headers = lines[0].split(',').map(h => h.trim());
    }
    
    const expectedHeaders = ['nombre_costo', 'mes', 'monto', 'notas'];
    
    // Verificar que los encabezados sean correctos
    const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return NextResponse.json(
        { error: `Encabezados faltantes: ${missingHeaders.join(', ')}` },
        { status: 400 }
      );
    }

    const results = [];
    const errors = [];

    // Procesar cada línea de datos
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        // Parsear la línea CSV (manejar comillas)
        const values = parseCSVLine(line);
        
        if (values.length < 3) {
          errors.push(`Línea ${i + 1}: Datos insuficientes`);
          continue;
        }

        const nombreCosto = values[0]?.trim();
        const mes = values[1]?.trim();
        const monto = values[2]?.trim();
        const notas = values[3]?.trim() || '';

        // Validaciones
        if (!nombreCosto || !mes || !monto) {
          errors.push(`Línea ${i + 1}: Nombre, mes y monto son obligatorios`);
          continue;
        }

        // Validar formato del mes (YYYY-MM)
        if (!/^\d{4}-\d{2}$/.test(mes)) {
          errors.push(`Línea ${i + 1}: Formato de mes inválido. Debe ser YYYY-MM`);
          continue;
        }

        // Validar monto
        const montoNum = parseFloat(monto);
        if (isNaN(montoNum) || montoNum <= 0) {
          errors.push(`Línea ${i + 1}: Monto inválido`);
          continue;
        }

        // Buscar el costo base por nombre (DEBE existir)
        const costoBase = await prisma.$queryRaw`
          SELECT id, name, category_id FROM indirect_cost_base
          WHERE name = ${nombreCosto} AND company_id = ${parseInt(companyId)}
        `;

        if (!costoBase || (costoBase as any[]).length === 0) {
          errors.push(`Línea ${i + 1}: No se encontró el costo base "${nombreCosto}". Debe crear el costo base manualmente primero.`);
          continue;
        }

        const costoId = (costoBase as any[])[0].id;

        // Obtener el último registro para este mes y costo (para mostrar el cambio en el historial)
        const lastRecord = await prisma.$queryRaw`
          SELECT id, amount FROM indirect_cost_monthly_records
          WHERE cost_base_id = ${costoId} AND fecha_imputacion = ${mes}
          ORDER BY created_at DESC
          LIMIT 1
        `;

        let oldAmount = 0;
        let isUpdate = false;

        if (lastRecord && (lastRecord as any[]).length > 0) {
          oldAmount = Number((lastRecord as any[])[0].amount);
          isUpdate = true;
        }

        // SIEMPRE crear un nuevo registro mensual (mantener historial completo)
        const newRecord = await prisma.$queryRaw`
          INSERT INTO indirect_cost_monthly_records (cost_base_id, fecha_imputacion, amount, status, notes, company_id)
          VALUES (${costoId}, ${mes}, ${montoNum}, 'paid', ${notas || null}, ${parseInt(companyId)})
          RETURNING id
        `;
        
        const recordId = (newRecord as any[])[0].id;

        // Registrar en el historial
        const reasonText = isUpdate 
          ? `Registro mensual agregado por carga masiva ($${oldAmount.toLocaleString()} → $${montoNum.toLocaleString()})`
          : `Registro mensual creado por carga masiva ($${montoNum.toLocaleString()})`;
        
        const changeType = isUpdate ? 'monthly_record_added' : 'monthly_record_created';
        
        await prisma.$executeRaw`
          INSERT INTO indirect_cost_change_history (cost_base_id, change_type, reason, company_id)
          VALUES (${costoId}, ${changeType}, ${reasonText}, ${parseInt(companyId)})
        `;

        let message = '';
        
        if (isUpdate) {
          message = 'Registro mensual agregado exitosamente';
        } else {
          message = 'Registro mensual creado exitosamente';
        }

        results.push({
          line: i + 1,
          costo: nombreCosto,
          mes,
          monto: montoNum,
          status: 'success',
          message
        });

      } catch (lineError) {
        errors.push(`Línea ${i + 1}: Error al procesar - ${lineError instanceof Error ? lineError.message : 'Error desconocido'}`);
      }
    }

    console.log('📊 Resultado final:', { 
      resultsCount: results.length, 
      errorsCount: errors.length,
      results: results.slice(0, 2), // Primeros 2 resultados
      errors: errors.slice(0, 2)    // Primeros 2 errores
    });

    if (results.length === 0) {
      console.log('❌ Error: No se procesó ningún registro');
      return NextResponse.json(
        { 
          error: 'No se pudo procesar ningún registro',
          details: errors 
        },
        { status: 400 }
      );
    }

    console.log('✅ Éxito: Procesados', results.length, 'registros');
    return NextResponse.json({
      success: true,
      message: `${results.length} registros procesados exitosamente${errors.length > 0 ? `, ${errors.length} errores` : ''}`,
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error en carga masiva:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Función para parsear líneas CSV que pueden contener comillas
function parseCSVLine(line: string): string[] {
  // Intentar primero con punto y coma, luego con coma
  let separator = ';';
  let result = parseCSVLineWithSeparator(line, separator);
  
  if (result.length < 3) {
    separator = ',';
    result = parseCSVLineWithSeparator(line, separator);
  }
  
  return result;
}

function parseCSVLineWithSeparator(line: string, separator: string): string[] {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Comilla doble escapada
        current += '"';
        i++; // Saltar la siguiente comilla
      } else {
        // Cambiar estado de comillas
        inQuotes = !inQuotes;
      }
    } else if (char === separator && !inQuotes) {
      // Separador de campo
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Agregar el último campo
  result.push(current);
  
  return result;
}
