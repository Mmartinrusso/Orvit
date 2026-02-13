const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔍 Verificando conexión a la base de datos...\n');
    
    // Verificar que las tablas existen
    console.log('1️⃣ Verificando tabla TaxBase...');
    const taxBaseCount = await prisma.$queryRaw`SELECT COUNT(*) FROM "TaxBase"`;
    console.log('✅ TaxBase existe:', taxBaseCount);
    
    console.log('\n2️⃣ Verificando tabla TaxRecord...');
    const taxRecordCount = await prisma.$queryRaw`SELECT COUNT(*) FROM "TaxRecord"`;
    console.log('✅ TaxRecord existe:', taxRecordCount);
    
    console.log('\n3️⃣ Verificando enum TaxControlStatus...');
    const enumValues = await prisma.$queryRaw`
      SELECT unnest(enum_range(NULL::"TaxControlStatus")) as value
    `;
    console.log('✅ TaxControlStatus enum:', enumValues);
    
    console.log('\n4️⃣ Verificando usuarios activos...');
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true }
    });
    console.log('✅ Usuarios activos:', users.length);
    if (users.length > 0) {
      console.log('   Primer usuario:', users[0]);
    }
    
    console.log('\n5️⃣ Verificando empresas...');
    const companies = await prisma.company.findMany({
      select: { id: true, name: true }
    });
    console.log('✅ Empresas:', companies.length);
    if (companies.length > 0) {
      console.log('   Empresas:', companies);
    }
    
    console.log('\n✅ ¡Conexión a la base de datos exitosa!');
    console.log('🎯 Las APIs deberían funcionar correctamente ahora.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();
