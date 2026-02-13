import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testAPI() {
  // Simulate the API logic
  const company = await prisma.company.findFirst();
  if (!company) {
    console.log('❌ No hay empresa');
    return;
  }

  const companyId = company.id;
  console.log(`✅ CompanyId: ${companyId}`);

  // Simulate the where clause from the API
  const where = {
    companyId,
    // No filters applied (simulating frontend calling with statusFilter='all')
  };

  console.log('\n📝 Where clause:', JSON.stringify(where, null, 2));

  const [clientes, total] = await Promise.all([
    prisma.client.findMany({
      where,
      select: {
        id: true,
        legalName: true,
        email: true,
        isActive: true,
        currentBalance: true,
      },
      take: 20,
      skip: 0,
    }),
    prisma.client.count({ where })
  ]);

  console.log(`\n📊 Resultados:`);
  console.log(`   Total: ${total}`);
  console.log(`   Devueltos: ${clientes.length}`);

  if (clientes.length > 0) {
    console.log(`\n✅ Primeros clientes:`);
    clientes.slice(0, 5).forEach(c => {
      console.log(`   - ${c.legalName}`);
    });
  } else {
    console.log(`\n❌ NO SE ENCONTRARON CLIENTES`);
    console.log(`   Verificando qué clientes existen:`);

    const allClients = await prisma.client.findMany({
      where: { companyId },
      select: { id: true, legalName: true, companyId: true },
      take: 5
    });

    console.log(`   Hay ${allClients.length} clientes con companyId=${companyId}:`);
    allClients.forEach(c => {
      console.log(`   - ${c.legalName} (companyId: ${c.companyId})`);
    });
  }
}

testAPI()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
