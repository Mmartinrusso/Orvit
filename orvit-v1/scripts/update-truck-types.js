const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔄 Actualizando tipos de camiones...');

    // Primero agregar las nuevas columnas si no existen
    await prisma.$executeRaw`
      ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "chasisLength" DOUBLE PRECISION;
    `;
    console.log('✅ Campo chasisLength agregado');

    await prisma.$executeRaw`
      ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "acopladoLength" DOUBLE PRECISION;
    `;
    console.log('✅ Campo acopladoLength agregado');

    // Actualizar el enum TruckType
    // Primero crear el nuevo tipo si no existe
    await prisma.$executeRaw`
      DO $$ BEGIN
        CREATE TYPE "TruckType_new" AS ENUM ('CHASIS', 'EQUIPO', 'SEMI');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    console.log('✅ Nuevo enum creado');

    // Convertir valores existentes
    // ACOPLADO -> CHASIS
    await prisma.$executeRaw`
      ALTER TABLE "Truck" ALTER COLUMN "type" TYPE TEXT;
    `;
    console.log('✅ Columna type convertida a TEXT');

    await prisma.$executeRaw`
      UPDATE "Truck" SET "type" = 'CHASIS' WHERE "type" = 'ACOPLADO';
    `;
    console.log('✅ ACOPLADO convertido a CHASIS');

    // SEMI y EQUIPO se mantienen igual
    await prisma.$executeRaw`
      UPDATE "Truck" SET "type" = 'SEMI' WHERE "type" = 'SEMI';
    `;
    await prisma.$executeRaw`
      UPDATE "Truck" SET "type" = 'EQUIPO' WHERE "type" = 'EQUIPO';
    `;

    // Cambiar el tipo de columna al nuevo enum
    await prisma.$executeRaw`
      ALTER TABLE "Truck" ALTER COLUMN "type" TYPE "TruckType_new" USING "type"::"TruckType_new";
    `;
    console.log('✅ Columna type convertida al nuevo enum');

    // Eliminar el enum viejo y renombrar el nuevo
    await prisma.$executeRaw`
      DROP TYPE IF EXISTS "TruckType";
    `;
    await prisma.$executeRaw`
      ALTER TYPE "TruckType_new" RENAME TO "TruckType";
    `;
    console.log('✅ Enum renombrado');

    console.log('✅ Tipos de camiones actualizados correctamente');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('✅ Script completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en el script:', error);
    process.exit(1);
  });

