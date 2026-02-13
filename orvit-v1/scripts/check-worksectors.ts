import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const companyId = 3;

  // Check WorkSectors
  const workSectors = await prisma.workSector.findMany({
    where: { company_id: companyId },
    include: {
      sourceSector: { select: { id: true, name: true } }
    }
  });
  console.log('WorkSectors for company:', JSON.stringify(workSectors, null, 2));
  console.log('Total WorkSectors:', workSectors.length);

  // Check the template's employeeSelectConfig
  const template = await prisma.productionRoutineTemplate.findFirst({
    where: { code: 'PLANTA_VIGUETAS_' },
    select: {
      id: true,
      code: true,
      name: true,
      items: true
    }
  });
  console.log('\nTemplate:', template?.code);

  if (template?.items) {
    console.log('\nTemplate items type:', typeof template.items);
    console.log('Items is array:', Array.isArray(template.items));

    // items could be an object with nested structure
    const itemsStr = JSON.stringify(template.items, null, 2);
    console.log('\nFull items structure (first 2000 chars):');
    console.log(itemsStr.substring(0, 2000));

    // Find EMPLOYEE_SELECT anywhere in the JSON
    if (itemsStr.includes('EMPLOYEE_SELECT')) {
      console.log('\n✓ EMPLOYEE_SELECT found in template');

      // Check for workSectorAssignment
      if (itemsStr.includes('workSectorAssignment')) {
        console.log('✓ workSectorAssignment found in config');
        // Find the value
        const match = itemsStr.match(/"workSectorAssignment"\s*:\s*(true|false)/);
        if (match) {
          console.log('  workSectorAssignment value:', match[1]);
        }
      } else {
        console.log('✗ workSectorAssignment NOT found in config');
      }
    } else {
      console.log('✗ No EMPLOYEE_SELECT found in template');
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
