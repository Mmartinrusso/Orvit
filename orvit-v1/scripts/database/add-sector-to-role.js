const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addSectorToRole() {
  try {
    console.log('🔍 Agregando columna sectorId a la tabla Role...');
    
    // Ejecutar SQL directamente para agregar la columna de forma segura
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Role" 
      ADD COLUMN IF NOT EXISTS "sectorId" INTEGER;
    `);
    
    console.log('✅ Columna sectorId agregada (si no existía)');
    
    // Verificar si la foreign key ya existe antes de crearla
    const foreignKeyExists = await prisma.$queryRawUnsafe(`
      SELECT 1 
      FROM information_schema.table_constraints 
      WHERE constraint_name = 'Role_sectorId_fkey' 
      AND table_name = 'Role';
    `);
    
    if (!foreignKeyExists || foreignKeyExists.length === 0) {
      console.log('🔍 Agregando foreign key constraint...');
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Role" 
        ADD CONSTRAINT "Role_sectorId_fkey" 
        FOREIGN KEY ("sectorId") 
        REFERENCES "Sector"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
      `);
      console.log('✅ Foreign key agregada');
    } else {
      console.log('ℹ️ Foreign key ya existe, omitiendo...');
    }
    
    console.log('✅ Migración completada exitosamente');
    console.log('📊 Verificando roles existentes...');
    
    // Usar SQL directo para verificar ya que el cliente Prisma aún no tiene el campo
    const roles = await prisma.$queryRawUnsafe(`
      SELECT id, name, "displayName", "sectorId" 
      FROM "Role"
      ORDER BY name
    `);
    
    console.log(`📋 Total de roles: ${Array.isArray(roles) ? roles.length : 0}`);
    if (Array.isArray(roles)) {
      roles.forEach((role: any) => {
        console.log(`  - ${role.displayName} (${role.name}): sectorId = ${role.sectorId || 'null'}`);
      });
    }
    
    console.log('\n⚠️ IMPORTANTE: Ejecuta "npx prisma generate" para regenerar el cliente Prisma');
    
  } catch (error) {
    console.error('❌ Error ejecutando migración:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addSectorToRole()
  .then(() => {
    console.log('🎉 Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });

