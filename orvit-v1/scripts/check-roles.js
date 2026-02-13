const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get roles with sectorId
  const roles = await prisma.role.findMany({
    where: { companyId: 3 },
    include: { sector: true },
    orderBy: { name: 'asc' }
  });

  console.log('=== Roles/Puestos definidos ===');
  console.log('Total:', roles.length);
  roles.forEach(r => {
    const sectorName = r.sector ? r.sector.name : 'Sin sector';
    const sectorId = r.sectorId || 'null';
    console.log(' - ' + (r.displayName || r.name) + ' (sector: ' + sectorName + ', id: ' + sectorId + ')');
  });

  // Specifically for Planta Viguetas (sectorId = 3)
  const viguetasRoles = roles.filter(r => r.sectorId === 3);
  console.log('\n=== Roles para Planta Viguetas (sectorId=3) ===');
  console.log('Total:', viguetasRoles.length);
  viguetasRoles.forEach(r => console.log(' - ' + (r.displayName || r.name)));
}

main().catch(console.error).finally(() => prisma.$disconnect());
