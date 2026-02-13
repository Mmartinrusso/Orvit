const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔄 Agregando campos sellerId y actualizando campos obligatorios en Client...');

    // Agregar sellerId
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Client" 
        ADD COLUMN IF NOT EXISTS "sellerId" INTEGER;
      `);
      console.log('✅ Campo sellerId agregado');
    } catch (error) {
      if (error.message && error.message.includes('already exists')) {
        console.log('⚠️  Campo sellerId ya existe');
      } else {
        throw error;
      }
    }

    // Agregar índice para sellerId
    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "Client_sellerId_idx" ON "Client"("sellerId");
      `);
      console.log('✅ Índice para sellerId creado');
    } catch (error) {
      console.log('⚠️  Índice ya existe o error:', error.message);
    }

    // Agregar foreign key para sellerId si no existe
    const fkExists = await prisma.$queryRaw`
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'Client_sellerId_fkey'
    `;

    if (!fkExists || fkExists.length === 0) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Client" 
        ADD CONSTRAINT "Client_sellerId_fkey" 
        FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL;
      `);
      console.log('✅ Foreign key Client -> User (seller) agregada');
    } else {
      console.log('⚠️  Foreign key ya existe');
    }

    // Hacer legalName obligatorio (si no lo es)
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Client" 
        ALTER COLUMN "legalName" SET NOT NULL;
      `);
      console.log('✅ legalName ahora es obligatorio');
    } catch (error) {
      if (error.message && error.message.includes('column "legalName" is already NOT NULL')) {
        console.log('⚠️  legalName ya es obligatorio');
      } else {
        console.log('⚠️  Error al hacer legalName obligatorio:', error.message);
      }
    }

    // Hacer postalCode obligatorio (si no lo es)
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Client" 
        ALTER COLUMN "postalCode" SET NOT NULL;
      `);
      console.log('✅ postalCode ahora es obligatorio');
    } catch (error) {
      if (error.message && error.message.includes('column "postalCode" is already NOT NULL')) {
        console.log('⚠️  postalCode ya es obligatorio');
      } else if (error.message && error.message.includes('contains null')) {
        console.log('⚠️  Hay valores NULL en postalCode, actualizando...');
        await prisma.$executeRawUnsafe(`
          UPDATE "Client" SET "postalCode" = '' WHERE "postalCode" IS NULL;
        `);
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "Client" 
          ALTER COLUMN "postalCode" SET NOT NULL;
        `);
        console.log('✅ postalCode ahora es obligatorio (valores NULL actualizados)');
      } else {
        console.log('⚠️  Error al hacer postalCode obligatorio:', error.message);
      }
    }

    // Hacer name opcional (nombre comercial)
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Client" 
        ALTER COLUMN "name" DROP NOT NULL;
      `);
      console.log('✅ name ahora es opcional');
    } catch (error) {
      console.log('⚠️  name ya es opcional o error:', error.message);
    }

    // Hacer phone opcional
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Client" 
        ALTER COLUMN "phone" DROP NOT NULL;
      `);
      console.log('✅ phone ahora es opcional');
    } catch (error) {
      console.log('⚠️  phone ya es opcional o error:', error.message);
    }

    // Hacer address opcional
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Client" 
        ALTER COLUMN "address" DROP NOT NULL;
      `);
      console.log('✅ address ahora es opcional');
    } catch (error) {
      console.log('⚠️  address ya es opcional o error:', error.message);
    }

    console.log('✅ Actualización completada');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();

