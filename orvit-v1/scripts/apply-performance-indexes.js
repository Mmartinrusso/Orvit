/**
 * Script para aplicar índices de performance directamente a la base de datos
 * Evita problemas con el sistema de migraciones de Prisma
 * 
 * Uso: node scripts/apply-performance-indexes.js
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function applyIndexes() {
  try {
    console.log('📊 Aplicando índices de performance...\n');

    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, '../prisma/migrations/add_performance_indexes.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // Eliminar comentarios de línea completa y bloques de comentarios
    let cleanedSql = sql
      // Eliminar comentarios de bloque /* ... */
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Eliminar comentarios de línea --
      .replace(/--[^\n]*/g, '');

    // Dividir en statements individuales (separados por ;)
    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.toUpperCase().includes('CREATE INDEX'));

    console.log(`📝 Encontrados ${statements.length} índices para crear\n`);

    if (statements.length === 0) {
      console.log('⚠️  No se encontraron statements CREATE INDEX en el archivo SQL');
      console.log('   Verificando ruta del archivo:', sqlPath);
      console.log('   Archivo existe:', fs.existsSync(sqlPath));
      return;
    }

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // Aplicar cada statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Extraer el nombre del índice del statement
      const indexMatch = statement.match(/CREATE INDEX (?:IF NOT EXISTS )?(\w+)/i);
      const indexName = indexMatch ? indexMatch[1] : `index_${i + 1}`;

      try {
        // Ejecutar el statement
        await prisma.$executeRawUnsafe(statement);
        console.log(`✅ ${indexName} - Creado`);
        successCount++;
      } catch (error) {
        // Si el índice ya existe, ignorar el error
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate') ||
            error.code === '42P07') {
          console.log(`⏭️  ${indexName} - Ya existe, omitido`);
          skipCount++;
        } else {
          console.error(`❌ ${indexName} - Error: ${error.message}`);
          errorCount++;
          
          // Mostrar el statement que falló para debugging
          if (process.env.DEBUG) {
            console.error(`   Statement: ${statement.substring(0, 150)}...`);
          }
        }
      }
    }

    console.log('\n📊 Resumen:');
    console.log(`   ✅ Creados: ${successCount}`);
    console.log(`   ⏭️  Omitidos (ya existían): ${skipCount}`);
    console.log(`   ❌ Errores: ${errorCount}`);

    if (errorCount === 0) {
      console.log('\n🎉 ¡Todos los índices se aplicaron correctamente!');
      
      if (successCount > 0) {
        console.log(`\n💡 Se crearon ${successCount} nuevos índices.`);
        console.log('   Las queries ahora deberían ser más rápidas.');
      }
      
      if (skipCount > 0) {
        console.log(`\n💡 ${skipCount} índices ya existían (esto es normal).`);
      }
    } else {
      console.log('\n⚠️  Algunos índices tuvieron errores. Revisa los mensajes arriba.');
      console.log('   Tip: Ejecuta con DEBUG=1 para ver más detalles:');
      console.log('   DEBUG=1 node scripts/apply-performance-indexes.js');
    }

  } catch (error) {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
applyIndexes();
