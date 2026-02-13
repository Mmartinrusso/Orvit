import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sale = await prisma.sale.findUnique({ where: { id: 38 } });
  console.log('Sale 38:', sale ? `Found: ${sale.numero}` : 'NOT FOUND');

  const allSales = await prisma.sale.findMany({
    where: { companyId: 3 },
    select: { id: true, numero: true },
    orderBy: { id: 'desc' },
    take: 5
  });
  console.log('\nRecent sales:', allSales);
}

main().finally(() => prisma.$disconnect());
