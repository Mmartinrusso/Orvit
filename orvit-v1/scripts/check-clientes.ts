import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst();

  if (!company) {
    console.log('No hay empresa');
    return;
  }

  console.log(`Empresa: ${company.name} (ID: ${company.id})`);

  const total = await prisma.client.count({
    where: { companyId: company.id }
  });

  console.log(`\nTotal clientes en DB: ${total}`);

  const activos = await prisma.client.count({
    where: { companyId: company.id, isActive: true }
  });

  console.log(`Clientes activos: ${activos}`);

  const clientes = await prisma.client.findMany({
    where: { companyId: company.id },
    select: {
      id: true,
      legalName: true,
      isActive: true,
      currentBalance: true,
    },
    take: 15
  });

  console.log(`\nPrimeros ${clientes.length} clientes:`);
  clientes.forEach(c => {
    console.log(`  - ${c.legalName} (activo: ${c.isActive}, saldo: ${c.currentBalance})`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
