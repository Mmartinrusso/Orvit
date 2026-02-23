import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const fk = await prisma.$queryRaw`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_name = 'sales_invoices_saleId_fkey'
  `;

  console.log('Sales Invoice FK:', JSON.stringify(fk, null, 2));
}

main().finally(() => prisma.$disconnect());
