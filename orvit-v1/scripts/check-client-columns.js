const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const columns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Client' 
      ORDER BY column_name
    `;
    
    console.log('Columnas en Client:');
    columns.forEach((c, i) => {
      console.log(`${i + 1}. ${c.column_name}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

