import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Obtener el orden de máquinas de una empresa
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = parseInt(params.id);
    
    console.log(`Consultando orden de máquinas para empresa ${companyId}`);
    
    // Crear tabla si no existe
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS machine_order_temp (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        machine_id INTEGER NOT NULL,
        order_position INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, machine_id)
      )
    `;
    
    // Obtener el orden de la tabla temporal
    const orderRecords = await prisma.$queryRaw`
      SELECT machine_id, order_position 
      FROM machine_order_temp 
      WHERE company_id = ${companyId} 
      ORDER BY order_position ASC
    ` as Array<{ machine_id: number; order_position: number }>;
    
    if (orderRecords.length > 0) {
      const order = orderRecords.reduce((acc, record) => {
        acc[record.machine_id.toString()] = record.order_position;
        return acc;
      }, {} as {[key: string]: number});
      
      console.log('Orden encontrado en base de datos:', order);
      return NextResponse.json({ order });
    }
    
    console.log('No se encontró orden guardado');
    return NextResponse.json({ order: null });
    
  } catch (error) {
    console.error('Error al obtener orden de máquinas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PUT: Guardar el orden de máquinas de una empresa
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = parseInt(params.id);
    const { order } = await request.json();
    
    console.log(`Guardando orden de máquinas para empresa ${companyId}:`, order);
    
    // Crear tabla si no existe
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS machine_order_temp (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        machine_id INTEGER NOT NULL,
        order_position INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, machine_id)
      )
    `;
    
    // Eliminar registros existentes para esta empresa
    await prisma.$executeRaw`
      DELETE FROM machine_order_temp WHERE company_id = ${companyId}
    `;
    
    // Insertar nuevos registros
    for (const [machineId, position] of Object.entries(order)) {
      await prisma.$executeRaw`
        INSERT INTO machine_order_temp (company_id, machine_id, order_position, updated_at)
        VALUES (${companyId}, ${parseInt(machineId)}, ${position}, NOW())
        ON CONFLICT (company_id, machine_id) 
        DO UPDATE SET order_position = ${position}, updated_at = NOW()
      `;
    }
    
    console.log('✅ Orden guardado exitosamente en base de datos');
    return NextResponse.json({ success: true, message: 'Orden guardado exitosamente' });
    
  } catch (error) {
    console.error('Error al guardar orden de máquinas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
