import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.sale.findMany({
    where: { numero: { in: ['OV-2024-00001', 'OV-2024-00002'] } },
    include: { items: true }
  });

  console.log('Orders found:', orders.length);
  orders.forEach(o => {
    console.log(`  - Order ${o.numero}: ${o.items.length} items`);
    o.items.forEach(item => {
      console.log(`    * Item ID: ${item.id}, Product: ${item.productId}, Qty: ${item.cantidad}`);
    });
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
