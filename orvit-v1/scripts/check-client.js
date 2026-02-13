const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const client = await prisma.$queryRaw`
      SELECT id, "legalName", name, email, "isActive", "companyId" 
      FROM "Client" 
      WHERE email = 'ejemplo@cliente.com'
    `;
    
    console.log('Cliente encontrado:', client[0]);
    
    // Verificar todos los clientes activos de la empresa
    const allClients = await prisma.$queryRaw`
      SELECT id, "legalName", name, email, "isActive", "companyId" 
      FROM "Client" 
      WHERE "companyId" = ${client[0]?.companyId || 3} AND "isActive" = true
      ORDER BY "legalName" ASC
    `;
    
    console.log(`\nTotal de clientes activos en la empresa: ${allClients.length}`);
    allClients.forEach((c, i) => {
      console.log(`${i + 1}. ${c.legalName || c.name || 'Sin nombre'} (${c.email}) - Activo: ${c.isActive}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

