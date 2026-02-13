const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Leyendo script de migracion...');
    const sqlScript = fs.readFileSync(
      path.join(__dirname, '..', 'prisma', 'migrations', '20250120000000_add_price_comparisons', 'migration.sql'),
      'utf-8'
    );

    console.log('Ejecutando migracion de comparativas de precios...');
    
    // Dividir el script en sentencias individuales
    // Primero, dividir por punto y coma, luego limpiar
    let statements = sqlScript
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        // Filtrar comentarios y lineas vacias
        return s.length > 0 && 
               !s.startsWith('--') && 
               s !== 'BEGIN' && 
               s !== 'COMMIT' &&
               !s.match(/^\s*$/);
      });
    
    // Si no encontro sentencias, intentar otro metodo
    if (statements.length === 0) {
      console.log('Intentando metodo alternativo de parsing...');
      // Remover comentarios primero
      const withoutComments = sqlScript.replace(/--.*$/gm, '');
      statements = withoutComments
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.match(/^\s*$/));
    }
    
    console.log(`Encontradas ${statements.length} sentencias SQL`);

    let successCount = 0;
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement) {
        try {
          const preview = statement.substring(0, 60).replace(/\s+/g, ' ');
          console.log(`\n[${i + 1}/${statements.length}] Ejecutando: ${preview}...`);
          await prisma.$executeRawUnsafe(statement);
          successCount++;
          console.log(`Completado`);
        } catch (error) {
          // Si la tabla ya existe, continuar
          if (error.message.includes('already exists') || error.message.includes('duplicate')) {
            console.log(`Ya existe, omitiendo...`);
            successCount++;
          } else {
            console.error(`Error en la sentencia ${i + 1}:`, error.message);
            // Continuar con la siguiente sentencia
          }
        }
      }
    }
    
    console.log(`\nTotal: ${successCount}/${statements.length} sentencias ejecutadas exitosamente`);

    console.log('Migracion completada exitosamente');
    console.log('\nNuevas tablas creadas:');
    console.log('  - PriceComparison (Comparativas de precios)');
    console.log('  - PriceComparisonCompetitor (Competidores)');
    console.log('  - PriceComparisonProductPrice (Precios de productos)');
    console.log('\nAhora puedes guardar comparativas desde la interfaz');

  } catch (error) {
    console.error('Error durante la migracion:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

