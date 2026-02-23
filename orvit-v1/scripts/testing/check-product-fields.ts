import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const product = await prisma.product.findFirst({
    where: { companyId: 3 }
  });

  console.log(JSON.stringify(product, null, 2));
}

main()
  .finally(() => prisma.$disconnect());
