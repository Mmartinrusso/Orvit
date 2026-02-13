import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const companyId = 3;
  const sectorId = 3;
  const sectorName = 'Planta Viguetas.';

  // Count all active employees
  const allEmployees = await prisma.employee.count({
    where: { company_id: companyId, active: true }
  });
  console.log(`Total active employees: ${allEmployees}`);

  // Count employees WITH work_sector_id
  const withWorkSector = await prisma.employee.count({
    where: { company_id: companyId, active: true, work_sector_id: { not: null } }
  });
  console.log(`Employees WITH work_sector_id: ${withWorkSector}`);

  // Find all WorkSectors for this company
  const workSectors = await prisma.workSector.findMany({
    where: { company_id: companyId },
    select: { id: true, name: true, source_sector_id: true }
  });
  console.log('\nAll WorkSectors:', JSON.stringify(workSectors, null, 2));

  // Count employees matching by source_sector_id
  const matchBySourceId = await prisma.employee.count({
    where: {
      company_id: companyId,
      active: true,
      workSector: { source_sector_id: sectorId }
    }
  });
  console.log(`\nEmployees matching by source_sector_id=${sectorId}: ${matchBySourceId}`);

  // Count employees matching by WorkSector name containing "Viguetas"
  const matchByName = await prisma.employee.count({
    where: {
      company_id: companyId,
      active: true,
      workSector: { name: { contains: 'Viguetas', mode: 'insensitive' } }
    }
  });
  console.log(`Employees matching by WorkSector name containing "Viguetas": ${matchByName}`);

  // Show which employees have which WorkSector
  const employeesWithSector = await prisma.employee.findMany({
    where: { company_id: companyId, active: true, work_sector_id: { not: null } },
    select: { name: true, workSector: { select: { id: true, name: true, source_sector_id: true } } },
    take: 20
  });
  console.log('\nSample employees with WorkSector:', JSON.stringify(employeesWithSector, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
