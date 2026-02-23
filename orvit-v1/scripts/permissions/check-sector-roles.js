const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const companyId = 3;

  // Get all unique roles in the company
  const allEmployees = await prisma.employee.findMany({
    where: { company_id: companyId },
    select: { role: true }
  });
  const allRoles = Array.from(new Set(allEmployees.map(e => e.role).filter(Boolean)));
  console.log('=== Todos los roles únicos en la empresa ===');
  allRoles.forEach(r => console.log(' -', r));
  console.log('Total roles únicos:', allRoles.length);

  // Get WorkSectors
  const workSectors = await prisma.workSector.findMany({
    where: { company_id: companyId },
    include: { sourceSector: true }
  });
  console.log('\n=== WorkSectors ===');
  workSectors.forEach(ws => {
    console.log(` - ID: ${ws.id}, Nombre: "${ws.name}", Sector: ${ws.sourceSector?.name || 'N/A'} (ID: ${ws.source_sector_id})`);
  });

  // For each WorkSector, get employees and their roles
  console.log('\n=== Empleados por WorkSector ===');
  for (const ws of workSectors) {
    const employees = await prisma.employee.findMany({
      where: {
        company_id: companyId,
        work_sector_id: ws.id
      },
      select: { name: true, role: true, active: true }
    });
    console.log(`\nWorkSector "${ws.name}" (${employees.length} empleados):`);
    employees.forEach(e => console.log(`  - ${e.name} | ${e.role} | activo: ${e.active}`));

    // Unique roles in this WorkSector
    const uniqueRoles = Array.from(new Set(employees.map(e => e.role).filter(Boolean)));
    console.log(`  Roles únicos: ${uniqueRoles.join(', ') || '(ninguno)'}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
