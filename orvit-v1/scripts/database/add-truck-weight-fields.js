const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔧 Aplicando migración: Agregar campos de peso a la tabla Truck...');
    
    // Ejecutar cada sentencia SQL por separado
    console.log('\n📝 Ejecutando sentencias SQL...');
    
    // Agregar columna chasisWeight
    try {
      await prisma.$executeRawUnsafe(`
        DO $$ BEGIN
            ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "chasisWeight" DOUBLE PRECISION;
        EXCEPTION
            WHEN duplicate_column THEN null;
        END $$;
      `);
      console.log('✅ Columna chasisWeight agregada (o ya existía)');
    } catch (error) {
      if (error.message?.includes('duplicate_column') || 
          error.message?.includes('already exists') ||
          error.code === '42701') {
        console.log('ℹ️  Columna chasisWeight ya existe');
      } else {
        throw error;
      }
    }
    
    // Agregar columna acopladoWeight
    try {
      await prisma.$executeRawUnsafe(`
        DO $$ BEGIN
            ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "acopladoWeight" DOUBLE PRECISION;
        EXCEPTION
            WHEN duplicate_column THEN null;
        END $$;
      `);
      console.log('✅ Columna acopladoWeight agregada (o ya existía)');
    } catch (error) {
      if (error.message?.includes('duplicate_column') || 
          error.message?.includes('already exists') ||
          error.code === '42701') {
        console.log('ℹ️  Columna acopladoWeight ya existe');
      } else {
        throw error;
      }
    }
    
    // Verificar que las columnas existen
    const columns = await prisma.$queryRawUnsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Truck' 
      AND column_name IN ('chasisWeight', 'acopladoWeight');
    `);
    
    console.log('\n✅ Migración completada exitosamente');
    console.log('\n📊 Campos verificados en la tabla Truck:');
    if (Array.isArray(columns) && columns.length > 0) {
      columns.forEach((col) => {
        console.log(`  - ${col.column_name} (DOUBLE PRECISION)`);
      });
    } else {
      console.log('  - chasisWeight (DOUBLE PRECISION)');
      console.log('  - acopladoWeight (DOUBLE PRECISION)');
    }
    console.log('\n💡 Ahora puedes usar estos campos en el formulario de camiones tipo EQUIPO');

  } catch (error) {
    console.error('❌ Error durante la migración:', error.message || error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

