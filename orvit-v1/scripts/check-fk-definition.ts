import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check FK definition
  const fkDef = await prisma.$queryRaw`
    SELECT
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.constraint_name = 'sale_delivery_items_saleItemId_fkey';
  `;

  console.log('FK Definition:', JSON.stringify(fkDef, null, 2));

  // Check if items exist
  const items = await prisma.$queryRaw`SELECT id FROM sale_items WHERE id IN (77, 78)`;
  console.log('\nItems in sale_items:', JSON.stringify(items));

  // Check what table sale_items actually refers to (in case of case sensitivity)
  const tableInfo = await prisma.$queryRaw`
    SELECT table_name FROM information_schema.tables
    WHERE table_name LIKE '%sale%item%' AND table_schema = 'public'
  `;
  console.log('\nTables matching sale item:', JSON.stringify(tableInfo));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
