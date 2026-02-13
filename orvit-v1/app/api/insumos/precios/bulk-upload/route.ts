import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const companyId = formData.get('companyId') as string;

    if (!file || !companyId) {
      return NextResponse.json(
        { error: 'Archivo y companyId son requeridos' },
        { status: 400 }
      );
    }

    // Leer el archivo CSV
    const text = await file.text();
    const lines = text.split('\n');
    
    // Remover líneas vacías y encabezados
    const dataLines = lines.filter(line => line.trim() && !line.startsWith('Nombre'));
    
    const results = [];
    const errors = [];

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      if (!line) continue;

      try {
        // Parsear línea CSV (formato: nombre;mes_año;precio;notas o nombre,mes_año,precio,notas)
        let fields = line.split(';').map(field => field.trim());
        if (fields.length < 3) {
          fields = line.split(',').map(field => field.trim());
        }
        
        const [supplyName, monthYear, priceStr, notes] = fields;
        
        if (!supplyName || !monthYear || !priceStr) {
          errors.push(`Línea ${i + 2}: Faltan campos requeridos`);
          continue;
        }

        // Validar precio
        const price = parseFloat(priceStr);
        if (isNaN(price) || price <= 0) {
          errors.push(`Línea ${i + 2}: Precio inválido: ${priceStr}`);
          continue;
        }

        // Validar formato de fecha (YYYY-MM)
        if (!/^\d{4}-\d{2}$/.test(monthYear)) {
          errors.push(`Línea ${i + 2}: Formato de fecha inválido: ${monthYear}. Debe ser YYYY-MM`);
          continue;
        }

        // Buscar el insumo por nombre
        let supply = await prisma.$queryRaw`
          SELECT id, name FROM supplies 
          WHERE name ILIKE ${supplyName} AND company_id = ${parseInt(companyId)}
        `;

        let supplyId;
        
        if (!supply || (supply as any[]).length === 0) {
          // Crear nuevo insumo si no existe
          try {
            const newSupply = await prisma.$queryRaw`
              INSERT INTO supplies (name, unit_measure, company_id, is_active, created_at, updated_at)
              VALUES (${supplyName}, 'kg', ${parseInt(companyId)}, true, NOW(), NOW())
              RETURNING id, name
            `;
            
            supplyId = (newSupply as any[])[0].id;
            results.push({
              supplyName,
              monthYear: 'N/A',
              price: 0,
              notes: 'Nuevo insumo creado',
              status: 'success',
              message: 'Insumo creado'
            });
          } catch (createError) {
            errors.push(`Línea ${i + 2}: Error creando insumo ${supplyName}: ${createError instanceof Error ? createError.message : 'Error desconocido'}`);
            continue;
          }
        } else {
          supplyId = (supply as any[])[0].id;
        }
        
        // Crear fecha en formato YYYY-MM-01
        const [year, month] = monthYear.split('-');
        const monthPadded = month.padStart(2, '0');
        const formattedDate = `${year}-${monthPadded}-01`;
        const imputacionKey = `${year}-${monthPadded}`;

        // Verificar si ya existe un precio para este mes e insumo
        const existingPrice = await prisma.$queryRaw`
          SELECT id, price_per_unit FROM supply_monthly_prices 
          WHERE supply_id = ${supplyId} AND month_year = ${formattedDate}::date
        `;

        let result;
        if (existingPrice && (existingPrice as any[]).length > 0) {
          // ACTUALIZAR precio existente
          const oldPrice = (existingPrice as any[])[0].price_per_unit;
          
          result = await prisma.$queryRaw`
            UPDATE supply_monthly_prices 
            SET price_per_unit = ${price}, notes = ${notes || null}, updated_at = NOW()
            WHERE supply_id = ${supplyId} AND month_year = ${formattedDate}::date
            RETURNING id, supply_id as "supplyId", month_year as "monthYear", price_per_unit as "pricePerUnit", notes
          `;

          // Registrar en historial (actualización)
          await prisma.$queryRaw`
            INSERT INTO supply_price_history (supply_id, change_type, old_price, new_price, month_year, notes, company_id)
            VALUES (${supplyId}, 'precio_actualizado_masivo', ${oldPrice}, ${price}, ${formattedDate}::date, ${notes || 'Precio actualizado por carga masiva'}, ${parseInt(companyId)})
          `;
        } else {
          // CREAR nuevo precio
          result = await prisma.$queryRaw`
            INSERT INTO supply_monthly_prices (supply_id, month_year, fecha_imputacion, price_per_unit, notes, company_id)
            VALUES (${supplyId}, ${formattedDate}::date, ${imputacionKey}, ${price}, ${notes || null}, ${parseInt(companyId)})
            RETURNING id, supply_id as "supplyId", month_year as "monthYear", price_per_unit as "pricePerUnit", notes
          `;

          // Registrar en historial (nuevo precio)
          await prisma.$queryRaw`
            INSERT INTO supply_price_history (supply_id, change_type, new_price, month_year, notes, company_id)
            VALUES (${supplyId}, 'precio_registrado_masivo', ${price}, ${formattedDate}::date, ${notes || 'Nuevo precio registrado por carga masiva'}, ${parseInt(companyId)})
          `;
        }

        results.push({
          supplyName,
          monthYear,
          price,
          notes: notes || null,
          status: 'success',
          message: existingPrice && (existingPrice as any[]).length > 0 ? 'Actualizado' : 'Registrado'
        });

      } catch (error) {
        errors.push(`Línea ${i + 2}: Error procesando línea: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Procesados ${results.length} precios exitosamente`,
      results,
      errors,
      summary: {
        total: dataLines.length,
        success: results.length,
        errors: errors.length
      }
    });

  } catch (error) {
    console.error('Error en carga masiva:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
