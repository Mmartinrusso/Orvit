import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 [API] Creando tabla de fallas...');

    // Ejecutar el SQL para crear la tabla
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS failures (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          machine_id INTEGER NOT NULL,
          failure_type VARCHAR(50) DEFAULT 'MECANICA',
          priority VARCHAR(20) DEFAULT 'MEDIUM',
          estimated_hours DECIMAL(5,2) DEFAULT 0,
          reported_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          status VARCHAR(50) DEFAULT 'REPORTED',
          affected_components JSONB,
          attachments JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (machine_id) REFERENCES "Machine"(id) ON DELETE CASCADE
      )
    `;

    // Crear índices
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_failures_machine_id ON failures(machine_id)
    `;
    
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_failures_status ON failures(status)
    `;
    
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_failures_reported_date ON failures(reported_date)
    `;

    console.log('✅ [API] Tabla de fallas creada exitosamente');

    return NextResponse.json({
      success: true,
      message: 'Tabla de fallas creada exitosamente'
    });

  } catch (error) {
    console.error('❌ [API] Error al crear tabla de fallas:', error);
    return NextResponse.json(
      { error: 'Error al crear la tabla de fallas: ' + (error as Error).message },
      { status: 500 }
    );
  }
}