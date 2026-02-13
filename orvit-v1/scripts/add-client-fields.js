const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔄 Agregando campos adicionales a la tabla Client...');

    // Agregar campos uno por uno
    const fields = [
      { name: 'legalName', type: 'TEXT', comment: 'Razón social' },
      { name: 'alternatePhone', type: 'TEXT', comment: 'Teléfono alternativo' },
      { name: 'city', type: 'TEXT', comment: 'Localidad / Ciudad' },
      { name: 'province', type: 'TEXT', comment: 'Provincia' },
      { name: 'postalCode', type: 'TEXT', comment: 'Código postal' },
      { name: 'checkTerms', type: 'INTEGER', comment: 'Plazos de cheques (días)' },
      { name: 'saleCondition', type: 'TEXT', comment: 'Condición de venta' },
      { name: 'contactPerson', type: 'TEXT', comment: 'Contacto principal' },
      { name: 'bank', type: 'TEXT', comment: 'Banco' },
      { name: 'cbu', type: 'TEXT', comment: 'CBU' },
      { name: 'aliasCbu', type: 'TEXT', comment: 'Alias CBU' },
      { name: 'accountNumber', type: 'TEXT', comment: 'Número de cuenta corriente' },
      { name: 'grossIncome', type: 'TEXT', comment: 'Ingresos brutos' },
      { name: 'activityStartDate', type: 'TIMESTAMP(3)', comment: 'Inicio de actividades' },
    ];

    for (const field of fields) {
      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "Client" 
          ADD COLUMN IF NOT EXISTS "${field.name}" ${field.type};
        `);
        console.log(`✅ Campo ${field.name} agregado`);
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log(`⚠️  Campo ${field.name} ya existe, omitiendo...`);
        } else {
          throw error;
        }
      }
    }

    console.log('✅ Todos los campos agregados correctamente');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();

